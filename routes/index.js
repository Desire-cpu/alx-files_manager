import { Router } from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const router = Router();

// Endpoint: GET /status - Retrieve application status
router.get('/status', AppController.getStatus);

// Endpoint: GET /stats - Retrieve application statistics
router.get('/stats', AppController.getStats);

// Endpoint: POST /users - Create a new user
router.post('/users', UsersController.postNew);

// Endpoint: GET /connect - Connect to the application
router.get('/connect', AuthController.getConnect);

// Endpoint: GET /disconnect - Disconnect from the application
router.get('/disconnect', AuthController.getDisconnect);

// Endpoint: GET /users/me - Retrieve information about the current user
router.get('/users/me', UsersController.getMe);

// Endpoint: POST /files - Upload a new file
router.post('/files', FilesController.postUpload);

// Endpoint: GET /files/:id - Retrieve information about a specific file
router.get('/files/:id', FilesController.getShow);

// Endpoint: GET /files - Retrieve a list of all files
router.get('/files', FilesController.getIndex);

// Endpoint: PUT /files/:id/publish - Publish a specific file
router.put('/files/:id/publish', FilesController.putPublish);

// Endpoint: PUT /files/:id/unpublish - Unpublish a specific file
router.put('/files/:id/unpublish', FilesController.putUnpublish);

// Endpoint: GET /files/:id/data - Retrieve data from a specific file
router.get('/files/:id/data', FilesController.getFile);

module.exports = router;
