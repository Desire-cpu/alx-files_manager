import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { ObjectID } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

class FilesController {
  static async getUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    
    if (userId) {
      const users = dbClient.db.collection('users');
      const idObject = new ObjectID(userId);
      const user = await users.findOne({ _id: idObject });

      return user || null;
    }

    return null;
  }

  static async postUpload(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId, isPublic, data } = request.body;
    
    if (!name || !type || (type !== 'folder' && !data)) {
      return response.status(400).json({ error: 'Invalid input data' });
    }

    const files = dbClient.db.collection('files');
    
    if (parentId) {
      const idObject = new ObjectID(parentId);
      const file = await files.findOne({ _id: idObject, userId: user._id });

      if (!file || file.type !== 'folder') {
        return response.status(400).json({ error: 'Invalid parent folder' });
      }
    }

    try {
      if (type === 'folder') {
        const result = await files.insertOne({
          userId: user._id,
          name,
          type,
          parentId: parentId || 0,
          isPublic,
        });

        return response.status(201).json({
          id: result.insertedId,
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
        });
      } else {
        const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
        const fileName = `${filePath}/${uuidv4()}`;
        const buff = Buffer.from(data, 'base64');

        try {
          await fs.mkdir(filePath);
          await fs.writeFile(fileName, buff, 'utf-8');
        } catch (error) {
          console.error(error);
          return response.status(500).json({ error: 'Internal Server Error' });
        }

        const result = await files.insertOne({
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
          localPath: fileName,
        });

        response.status(201).json({
          id: result.insertedId,
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
        });

        if (type === 'image') {
          fileQueue.add({
            userId: user._id,
            fileId: result.insertedId,
          });
        }
      }
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getShow(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = request.params.id;
    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(fileId);
    const file = await files.findOne({ _id: idObject, userId: user._id });

    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }

    return response.status(200).json(file);
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId, page } = request.query;
    const pageNum = parseInt(page, 10) || 0;
    const files = dbClient.db.collection('files');
    let query = { userId: user._id };

    if (parentId) {
      query = { userId: user._id, parentId: ObjectID(parentId) };
    }

    try {
      const result = await files.aggregate([
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: pageNum } }],
            data: [{ $skip: 20 * pageNum }, { $limit: 20 }],
          },
        },
      ]).toArray();

      if (result && result.length > 0) {
        const final = result[0].data.map((file) => {
          const { _id, localPath, ...rest } = file;
          return { ...rest, id: _id.toString() };
        });

        return response.status(200).json(final);
      } else {
        return response.status(404).json({ error: 'Not found' });
      }
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async updateFileVisibility(request, response, isPublic) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(id);

    try {
      const result = await files.findOneAndUpdate(
        { _id: idObject, userId: user._id },
        { $set: { isPublic } },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        return response.status(404).json({ error: 'Not found' });
      }

      return response.status(200).json(result.value);
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putPublish(request, response) {
    return FilesController.updateFileVisibility(request, response, true);
  }

  static async putUnpublish(request, response) {
    return FilesController.updateFileVisibility(request, response, false);
  }

  static async getFile(request, response) {
    const { id } = request.params;
    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(id);

    try {
      const file = await files.findOne({ _id: idObject });

      if (!file) {
        return response.status(404).json({ error: 'Not found' });
      }

      if (file.isPublic) {
        if (file.type === 'folder') {
          return response.status(400).json({ error: "A folder doesn't have"});
