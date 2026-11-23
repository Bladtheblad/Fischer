// Runs the API with the in-memory stand-in database, for trying the front end
// locally without MongoDB. Data is lost when it stops. Not used on the VMs.
//   node test/dev-server.js

const { createApp } = require('../src/app');
const { createFakeDb } = require('./fakeDb');

const port = Number(process.env.PORT || 3000);
const app = createApp({
  ...createFakeDb(),
  config: { trustProxy: 'loopback', sessionDays: 7, secureCookies: false },
});
app.listen(port, '127.0.0.1', () => {
  console.log(`Dev API (in-memory database) on http://127.0.0.1:${port}/api`);
});
