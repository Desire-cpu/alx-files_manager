import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import { promises as fs } from 'fs';
import { ObjectID } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');
const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');

async function thumbNail(width, localPath) {
  return imageThumbnail(localPath, { width });
}

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  try {
    if (!fileId || !userId) {
      throw new Error('Missing fileId or userId');
    }

    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(fileId);
    const file = await files.findOne({ _id: idObject });

    if (!file) {
      throw new Error('File not found');
    }

    const fileName = file.localPath;
    const [thumbnail500, thumbnail250, thumbnail100] = await Promise.all([
      thumbNail(500, fileName),
      thumbNail(250, fileName),
      thumbNail(100, fileName),
    ]);

    console.log('Writing files to system');
    await Promise.all([
      fs.writeFile(`${file.localPath}_500`, thumbnail500),
      fs.writeFile(`${file.localPath}_250`, thumbnail250),
      fs.writeFile(`${file.localPath}_100`, thumbnail100),
    ]);

    job.moveToCompleted('done', true);
  } catch (error) {
    console.error(error.message);
    job.moveToFailed({ message: error.message }, true);
  }
});

userQueue.process(async (job) => {
  const { userId } = job.data;

  try {
    if (!userId) {
      throw new Error('Missing userId');
    }

    const users = dbClient.db.collection('users');
    const idObject = new ObjectID(userId);
    const user = await users.findOne({ _id: idObject });

    if (user) {
      console.log(`Welcome ${user.email}!`);
      job.moveToCompleted('done', true);
    } else {
      throw new Error('User not found');
    }
  } catch (error) {
    console.error(error.message);
    job.moveToFailed({ message: error.message }, true);
  }
});
