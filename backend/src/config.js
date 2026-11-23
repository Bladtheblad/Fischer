// Reads settings from environment variables.
// On the back-end VM these come from /etc/fischer/api.env (loaded by systemd).

function loadConfig(env = process.env) {
  const config = {
    host: env.HOST || '0.0.0.0',
    port: Number(env.PORT || 3000),
    mongoUri: env.MONGO_URI,
    dbName: env.DB_NAME || 'fischer',
    // Only trust X-Forwarded-For from the front-end VM's nginx reverse proxy.
    trustProxy: env.TRUST_PROXY || '10.10.0.10',
    sessionDays: Number(env.SESSION_DAYS || 7),
    // Set to "true" once the site is served over HTTPS.
    secureCookies: env.SECURE_COOKIES === 'true',
  };

  if (!config.mongoUri) {
    throw new Error('MONGO_URI is not set. Add it to /etc/fischer/api.env on the back-end VM.');
  }
  return config;
}

module.exports = { loadConfig };
