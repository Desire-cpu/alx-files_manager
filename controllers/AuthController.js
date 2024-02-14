import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(request, response) {
    const authData = request.header('Authorization');

    if (!authData || !authData.startsWith('Basic ')) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const encodedCredentials = authData.split(' ')[1];
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('ascii');
    const [email, password] = decodedCredentials.split(':');

    if (!email || !password) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const hashedPassword = sha1(password);

    try {
      const user = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

      if (user) {
        const token = uuidv4();
        const key = `auth_${token}`;
        await redisClient.set(key, user._id.toString(), 60 * 60 * 24);
        response.status(200).json({ token });
      } else {
        response.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      console.error('Error in getConnect:', error);
      response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getDisconnect(request, response) {
    const token = request.header('X-Token');

    if (!token) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const key = `auth_${token}`;

    try {
      const id = await redisClient.get(key);

      if (id) {
        await redisClient.del(key);
        response.status(204).json({});
      } else {
        response.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      console.error('Error in getDisconnect:', error);
      response.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = AuthController;
