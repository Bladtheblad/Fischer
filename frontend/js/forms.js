// Fischer — login and register forms.
// Validates input in the browser, then sends it to the back-end API through
// nginx (/api/... on the front-end VM is forwarded to the back-end VM).

function setError(id, message) {
  const input = document.getElementById(id);
  const error = document.getElementById(id + '-error');
  if (error) error.textContent = message;
  if (input) input.classList.toggle('invalid', Boolean(message));
  return !message;
}

function showMessage(id, text, type = 'success') {
  const box = document.getElementById(id);
  box.textContent = text;
  box.classList.toggle('error', type === 'error');
  box.classList.add('show');
}

function hideMessage(id) {
  document.getElementById(id).classList.remove('show');
}

// Sends JSON to the API and returns { ok, status, data }.
async function postJson(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Can't reach the server. Check that the back-end VM is running." } };
  }
}

function setBusy(button, busy, busyText) {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.label;
}

// Shows the server's per-field errors next to the matching inputs.
function showFieldErrors(fields, idMap = {}) {
  for (const [field, message] of Object.entries(fields || {})) {
    setError(idMap[field] || field, message);
  }
}

// ---------- Login ----------
const loginForm = document.getElementById('login-form');
if (loginForm) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('registered') === '1') {
    showMessage('login-message', 'Account created! Log in to continue.');
  }

  // Already logged in? Go straight to the dashboard.
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((res) => { if (res.ok) window.location.replace('dashboard.html'); })
    .catch(() => {});

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage('login-message');
    const identifier = loginForm.identifier.value.trim();
    const password = loginForm.password.value;

    const ok = [
      setError('identifier', identifier ? '' : 'Enter your username or email.'),
      setError('password', password ? '' : 'Enter your password.'),
    ].every(Boolean);
    if (!ok) return;

    const button = loginForm.querySelector('button[type=submit]');
    setBusy(button, true, 'Logging in…');
    const result = await postJson('/api/auth/login', { identifier, password });
    setBusy(button, false);

    if (result.ok) {
      window.location.href = 'dashboard.html';
    } else {
      showFieldErrors(result.data.fields);
      showMessage('login-message', result.data.error || 'Login failed. Please try again.', 'error');
      loginForm.password.value = '';
    }
  });
}

// ---------- Register ----------
const registerForm = document.getElementById('register-form');
if (registerForm) {
  const password = document.getElementById('newPassword');
  const meterFill = document.getElementById('meter-fill');
  const strengthText = document.getElementById('strength-text');

  // Scores a password from 0 to 4 for the strength meter.
  function passwordScore(value) {
    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/\d/.test(value) && /[a-zA-Z]/.test(value)) score++;
    if (/[^a-zA-Z0-9]/.test(value) || (/[a-z]/.test(value) && /[A-Z]/.test(value))) score++;
    return score;
  }

  password.addEventListener('input', () => {
    const value = password.value;
    const score = passwordScore(value);
    const levels = [
      { label: 'Too weak', color: '#ff8a7a' },
      { label: 'Weak', color: '#ff8a7a' },
      { label: 'Fair', color: '#d8b25a' },
      { label: 'Good', color: '#9fd88a' },
      { label: 'Strong', color: '#6fd39b' },
    ];
    const level = levels[score];
    meterFill.style.width = value ? `${Math.max(score, 1) * 25}%` : '0';
    meterFill.style.background = level.color;
    strengthText.textContent = value
      ? `${level.label} · at least 8 characters, including a number`
      : 'At least 8 characters, including a number';
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage('register-message');
    const f = registerForm;
    const pw = f.password.value;

    const ok = [
      setError('firstName', f.firstName.value.trim() ? '' : 'Enter your first name.'),
      setError('lastName', f.lastName.value.trim() ? '' : 'Enter your last name.'),
      setError('username', /^[A-Za-z0-9_]{3,20}$/.test(f.username.value.trim())
        ? '' : 'Use 3–20 letters, numbers, or underscores.'),
      setError('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())
        ? '' : 'Enter a valid email address.'),
      setError('newPassword', pw.length >= 8 && /\d/.test(pw)
        ? '' : 'Use at least 8 characters, including a number.'),
      setError('confirmPassword', f.confirmPassword.value === pw && pw
        ? '' : 'Passwords do not match.'),
      setError('terms', f.terms.checked ? '' : 'Please accept the terms to continue.'),
    ].every(Boolean);
    if (!ok) return;

    const button = f.querySelector('button[type=submit]');
    setBusy(button, true, 'Creating account…');
    const result = await postJson('/api/auth/register', {
      firstName: f.firstName.value.trim(),
      lastName: f.lastName.value.trim(),
      username: f.username.value.trim(),
      email: f.email.value.trim(),
      password: pw,
    });
    setBusy(button, false);

    if (result.ok) {
      showMessage('register-message', 'Account created! Taking you to the login page…');
      setTimeout(() => { window.location.href = 'login.html?registered=1'; }, 1200);
    } else {
      // The server calls the password field "password"; on this page its input id is "newPassword".
      showFieldErrors(result.data.fields, { password: 'newPassword' });
      showMessage('register-message', result.data.error || 'Sign-up failed. Please try again.', 'error');
    }
  });
}
