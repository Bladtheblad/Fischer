// Fischer — dashboard. Only shown to logged-in users: asks the API who is
// logged in, and sends anyone without a valid session back to the login page.

async function loadDashboard() {
  let res;
  try {
    res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  } catch {
    document.body.insertAdjacentHTML('afterbegin',
      '<p class="banner error">Can\'t reach the server. Check that the back-end VM is running.</p>');
    return;
  }

  if (res.status === 401) {
    window.location.replace('login.html');
    return;
  }

  const { user } = await res.json();
  document.getElementById('first-name').textContent = user.firstName;
  document.getElementById('nav-user').textContent = '@' + user.username;
  document.getElementById('account-name').textContent = `${user.firstName} ${user.lastName}`;
  document.getElementById('account-username').textContent = user.username;
  document.getElementById('account-email').textContent = user.email;
  document.getElementById('account-since').textContent = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  document.getElementById('dashboard').hidden = false;
}

document.getElementById('logout-button').addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.href = 'login.html';
  }
});

loadDashboard();
