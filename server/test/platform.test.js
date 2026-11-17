import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Project from '../src/models/Project.js';
import PlanTask from '../src/models/PlanTask.js';

let mongo;
let server;
let app;
let ownerAgent;
let owner;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-platform';
  process.env.ADMIN_EMAILS = 'admin@example.com';
  process.env.RESEND_API_KEY = '';
  process.env.EMAIL_FROM = '';
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
  await User.init();
  ({ default: app } = await import('../src/app.js'));
  server = app.listen(0, '127.0.0.1');

  ownerAgent = request.agent(server);
  const signup = await ownerAgent.post('/api/auth/signup').send({
    name: 'Owner User', email: 'project-user@example.com', password: 'sunlit-home-2026', termsAccepted: true, privacyAcknowledged: true,
  }).expect(201);
  owner = signup.body.user;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (app?.locals?.sessionStore) await app.locals.sessionStore.close();
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('serves public runtime configuration without secrets', async () => {
  const response = await request(server).get('/api/config').expect(200);
  assert.deepEqual(Object.keys(response.body), ['googleClientId']);
});

test('resets a password with a single-use token and signs out existing sessions', async () => {
  const agent = request.agent(server);
  await agent.post('/api/auth/signup').send({
    name: 'Reset User', email: 'reset-user@example.com', password: 'original-pass-2026', termsAccepted: true, privacyAcknowledged: true,
  }).expect(201);
  await agent.get('/api/auth/me').expect(200);

  const unknown = await request(server).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200);
  assert.match(unknown.body.message, /If an account/);
  assert.equal(unknown.body.resetUrl, undefined);

  const forgot = await request(server).post('/api/auth/forgot-password').send({ email: 'reset-user@example.com' }).expect(200);
  assert.ok(forgot.body.resetUrl, 'development responses include the reset link when email is not configured');
  const token = new URL(forgot.body.resetUrl).searchParams.get('reset');
  assert.match(token, /^[a-f\d]{64}$/);

  await request(server).post('/api/auth/reset-password').send({ token, password: 'short' }).expect(400);
  const reset = await request(server).post('/api/auth/reset-password').send({ token, password: 'a-new-password-2026' }).expect(200);
  assert.match(reset.body.message, /updated/);

  await agent.get('/api/auth/me').expect(401);
  await request(server).post('/api/auth/login').send({ email: 'reset-user@example.com', password: 'original-pass-2026' }).expect(401);
  await request(server).post('/api/auth/login').send({ email: 'reset-user@example.com', password: 'a-new-password-2026' }).expect(200);
  await request(server).post('/api/auth/reset-password').send({ token, password: 'another-password-2026' }).expect(400);
});

test('duplicates, archives, restores, shares and revokes a project', async () => {
  const created = await ownerAgent.post('/api/projects').send({
    title: 'Living room refresh', type: 'interior', room: 'Living room', style: 'Warm minimal',
    rooms: [{ name: 'Living room', length: 14, width: 12, height: 10 }, { name: 'Dining', length: 10, width: 8 }],
  }).expect(201);
  const id = created.body.data._id;
  assert.equal(created.body.data.rooms.length, 2);

  const duplicate = await ownerAgent.post(`/api/projects/${id}/duplicate`).expect(201);
  assert.match(duplicate.body.data.title, / — copy$/);
  assert.equal(duplicate.body.data.rooms.length, 2);
  assert.notEqual(duplicate.body.data.rooms[0]._id, created.body.data.rooms[0]._id);

  await ownerAgent.patch(`/api/projects/${id}`).send({ archived: true }).expect(200);
  const active = await ownerAgent.get('/api/projects').expect(200);
  assert.equal(active.body.data.some((project) => project._id === id), false);
  const archived = await ownerAgent.get('/api/projects?archived=1').expect(200);
  assert.equal(archived.body.data.some((project) => project._id === id), true);
  await ownerAgent.patch(`/api/projects/${id}`).send({ archived: false }).expect(200);

  const share = await ownerAgent.post(`/api/projects/${id}/share`).expect(200);
  assert.match(share.body.data.shareToken, /^[a-f\d]{48}$/);
  const shared = await request(server).get(`/api/public/projects/${share.body.data.shareToken}`).expect(200);
  assert.equal(shared.body.data.title, 'Living room refresh');
  assert.equal(shared.body.data.ownerName, 'Owner User');
  assert.equal(shared.body.data.rooms.length, 2);
  await request(server).get('/api/public/projects/not-a-real-token').expect(404);

  const photo = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#c9b8a3' } }).jpeg().toBuffer();
  const reference = await ownerAgent.post(`/api/projects/${id}/reference`).attach('image', photo, { filename: 'room.jpg', contentType: 'image/jpeg' }).expect(200);
  const assetId = reference.body.data.referenceAssetId;
  const privateAsset = await ownerAgent.get(`/api/design-assets/${assetId}`).expect(200).expect('Content-Type', /image\/jpeg/);
  assert.ok(Buffer.isBuffer(privateAsset.body) && privateAsset.body[0] === 0xff && privateAsset.body[1] === 0xd8);
  const publicAsset = await request(server).get(`/api/public/projects/${share.body.data.shareToken}/assets/${assetId}`).expect(200).expect('Content-Type', /image\/jpeg/);
  assert.ok(Buffer.isBuffer(publicAsset.body) && publicAsset.body[0] === 0xff && publicAsset.body[1] === 0xd8);

  await ownerAgent.delete(`/api/projects/${id}/share`).expect(200);
  await request(server).get(`/api/public/projects/${share.body.data.shareToken}`).expect(404);
});

