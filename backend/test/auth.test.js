// Automated tests for the auth API. Run with: npm test

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createFakeDb } = require('./fakeDb');

let server;
let base;
let db;

before(async () => {
  db = createFakeDb();
  const app = createApp({
    ...db,
    config: { trustProxy: 'loopback', sessionDays: 7, secureCookies: false },
  });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => server.close());

function post(path, body, headers = {}) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const alice = {
  firstName: 'Alice',
  lastName: 'Grinder',
  username: 'alice_poker',
  email: 'Alice@Example.com',
  password: 'river4ever',
};

let sessionCookie;

test('health check responds', async () => {
  const res = await fetch(base + '/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
});

test('register creates an account and stores only a hash', async () => {
  const res = await post('/auth/register', alice);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.user.username, 'alice_poker');
  assert.equal(body.user.email, 'alice@example.com');
  assert.equal(body.user.passwordHash, undefined, 'hash must never be sent to the browser');

  const stored = db.users.docs.find((u) => u.username === 'alice_poker');
  assert.ok(stored.passwordHash.startsWith('scrypt$'));
  assert.ok(!stored.passwordHash.includes(alice.password), 'plaintext password must not be stored');
});

test('register rejects a duplicate username (any capitalization) and email', async () => {
  const res = await post('/auth/register', { ...alice, username: 'ALICE_POKER', email: 'other@example.com' });
  assert.equal(res.status, 409);
  assert.ok((await res.json()).fields.username);

  const res2 = await post('/auth/register', { ...alice, username: 'someone_else', email: 'alice@example.com' });
  assert.equal(res2.status, 409);
  assert.ok((await res2.json()).fields.email);
});

test('register validates every field', async () => {
  const res = await post('/auth/register', { firstName: '', lastName: 'X', username: 'a', email: 'nope', password: 'short' });
  assert.equal(res.status, 400);
  const { fields } = await res.json();
  assert.ok(fields.firstName && fields.username && fields.email && fields.password);
});

test('NoSQL injection attempts are rejected', async () => {
  const res = await post('/auth/login', { identifier: { $gt: '' }, password: { $gt: '' } });
  assert.equal(res.status, 400);

  const res2 = await post('/auth/register', { ...alice, username: { $ne: null }, email: { $ne: null } });
  assert.equal(res2.status, 400);
});

test('malformed JSON gets a 400, not a crash', async () => {
  const res = await post('/auth/login', '{"identifier": ');
  assert.equal(res.status, 400);
});

test('login fails with the wrong password', async () => {
  const res = await post('/auth/login', { identifier: 'alice_poker', password: 'wrongpass1' });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('login fails the same way for a username that does not exist', async () => {
  const res = await post('/auth/login', { identifier: 'nobody_here', password: 'whatever1' });
  assert.equal(res.status, 401);
});

test('login works with username (any capitalization) and sets an HttpOnly cookie', async () => {
  const res = await post('/auth/login', { identifier: 'Alice_Poker', password: alice.password });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /fischer_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  sessionCookie = cookie.split(';')[0];

  const token = sessionCookie.split('=')[1];
  const storedSession = db.sessions.docs[0];
  assert.notEqual(storedSession.tokenHash, token, 'only a hash of the token is stored');
});

test('login works with email', async () => {
  const res = await post('/auth/login', { identifier: 'ALICE@example.com', password: alice.password });
  assert.equal(res.status, 200);
});

test('/me returns the logged-in user, and 401 without a session', async () => {
  const res = await fetch(base + '/auth/me', { headers: { Cookie: sessionCookie } });
  assert.equal(res.status, 200);
  const { user } = await res.json();
  assert.equal(user.firstName, 'Alice');
  assert.equal(user.passwordHash, undefined);

  const anon = await fetch(base + '/auth/me');
  assert.equal(anon.status, 401);

  const forged = await fetch(base + '/auth/me', { headers: { Cookie: 'fischer_session=made-up-token' } });
  assert.equal(forged.status, 401);
});

test('logout ends the session', async () => {
  const res = await post('/auth/logout', {}, { Cookie: sessionCookie });
  assert.equal(res.status, 200);
  const after = await fetch(base + '/auth/me', { headers: { Cookie: sessionCookie } });
  assert.equal(after.status, 401);
});

test('login is rate-limited after 10 attempts', async () => {
  // Earlier tests already used some attempts from this IP; keep going until blocked.
  let status;
  for (let i = 0; i < 12; i++) {
    status = (await post('/auth/login', { identifier: 'alice_poker', password: 'wrongpass1' })).status;
  }
  assert.equal(status, 429);
});

test('unknown API routes return JSON 404', async () => {
  const res = await fetch(base + '/nope');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'Not found.');
});
