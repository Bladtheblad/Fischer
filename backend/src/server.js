// Entry point: connect to MongoDB, then start the API.
// On the back-end VM this runs as the systemd service "fischer-api".

const { loadConfig } = require('./config');
const { connectDatabase, describeUri } = require('./db');
const { createApp } = require('./app');

async function main() {
  const config = loadConfig();
  console.log(`Connecting to MongoDB at ${describeUri(config.mongoUri)} ...`);
  const { client, users, sessions } = await connectDatabase(config.mongoUri, config.dbName);
  console.log('Connected to MongoDB.');

  const app = createApp({ users, sessions, config });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Fischer API listening on ${config.host}:${config.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => client.close().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start Fischer API:', err.message);
  process.exit(1); // systemd restarts the service after a few seconds
});
