// The Express app: all /api routes. Kept separate from server.js so tests can
// run it against a stand-in database.

const express = require('express');
const { hashPassword, verifyPassword, dummyHash } = require('./passwords');
const { validateRegistration, validateLogin } = require('./validate');
const { COOKIE_NAME, createSession, findSession, deleteSession, readCookie } = require('./sessions');
const { rateLimit } = require('./rateLimit');

const LOGIN_FAILED = 'Incorrect username/email or password.';

function publicUser(user) {
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function createApp({ users, sessions, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Basic request log (method, path, status, time, client IP). Never logs request bodies,
  // so passwords never reach the logs. Output goes to the systemd journal.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms ip=${req.ip}`);
    });
    next();
  });

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use(express.json({ limit: '10kb' }));

  const cookieOptions = {
    httpOnly: true, // JavaScript in the page can't read the session cookie
    sameSite: 'strict', // the cookie isn't sent on requests from other sites (CSRF protection)
    secure: config.secureCookies,
    path: '/',
  };

  // Loads the logged-in user from the session cookie, or answers 401.
  async function requireAuth(req, res, next) {
    const session = await findSession(sessions, readCookie(req));
    if (!session) return res.status(401).json({ error: 'Not logged in.' });
    const user = await users.findOne({ _id: session.userId });
    if (!user) return res.status(401).json({ error: 'Not logged in.' });
    req.user = user;
    next();
  }

  const api = express.Router();

  api.get('/health', (req, res) => {
    res.json({ ok: true, service: 'fischer-api' });
  });

  api.post(
    '/auth/register',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many sign-up attempts. Try again in a few minutes.' }),
    async (req, res) => {
      const { errors, value } = validateRegistration(req.body);
      if (Object.keys(errors).length) {
        return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
      }

      const usernameLower = value.username.toLowerCase();
      const conflicts = {};
      if (await users.findOne({ usernameLower })) conflicts.username = 'That username is taken.';
      if (await users.findOne({ email: value.email })) conflicts.email = 'An account with that email already exists.';
      if (Object.keys(conflicts).length) {
        return res.status(409).json({ error: 'That account already exists.', fields: conflicts });
      }

      const now = new Date();
      const user = {
        firstName: value.firstName,
        lastName: value.lastName,
        username: value.username,
        usernameLower,
        email: value.email,
        passwordHash: await hashPassword(value.password),
        emailVerified: false, // used by email verification in Milestone 3
        createdAt: now,
        lastLoginAt: null,
      };

      try {
        const result = await users.insertOne(user);
        user._id = result.insertedId;
      } catch (err) {
        // Unique indexes catch two sign-ups racing for the same username/email.
        if (err && err.code === 11000) {
          return res.status(409).json({ error: 'That account already exists.' });
        }
        throw err;
      }

      res.status(201).json({ message: 'Account created.', user: publicUser(user) });
    }
  );

  api.post(
    '/auth/login',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Try again in 15 minutes.' }),
    async (req, res) => {
      const { errors, value } = validateLogin(req.body);
      if (Object.keys(errors).length) {
        return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
      }

      const query = value.identifier.includes('@')
        ? { email: value.identifier.toLowerCase() }
        : { usernameLower: value.identifier.toLowerCase() };
      const user = await users.findOne(query);

      // Always run a hash check, even when the user doesn't exist, so the
      // response time doesn't reveal which usernames are registered.
      const ok = await verifyPassword(value.password, user ? user.passwordHash : await dummyHash());
      if (!user || !ok) {
        return res.status(401).json({ error: LOGIN_FAILED });
      }

      const token = await createSession(sessions, user._id, config.sessionDays);
      await users.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: config.sessionDays * 24 * 60 * 60 * 1000 });
      res.json({ message: 'Logged in.', user: publicUser(user) });
    }
  );

  api.post('/auth/logout', async (req, res) => {
    await deleteSession(sessions, readCookie(req));
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.json({ message: 'Logged out.' });
  });

  api.get('/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  api.use((req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  app.use('/api', api);

  // Error handler: bad JSON gets a 400; anything else is logged and gets a generic 500.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request is too large.' });
    }
    console.error(`Error on ${req.method} ${req.originalUrl}:`, err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

module.exports = { createApp, publicUser };
