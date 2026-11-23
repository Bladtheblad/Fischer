// Server-side input validation. The browser validates too, but the server can't
// trust anything it receives, so every field is checked again here.
//
// NoSQL injection protection: every field must be a plain string. A request like
//   { "identifier": { "$gt": "" } }
// is rejected before it can reach a MongoDB query.

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value) {
  return typeof value === 'string' ? value : null;
}

function validateRegistration(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};

  const firstName = str(b.firstName)?.trim() ?? '';
  const lastName = str(b.lastName)?.trim() ?? '';
  const username = str(b.username)?.trim() ?? '';
  const email = str(b.email)?.trim().toLowerCase() ?? '';
  const password = str(b.password) ?? '';

  if (!firstName || firstName.length > 50) errors.firstName = 'Enter your first name (up to 50 characters).';
  if (!lastName || lastName.length > 50) errors.lastName = 'Enter your last name (up to 50 characters).';
  if (!USERNAME_RE.test(username)) errors.username = 'Use 3–20 letters, numbers, or underscores.';
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  if (password.length < 8 || password.length > 128 || !/\d/.test(password)) {
    errors.password = 'Use 8–128 characters, including a number.';
  }

  return {
    errors,
    value: { firstName, lastName, username, email, password },
  };
}

function validateLogin(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};

  const identifier = str(b.identifier)?.trim() ?? '';
  const password = str(b.password) ?? '';

  if (!identifier || identifier.length > 254) errors.identifier = 'Enter your username or email.';
  if (!password || password.length > 128) errors.password = 'Enter your password.';

  return { errors, value: { identifier, password } };
}

module.exports = { validateRegistration, validateLogin };
