import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  // Endpoint: GET /status
  // Description: Check the status of Redis and the DB, and respond with their availability.
  static getStatus(request, response) {
    // Check if Redis and the DB are alive
    const redisIsAlive = redisClient.isAlive();
    const dbIsAlive = dbClient.isAlive();

    // Return the response with a status code 200
    response.status(200).json({ redis: redisIsAlive, db: dbIsAlive });
  }

  // Endpoint: GET /stats
  // Description: Retrieve statistics such as the number of users and files in the DB.
  static async getStats(request, response) {
    // Get the number of users in the DB
    const numUsers = await dbClient.nbUsers();
    // Get the number of files in the DB
    const numFiles = await dbClient.nbFiles();

    // Return the response with a status code 200
    response.status(200).json({ users: numUsers, files: numFiles });
  }
}

module.exports = AppController;
