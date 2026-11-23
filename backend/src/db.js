// Connects to MongoDB on the database VM and makes sure the indexes exist.

const { MongoClient } = require('mongodb');

async function connectDatabase(uri, dbName) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(dbName);

  const users = db.collection('users');
  const sessions = db.collection('sessions');

  // Unique indexes: no two accounts can share a username (case-insensitive) or email.
  await users.createIndex({ usernameLower: 1 }, { unique: true });
  await users.createIndex({ email: 1 }, { unique: true });

  // Sessions: look up by token hash; MongoDB deletes them automatically once expiresAt passes.
  await sessions.createIndex({ tokenHash: 1 }, { unique: true });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  return { client, users, sessions };
}

// Shows where we're connecting without printing the password.
function describeUri(uri) {
  try {
    const url = new URL(uri);
    return `${url.hostname}:${url.port || 27017}${url.pathname}`;
  } catch {
    return '(unparseable MONGO_URI)';
  }
}

module.exports = { connectDatabase, describeUri };
