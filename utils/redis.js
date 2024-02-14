import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient().on('error', error => console.log(`Redis client not connected to server: ${error}`));
  }

  isAlive = () => this.client.connected;

  async get(key) {
    return promisify(this.client.get).bind(this.client)(key);
  }

  async set(key, value, time) {
    const redisSet = promisify(this.client.set).bind(this.client);
    await redisSet(key, value);
    await promisify(this.client.expire).bind(this.client)(key, time);
  }

  async del(key) {
    return promisify(this.client.del).bind(this.client)(key);
  }
}

export default new RedisClient();
