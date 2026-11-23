// A tiny in-memory stand-in for the MongoDB collections, used only by tests and
// local development. Supports just the operations the app uses.

let nextId = 1;

function matches(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && '$gt' in cond) {
      return value > cond.$gt;
    }
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    return value === cond;
  });
}

class FakeCollection {
  constructor(uniqueFields = []) {
    this.docs = [];
    this.uniqueFields = uniqueFields;
  }

  async insertOne(doc) {
    for (const field of this.uniqueFields) {
      if (this.docs.some((d) => d[field] === doc[field])) {
        const err = new Error(`E11000 duplicate key error: ${field}`);
        err.code = 11000;
        throw err;
      }
    }
    const stored = { _id: `id${nextId++}`, ...doc };
    this.docs.push(stored);
    return { insertedId: stored._id };
  }

  async findOne(filter) {
    const found = this.docs.find((d) => matches(d, filter));
    return found ? { ...found } : null;
  }

  async updateOne(filter, update) {
    const found = this.docs.find((d) => matches(d, filter));
    if (found && update.$set) Object.assign(found, update.$set);
    return { matchedCount: found ? 1 : 0 };
  }

  async deleteOne(filter) {
    const index = this.docs.findIndex((d) => matches(d, filter));
    if (index !== -1) this.docs.splice(index, 1);
    return { deletedCount: index === -1 ? 0 : 1 };
  }
}

function createFakeDb() {
  return {
    users: new FakeCollection(['usernameLower', 'email']),
    sessions: new FakeCollection(['tokenHash']),
  };
}

module.exports = { createFakeDb };
