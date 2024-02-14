import { MongoClient } from 'mongodb';

const { DB_HOST = 'localhost', DB_PORT = 27017, DB_DATABASE = 'files_manager' } = process.env;
const url = `mongodb://${DB_HOST}:${DB_PORT}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(url, { useUnifiedTopology: true, useNewUrlParser: true });
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db(DB_DATABASE);
    } catch (err) {
      console.error(err);
    }
  }

  isAlive = () => this.client.isConnected();

  async getCollectionCount(collectionName) {
    const collection = this.db.collection(collectionName);
    return await collection.countDocuments();
  }

  async nbUsers() {
    return this.getCollectionCount('users');
  }

  async nbFiles() {
    return this.getCollectionCount('files');
  }
}

export default new DBClient();
