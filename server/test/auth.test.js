import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import DesignAsset from '../src/models/DesignAsset.js';
import sharp from 'sharp';

let mongo;
let server;
let agent;
let app;
const frontendOrigin = 'http://localhost:5174';

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-tests';
  process.env.DEV_CLIENT_ORIGIN = 'http://localhost:5175';
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
  await User.init();
  ({ default: app } = await import('../src/app.js'));
  server = app.listen(0, '127.0.0.1');
  agent = request.agent(server);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (app?.locals?.sessionStore) await app.locals.sessionStore.close();
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('guest, signup, persistent session, project authorization, login, logout, and rate limits', async () => {
  const guestProjects = await request(server).get('/api/projects').expect(401);
  assert.equal(guestProjects.body.error, 'Please log in to continue.');

  const invalid = await agent.post('/api/auth/signup').send({ name: 'A', email: 'bad', password: 'short' }).expect(400);
  assert.match(invalid.body.error, /Name must be at least 2 characters|valid email|10 characters/);
  await agent.post('/api/auth/signup').send({ name: 'Ananya Sharma', email: 'missing-consent@example.com', password: 'sunlit-home-2026' }).expect(400);
  await request(server).options('/api/auth/signup').set('Origin', 'http://localhost:5175').set('Access-Control-Request-Method', 'POST').expect(204);

  const signup = await agent.post('/api/auth/signup').set('Origin', frontendOrigin).send({
    name: 'Ananya Sharma', email: 'Ananya@example.com', password: 'sunlit-home-2026', termsAccepted: true, privacyAcknowledged: true,
  }).expect(201);
  assert.equal(signup.headers['access-control-allow-origin'], frontendOrigin);
  assert.deepEqual(Object.keys(signup.body.user).sort(), ['city', 'email', 'hasPassword', 'id', 'isAdmin', 'name', 'preferredStyle']);
  assert.equal(signup.body.user.hasPassword, true);
  assert.equal(signup.body.user.isAdmin, false);
  assert.equal(signup.body.user.email, 'ananya@example.com');
  assert.match(signup.headers['set-cookie'][0], /HttpOnly/i);
  assert.match(signup.headers['set-cookie'][0], /SameSite=Lax/i);
  const signupSessionCookie = signup.headers['set-cookie'][0].split(';')[0];

  const stored = await User.findOne({ email: 'ananya@example.com' }).select('+passwordHash');
  assert.ok(stored.passwordHash);
  assert.notEqual(stored.passwordHash, 'sunlit-home-2026');
  assert.equal(await bcrypt.compare('sunlit-home-2026', stored.passwordHash), true);
  assert.equal(signup.body.user.passwordHash, undefined);

  const current = await agent.get('/api/auth/me').expect(200);
  assert.equal(current.body.user.id, signup.body.user.id);
  await agent.patch('/api/auth/profile').set('Origin', 'https://evil.example').send({ name: 'Unsafe change', city: 'Pune', preferredStyle: 'Japandi' }).expect(403);
  const profile = await agent.patch('/api/auth/profile').set('Origin', 'https://localhost').send({ name: 'Ananya Sharma', city: 'Pune', preferredStyle: 'Japandi' }).expect(200);
  assert.equal(profile.headers['access-control-allow-origin'], 'https://localhost');
  assert.equal(profile.body.user.preferredStyle, 'Japandi');
  await request(server).options('/api/auth/profile').set('Origin', 'https://localhost').set('Access-Control-Request-Method', 'PATCH').expect('Access-Control-Allow-Methods', /PATCH/).expect(204);
  await agent.post('/api/auth/signup').send({ name: 'Ananya Sharma', email: 'ANANYA@example.com', password: 'sunlit-home-2026', termsAccepted: true, privacyAcknowledged: true }).expect(409);

  const project = await agent.post('/api/projects').send({ title: 'Living room', type: 'interior', room: 'Living room', style: 'Japandi' }).expect(201);
  assert.equal(String(project.body.data.ownerId), signup.body.user.id);
  const projectList = await agent.get('/api/projects').expect(200);
  assert.equal(projectList.body.data.length, 1);
  assert.equal(projectList.body.data[0].title, 'Living room');
  await agent.post('/api/projects').send({ title: 'bad project', type: 'unknown' }).expect(400);
  const detail = await agent.get(`/api/projects/${project.body.data._id}`).expect(200);
  assert.equal(detail.body.data.favorite, false);
  const updatedProject = await agent.patch(`/api/projects/${project.body.data._id}`).send({
    title: 'Living room refresh', favorite: true, measurements: { length: 14, width: 12, height: 10, unit: 'ft', city: 'Pune' },
    estimateReport: {
      renovationType: 'Paint refresh', quality: 'Standard', low: 350, expected: 450, high: 550, currency: 'INR',
      items: [{ key: 'paint', name: 'Paint & primer', quantity: 1.2, unit: 'litre', unitRate: 320, low: 300, expected: 384, high: 460 }],
      shoppingList: [{ name: 'Paint & primer', quantity: 1.2, unit: 'litre' }],
    },
  }).expect(200);
  assert.equal(updatedProject.body.data.title, 'Living room refresh');
  assert.equal(updatedProject.body.data.favorite, true);
  assert.equal(updatedProject.body.data.estimate, 450);
  assert.equal(updatedProject.body.data.estimateReport.shoppingList[0].quantity, 1.2);
  const projectImage = await DesignAsset.create({
    ownerId: signup.body.user.id, projectId: project.body.data._id, kind: 'original',
    contentType: 'image/jpeg', byteLength: 4, data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await agent.get(`/api/design-assets/${projectImage._id}`).expect(200).expect('Content-Type', /image\/jpeg/);
  await agent.get(`/api/design-assets/${projectImage._id}`).set('Origin', 'https://evil.example').expect(403);
  await agent.get(`/api/design-assets/${projectImage._id}`).set('Sec-Fetch-Site', 'cross-site').expect(403);

  const imageBuffer = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#e8e4da' } }).png().toBuffer();
  app.locals.imageGenerator = async () => ({ imageBuffer: await sharp(imageBuffer).jpeg().toBuffer(), model: 'test-image-model' });
  const designFields = { mode: 'interior', roomType: 'Living room', style: 'Japandi', palette: 'Warm neutrals', budget: 'Under ₹2 lakh' };
  await agent.post('/api/designs').field(designFields).attach('image', Buffer.from('not an image'), { filename: 'room.png', contentType: 'image/png' }).expect(400);
  const design = await agent.post('/api/designs').field(designFields).attach('image', imageBuffer, { filename: 'room.png', contentType: 'image/png' }).expect(201);
  assert.equal(design.body.data.model, 'test-image-model');
  assert.match((await agent.get(design.body.data.originalAssetUrl).expect(200)).headers['content-type'], /^image\/jpeg/);
  await agent.post(`/api/projects/${design.body.data.projectId}/save`).send({}).expect(200);

  const otherAgent = request.agent(server);
  const secondSignup = await otherAgent.post('/api/auth/signup').send({ name: 'Rohan Mehta', email: 'rohan@example.com', password: 'thoughtful-home-2026', termsAccepted: true, privacyAcknowledged: true }).expect(201);
  assert.notEqual(secondSignup.body.user.id, signup.body.user.id);
  assert.equal((await otherAgent.get('/api/projects').expect(200)).body.data.length, 0);
  await otherAgent.get(`/api/projects/${project.body.data._id}`).expect(404);
  await otherAgent.patch(`/api/projects/${project.body.data._id}`).send({ title: 'Not yours' }).expect(404);
  await otherAgent.get(`/api/design-assets/${projectImage._id}`).expect(404);
  await otherAgent.delete(`/api/projects/${project.body.data._id}`).expect(404);
  await otherAgent.post('/api/auth/delete-account-request').send({ email: 'rohan@example.com', password: 'incorrect-password' }).expect(401);
  await otherAgent.post('/api/auth/delete-account-request').send({ email: 'rohan@example.com', password: 'thoughtful-home-2026' }).expect(200);
  await otherAgent.get('/api/auth/me').expect(401);
  assert.equal(await DesignAsset.countDocuments({ ownerId: secondSignup.body.user.id }), 0);
  const sessionCollection = await app.locals.sessionStore.collectionP;
  assert.equal(await sessionCollection.countDocuments({ session: { $regex: `"userId":"${secondSignup.body.user.id}"` } }), 0);

  await agent.post('/api/auth/logout').set('Origin', frontendOrigin).expect(200);
  await agent.get('/api/auth/me').expect(401);
  await agent.get('/api/projects').expect(401);

  await agent.post('/api/auth/login').send({ email: 'ananya@example.com', password: 'wrong-password' }).expect(401);
  const login = await agent.post('/api/auth/login').set('Origin', frontendOrigin).send({ email: 'ANANYA@example.com', password: 'sunlit-home-2026' }).expect(200);
  assert.equal(login.headers['access-control-allow-origin'], frontendOrigin);
  assert.equal(login.body.user.id, signup.body.user.id);
  assert.notEqual(login.headers['set-cookie'][0].split(';')[0], signupSessionCookie);
  await agent.get('/api/projects').expect(200);

  // Signup and login share the same IP window, so account creation attempts above
  // have already consumed most of the eight-request allowance.
  for (let attempt = 0; attempt < 1; attempt += 1) {
    await agent.post('/api/auth/login').send({ email: 'ananya@example.com', password: 'wrong-password' }).expect(401);
  }
  const limited = await agent.post('/api/auth/login').send({ email: 'ananya@example.com', password: 'wrong-password' }).expect(429);
  assert.match(limited.body.error, /Too many sign-in attempts/);
  await agent.delete(`/api/projects/${project.body.data._id}`).expect(200);
  await agent.get(`/api/design-assets/${projectImage._id}`).expect(404);

  let finishGeneration;
  let notifyGenerationStarted;
  const generationStarted = new Promise((resolve) => { notifyGenerationStarted = resolve; });
  app.locals.imageGenerator = () => new Promise((resolve) => { finishGeneration = resolve; notifyGenerationStarted(); });
  const pendingGeneration = agent.post('/api/designs')
    .field({ ...designFields, projectId: design.body.data.projectId })
    .attach('image', imageBuffer, { filename: 'room.png', contentType: 'image/png' });
  const pendingResponse = pendingGeneration.then((response) => response);
  await generationStarted;
  await agent.delete('/api/auth/account').send({ password: 'sunlit-home-2026' }).expect(200);
  finishGeneration({ imageBuffer: await sharp(imageBuffer).jpeg().toBuffer(), model: 'test-image-model' });
  assert.equal((await pendingResponse).status, 401);
  await agent.get('/api/auth/me').expect(401);
  assert.equal(await DesignAsset.countDocuments({ ownerId: signup.body.user.id }), 0);
  assert.equal(await sessionCollection.countDocuments({ session: { $regex: `"userId":"${signup.body.user.id}"` } }), 0);
});