test('keeps planner tasks private and supports templates, updates and removal', async () => {
  await request(server).get('/api/planner').expect(401);
  const empty = await ownerAgent.get('/api/planner').expect(200);
  assert.equal(empty.body.data.length, 0);

  const template = await ownerAgent.post('/api/planner/template').send({}).expect(200);
  assert.equal(template.body.added, 8);
  assert.equal(template.body.data.length, 8);
  const again = await ownerAgent.post('/api/planner/template').send({}).expect(200);
  assert.equal(again.body.added, 0);

  const task = await ownerAgent.post('/api/planner').send({ title: 'Book a site visit', phase: 'planning' }).expect(201);
  const done = await ownerAgent.patch(`/api/planner/${task.body.data._id}`).send({ done: true }).expect(200);
  assert.equal(done.body.data.done, true);

  await ownerAgent.post('/api/planner').send({ title: 'Other user task' }).expect(201);
  const other = await request.agent(server);
  await other.post('/api/auth/signup').send({ name: 'Other User', email: 'other-planner@example.com', password: 'other-home-2026', termsAccepted: true, privacyAcknowledged: true }).expect(201);
  const otherTasks = await other.get('/api/planner').expect(200);
  assert.equal(otherTasks.body.data.length, 0);
  await other.patch(`/api/planner/${task.body.data._id}`).send({ done: false }).expect(404);
  await other.delete(`/api/planner/${task.body.data._id}`).expect(404);

  await ownerAgent.delete(`/api/planner/${task.body.data._id}`).expect(200);
  assert.equal(await PlanTask.countDocuments({ userId: owner.id, title: 'Book a site visit' }), 0);
});

test('records notifications and feedback, and restricts the admin dashboard', async () => {
  const adminAgent = request.agent(server);
  const admin = await adminAgent.post('/api/auth/signup').send({
    name: 'Admin User', email: 'admin@example.com', password: 'admin-home-2026', termsAccepted: true, privacyAcknowledged: true,
  }).expect(201);
  assert.equal(admin.body.user.isAdmin, true);

  const normalAgent = request.agent(server);
  const normal = await normalAgent.post('/api/auth/signup').send({
    name: 'Normal User', email: 'normal@example.com', password: 'normal-home-2026', termsAccepted: true, privacyAcknowledged: true,
  }).expect(201);
  assert.equal(normal.body.user.isAdmin, false);

  await ownerAgent.post('/api/enquiries').send({
    name: 'Owner User', phone: '9876543210', city: 'Pune', message: 'Please quote a full living room renovation.',
  }).expect(201);
  const notifications = await ownerAgent.get('/api/notifications').expect(200);
  assert.ok(notifications.body.unreadCount >= 1);
  assert.equal(notifications.body.data[0].type, 'enquiry');
  await ownerAgent.post('/api/notifications/read-all').expect(200);
  assert.equal((await ownerAgent.get('/api/notifications').expect(200)).body.unreadCount, 0);

  await ownerAgent.post('/api/feedback').send({ rating: 5, category: 'idea', message: 'Please add a paint visualiser next.' }).expect(201);
  await ownerAgent.post('/api/feedback').send({ rating: 9, category: 'general', message: 'invalid rating' }).expect(400);

  await ownerAgent.get('/api/admin/stats').expect(403);
  const stats = await adminAgent.get('/api/admin/stats').expect(200);
  assert.ok(stats.body.data.users >= 4);
  assert.ok(stats.body.data.enquiries >= 1);
  assert.ok(stats.body.data.feedback >= 1);

  const users = await adminAgent.get('/api/admin/users?q=normal@example.com').expect(200);
  assert.equal(users.body.data.length, 1);
  assert.equal(users.body.data[0].role, 'user');
  await adminAgent.patch(`/api/admin/users/${normal.body.user.id}/role`).send({ role: 'admin' }).expect(200);
  await normalAgent.get('/api/admin/stats').expect(200);
  await adminAgent.patch(`/api/admin/users/${normal.body.user.id}/role`).send({ role: 'user' }).expect(200);
  await normalAgent.get('/api/admin/stats').expect(403);
  await adminAgent.patch(`/api/admin/users/${admin.body.user.id}/role`).send({ role: 'user' }).expect(400);

  const enquiries = await adminAgent.get('/api/admin/enquiries?status=new').expect(200);
  assert.ok(enquiries.body.data.length >= 1);
  await adminAgent.patch(`/api/admin/enquiries/${enquiries.body.data[0].id}`).send({ status: 'contacted' }).expect(200);

  const feedback = await adminAgent.get('/api/admin/feedback').expect(200);
  assert.ok(feedback.body.data.length >= 1);
  await adminAgent.patch(`/api/admin/feedback/${feedback.body.data[0].id}`).send({ status: 'reviewed' }).expect(200);
});

test('cascades project deletion to planner tasks and keeps data owner-scoped', async () => {
  const project = await Project.create({ ownerId: owner.id, title: 'Delete me', type: 'renovation' });
  await PlanTask.create({ userId: owner.id, projectId: project._id, title: 'Remove this task', phase: 'planning' });
  await ownerAgent.delete(`/api/projects/${project._id}`).expect(200);
  assert.equal(await PlanTask.countDocuments({ projectId: project._id }), 0);
});
