// Fischer — client-side form validation for the login and register pages.
// Milestone 1: validates input in the browser only. In Milestone 2 these forms
// will send their data to the back-end API, which validates again on the server.

function setError(id, message) {
  const input = document.getElementById(id);
  const error = document.getElementById(id + '-error');
  if (error) error.textContent = message;
  if (input) input.classList.toggle('invalid', Boolean(message));
  return !message;
}

function showMessage(id, text) {
  const box = document.getElementById(id);
  box.textContent = text;
  box.classList.add('show');
}

// ---------- Login ----------
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const identifier = loginForm.identifier.value.trim();
    const password = loginForm.password.value;

    const ok = [
      setError('identifier', identifier ? '' : 'Enter your username or email.'),
      setError('password', password ? '' : 'Enter your password.'),
    ].every(Boolean);

    if (ok) {
      showMessage('login-message', 'Looks good! Logging in will be connected to the server in Milestone 2.');
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

  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
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

    if (ok) {
      showMessage('register-message', 'Looks good! Account creation will be connected to the server in Milestone 2.');
    }
  });
}
