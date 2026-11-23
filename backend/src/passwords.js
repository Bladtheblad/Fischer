// Password hashing with scrypt, which is built into Node.js (no extra library needed).
// Stored format: scrypt$N$r$p$<salt base64>$<hash base64>

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

const N = 16384; // CPU/memory cost
const R = 8; // block size
const P = 1; // parallelism
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  // Constant-time comparison so response timing doesn't leak how close a guess was.
  return crypto.timingSafeEqual(actual, expected);
}

// A real hash of a random password. Login checks against it when the username
// doesn't exist, so "no such user" takes as long as "wrong password".
let dummyHashPromise;
function dummyHash() {
  dummyHashPromise ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHashPromise;
}

module.exports = { hashPassword, verifyPassword, dummyHash };
