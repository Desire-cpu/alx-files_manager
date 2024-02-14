import sha1 from 'sha1';
import { ObjectID } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

// Create a Bull queue instance for user-related tasks
const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');

class UsersController {
  // Endpoint: POST /users
  // Description: Create a new user with email and hashed password, and add a task to the user queue.
  static postNew(request, response) {
    const { email, password } = request.body;

    // Check for missing email or password
    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }

    // Access the 'users' collection from the database
    const usersCollection = dbClient.db.collection('users');

    // Check if the user with the provided email already exists
    usersCollection.findOne({ email }, (err, user) => {
      if (user) {
        response.status(400).json({ error: 'User already exists' });
      } else {
        // Hash the password using SHA-1
        const hashedPassword = sha1(password);

        // Insert the new user into the 'users' collection
        usersCollection.insertOne(
          {
            email,
            password: hashedPassword,
          },
        ).then((result) => {
          // Respond with the newly created user's ID and email
          response.status(201).json({ id: result.insertedId, email });

          // Add a task to the user queue
          userQueue.add({ userId: result.insertedId });
        }).catch((error) => console.error(error));
      }
    });
  }

  // Endpoint: GET /users/me
  // Description: Retrieve user information based on the provided token from the request header.
  static async getMe(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;

    // Retrieve the user ID from Redis based on the token
    const userId = await redisClient.get(key);

    if (userId) {
      // Access the 'users' collection from the database
      const usersCollection = dbClient.db.collection('users');
      
      // Convert the user ID to ObjectID for querying the database
      const idObject = new ObjectID(userId);

      // Find the user based on the user ID
      usersCollection.findOne({ _id: idObject }, (err, user) => {
        if (user) {
          // Respond with the user's ID and email
          response.status(200).json({ id: userId, email: user.email });
        } else {
          // Respond with an unauthorized error if the user is not found
          response.status(401).json({ error: 'Unauthorized' });
        }
      });
    } else {
      // Respond with an unauthorized error if the user ID is not found in Redis
      console.error('User ID not found!');
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
}

module.exports = UsersController;
