// Login sessions. The browser gets a random token in an HttpOnly cookie; the
// database stores only a SHA-256 hash of it, so a database leak can't be used
// to hijack sessions. MongoDB deletes expired sessions automatically (TTL index).

const crypto = require('node:crypto');

const COOKIE_NAME = 'fischer_session';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(sessions, userId, days) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  await sessions.insertOne({
    tokenHash: hashToken(token),
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
  });
  return token;
}

async function findSession(sessions, token) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 100) return null;
  return sessions.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
}

async function deleteSession(sessions, token) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 100) return;
  await sessions.deleteOne({ tokenHash: hashToken(token) });
}

// Reads one cookie from the Cookie header without extra libraries.
function readCookie(req, name = COOKIE_NAME) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

module.exports = { COOKIE_NAME, createSession, findSession, deleteSession, readCookie };
