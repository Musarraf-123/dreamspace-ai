import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAllowedOrigins } from '../src/config/origins.js';

test('development permits the exact local Vite origins and one configured loopback origin', () => {
  const origins = resolveAllowedOrigins({ nodeEnv: 'development', devClientOrigin: 'http://localhost:5400' });
  assert.ok(origins.includes('http://localhost:5174'));
  assert.ok(origins.includes('http://localhost:5400'));
  assert.ok(!origins.includes('http://localhost:5401'));
  const originsWithLegacyConfig = resolveAllowedOrigins({ nodeEnv: 'development', clientOrigin: 'http://localhost:5173' });
  assert.ok(originsWithLegacyConfig.includes('http://localhost:5174'));
  const originsWithCapacitorConfig = resolveAllowedOrigins({
    nodeEnv: 'development',
    clientOrigin: 'http://localhost:5173,capacitor://localhost,https://localhost',
  });
  assert.ok(originsWithCapacitorConfig.includes('capacitor://localhost'));
});

test('custom development origins must be exact localhost or IPv4 loopback origins', () => {
  for (const devClientOrigin of ['https://localhost:5400', 'http://example.com:5400', 'http://localhost:5400/path', '*']) {
    assert.throws(() => resolveAllowedOrigins({ nodeEnv: 'development', devClientOrigin }), /DEV_CLIENT_ORIGIN/);
  }
  assert.throws(() => resolveAllowedOrigins({ nodeEnv: 'development', clientOrigin: '*' }), /exact origin/);
});

test('production requires exact HTTPS CLIENT_ORIGIN values and ignores development overrides', () => {
  assert.throws(() => resolveAllowedOrigins({ nodeEnv: 'production' }), /CLIENT_ORIGIN/);
  assert.throws(() => resolveAllowedOrigins({ nodeEnv: 'production', clientOrigin: 'http://localhost:5174' }), /HTTPS origin/);
  assert.throws(() => resolveAllowedOrigins({ nodeEnv: 'production', clientOrigin: 'https://example.com/path' }), /HTTPS origin/);
  const origins = resolveAllowedOrigins({
    nodeEnv: 'production',
    clientOrigin: 'https://app.example.com',
    devClientOrigin: 'http://localhost:5174',
  });
  assert.deepEqual(origins, ['https://app.example.com']);
});
