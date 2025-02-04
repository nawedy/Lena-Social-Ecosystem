import { Bucket, Storage } from '@google-cloud/storage';
import { NextFunction, Request } from 'express';
import multer, { FileFilterCallback, Multer } from 'multer';

import { config } from '../config';

// Initialize Google Cloud Storage
const storage: Storage = new Storage({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.keyFilePath,
});

const bucket: Bucket = storage.bucket(config.gcp.storageBucket);

// Configure multer storage as a constant
const multerStorage: multer.StorageEngine = multer.memoryStorage();

// Configure file filter for video uploads, we need to check the types
const fileFilter = (file: Express.Multer.File, cb: FileFilterCallback) => {
  // Accept video files only
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'));
  }
};

// Configure upload middleware
const upload: Multer = multer({
  storage: multerStorage, // Correctly using the constant
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

// Middleware to handle file upload to Google Cloud Storage
export const uploadToGCS = async (
  req: Request, next: NextFunction
) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    const blob = bucket.file(`videos/${Date.now()}-${req.file.originalname}`);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    blobStream.on('error', err => {
      next(err);
    });

    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      req.fileUrl = publicUrl;
      next();
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    next(error);
  }
};

// Export configured multer middleware
export const videoUpload = upload.single('video');

// Extend Express Request interface to include fileUrl
declare global {
  namespace Express {
    interface Request {
      fileUrl?: string;
    }
  }
}
