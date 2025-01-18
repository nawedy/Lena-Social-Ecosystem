import multer from 'multer';
import { Storage } from '@google-cloud/storage';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

const storage = new Storage({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.keyFilePath,
});

const bucket = storage.bucket(config.gcp.storageBucket);

const multerStorage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept video files only
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Not a video file! Please upload only videos.'), false);
  }
};

export const upload = multer({
  storage: multerStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});
