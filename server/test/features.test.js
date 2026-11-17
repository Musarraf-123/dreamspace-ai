import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../src/models/User.js';
import Enquiry from '../src/models/Enquiry.js';
import DesignAsset from '../src/models/DesignAsset.js';
import { verifyGoogleCredential } from '../src/routes/auth.js';
import { normalizeLayout, parseSpaceAnalysis } from '../src/services/spaceAnalysis.js';
import { seedCatalog } from '../src/services/catalogSeed.js';

let mongo;
let server;
let app;
const googleClientId = 'test-client.apps.googleusercontent.com';

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-features';
  process.env.GOOGLE_CLIENT_ID = googleClientId;
  process.env.OPENAI_API_KEY = '';
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
  await User.init();
  ({ default: app } = await import('../src/app.js'));
  server = app.listen(0, '127.0.0.1');
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (app?.locals?.sessionStore) await app.locals.sessionStore.close();
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

const payload = {
  iss: 'https://accounts.google.com',
  aud: googleClientId,
  email_verified: 'true',
  sub: 'google-sub-1',
  email: 'Gita@Example.com',
  name: 'Gita Rao',
};
const tokenResponse = (body) => async () => ({ ok: true, json: async () => body });

test('verifies Google credentials server-side and rejects bad issuers, audiences and responses', async () => {
  const profile = await verifyGoogleCredential('credential-value-long-enough', { fetchImpl: tokenResponse(payload) });
  assert.deepEqual(profile, { googleId: 'google-sub-1', email: 'gita@example.com', name: 'Gita Rao' });
  await assert.rejects(verifyGoogleCredential('credential-value-long-enough', { clientId: '' }), /not configured/);
  await assert.rejects(verifyGoogleCredential('credential-value-long-enough', { fetchImpl: tokenResponse({ ...payload, aud: 'another-client' }) }), /rejected/);
  await assert.rejects(verifyGoogleCredential('credential-value-long-enough', { fetchImpl: tokenResponse({ ...payload, iss: 'https://evil.example' }) }), /rejected/);
  await assert.rejects(verifyGoogleCredential('credential-value-long-enough', { fetchImpl: tokenResponse({ ...payload, email_verified: 'false' }) }), /rejected/);
  await assert.rejects(verifyGoogleCredential('credential-value-long-enough', { fetchImpl: async () => { throw new Error('offline'); } }), /could not be reached/);
});

test('Google sign-in creates a reusable account, links an email account, and deletes with email confirmation', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = tokenResponse(payload);
  try {
    const agent = request.agent(server);
    const first = await agent.post('/api/auth/google').send({ credential: 'g'.repeat(30) }).expect(200);
    assert.equal(first.body.user.email, 'gita@example.com');
    assert.equal(first.body.user.hasPassword, false);
    assert.equal((await agent.get('/api/auth/me').expect(200)).body.user.id, first.body.user.id);

    const repeated = await request(server).post('/api/auth/google').send({ credential: 'g'.repeat(30) }).expect(200);
    assert.equal(repeated.body.user.id, first.body.user.id);

    const passwordLogin = await request(server).post('/api/auth/login').send({ email: 'gita@example.com', password: 'anything-2026' }).expect(401);
    assert.match(passwordLogin.body.error, /Google sign-in/);

    await agent.delete('/api/auth/account').send({ confirmEmail: 'wrong@example.com' }).expect(401);
    await agent.delete('/api/auth/account').send({ confirmEmail: 'gita@example.com' }).expect(200);
    await agent.get('/api/auth/me').expect(401);
    assert.equal(await User.countDocuments({ email: 'gita@example.com' }), 0);

    const localAgent = request.agent(server);
    const existing = await localAgent.post('/api/auth/signup').send({
      name: 'Riya Shah', email: 'riya@example.com', password: 'sunlit-home-2026', termsAccepted: true, privacyAcknowledged: true,
    }).expect(201);
    globalThis.fetch = tokenResponse({ ...payload, sub: 'google-sub-2', email: 'riya@example.com', name: 'Riya Shah' });
    const linked = await request(server).post('/api/auth/google').send({ credential: 'h'.repeat(30) }).expect(200);
    assert.equal(linked.body.user.id, existing.body.user.id);
    assert.equal(linked.body.user.hasPassword, true);
    assert.equal((await User.findById(existing.body.user.id)).googleId, 'google-sub-2');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns a dated material catalogue with tier filtering and validates the query', async () => {
  const fallback = await request(server).get('/api/catalog?city=Pune&quality=Standard').expect(200);
  assert.equal(fallback.body.data.effectiveDate, '2026-11-01');
  assert.ok(fallback.body.data.categories.length > 0);
  assert.ok(fallback.body.data.materials.length > 0);
  assert.ok(fallback.body.data.materials.every((material) => material.tier !== 'Premium' && material.rate > 0));

  await seedCatalog();
  const seeded = await request(server).get('/api/catalog?city=Mumbai&quality=Premium').expect(200);
  assert.equal(seeded.body.data.effectiveDate, '2026-11-01');
  assert.ok(seeded.body.data.materials.some((material) => material.tier === 'Premium'));
  assert.ok(seeded.body.data.categories.every((category) => category.key && category.rate > 0));

  await request(server).get('/api/catalog?city=Atlantis&quality=Standard').expect(400);
  await request(server).get('/api/catalog?city=Pune&quality=Luxury').expect(400);
});

test('normalizes space-analysis JSON and clips counts', () => {
  assert.equal(normalizeLayout('Open-plan kitchen'), 'Open plan');
  assert.equal(normalizeLayout('l shape'), 'L-shaped');
  assert.equal(normalizeLayout('unknown'), 'Not sure');
  const parsed = parseSpaceAnalysis('```json\n{"roomType":" Kitchen ","layout":"U shape","doors":"4.6","windows":99,"notes":"Skylight over the island."}\n```');
  assert.deepEqual(parsed, { roomType: 'Kitchen', layout: 'U-shaped', doors: 5, windows: 20, notes: 'Skylight over the island.' });
  assert.equal(parseSpaceAnalysis('{"doors":-4,"windows":"many"}').doors, 0);
  assert.throws(() => parseSpaceAnalysis('not json'), /not valid JSON/);
});

test('space analysis and reference uploads require auth, ownership and a configured service', async () => {
  const owner = request.agent(server);
  const signup = await owner.post('/api/auth/signup').send({
    name: 'Asha Nair', email: 'asha@example.com', password: 'sunlit-home-2026', termsAccepted: true, privacyAcknowledged: true,
  }).expect(201);
  const image = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#ded8cb' } }).jpeg().toBuffer();

  await request(server).post('/api/designs/analyze').attach('image', image, { filename: 'room.jpg', contentType: 'image/jpeg' }).expect(401);
  const unavailable = await owner.post('/api/designs/analyze').attach('image', image, { filename: 'room.jpg', contentType: 'image/jpeg' }).expect(503);
  assert.match(unavailable.body.error, /temporarily unavailable|manual/i);

  const project = await owner.post('/api/projects').send({ title: 'Kitchen refresh', type: 'interior', room: 'Kitchen' }).expect(201);
  const reference = await owner.post(`/api/projects/${project.body.data._id}/reference`).attach('image', image, { filename: 'reference.jpg', contentType: 'image/jpeg' }).expect(200);
  assert.ok(reference.body.data.referenceAssetId);
  const savedProject = await owner.get(`/api/projects/${project.body.data._id}`).expect(200);
  assert.equal(savedProject.body.data.referenceAssetId, reference.body.data.referenceAssetId);
  assert.equal((await DesignAsset.findOne({ _id: reference.body.data.referenceAssetId, ownerId: signup.body.user.id })).kind, 'reference');

  const outsider = request.agent(server);
  await outsider.post('/api/auth/signup').send({ name: 'Vikram Rao', email: 'vikram@example.com', password: 'sunlit-home-2026', termsAccepted: true, privacyAcknowledged: true }).expect(201);
  await outsider.post(`/api/projects/${project.body.data._id}/reference`).attach('image', image, { filename: 'reference.jpg', contentType: 'image/jpeg' }).expect(404);
});

test('records contractor enquiries with validation and project ownership checks', async () => {
  const owner = request.agent(server);
  const signup = await owner.post('/api/auth/signup').send({
    name: 'Neha Kulkarni', email: 'neha@example.com', password: 'sunlit-home-2026', termsAccepted: true, privacyAcknowledged: true,
  }).expect(201);
  const project = await owner.post('/api/projects').send({ title: 'Bathroom renovation', type: 'renovation', room: 'Bathroom' }).expect(201);
  const enquiry = { projectId: project.body.data._id, name: 'Neha Kulkarni', phone: '98765 43210', city: 'Pune', message: 'Please visit for a bathroom renovation quote.' };

  await request(server).post('/api/enquiries').send(enquiry).expect(401);
  await owner.post('/api/enquiries').send({ ...enquiry, phone: 'abc' }).expect(400);
  await owner.post('/api/enquiries').send({ ...enquiry, message: 'hi' }).expect(400);
  const created = await owner.post('/api/enquiries').send(enquiry).expect(201);
  assert.equal(created.body.data.status, 'new');
  assert.equal(await Enquiry.countDocuments({ userId: signup.body.user.id }), 1);

  const outsider = request.agent(server);
  await outsider.post('/api/auth/signup').send({ name: 'Karan Bose', email: 'karan@example.com', password: 'sunlit-home-2026', termsAccepted: true, privacyAcknowledged: true }).expect(201);
  await outsider.post('/api/enquiries').send(enquiry).expect(404);
});
