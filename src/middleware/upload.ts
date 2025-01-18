import { Storage } from '@google-cloud/storage';
import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';

import { config } from '../config';

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.keyFilePath,
});

const bucket = storage.bucket(config.gcp.storageBucket);

// Configure multer storage
const multerStorage = multer.memoryStorage();

// Configure file filter for video uploads
const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  // Accept video files only
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'));
  }
};

// Configure upload middleware
const upload = multer({
  storage: multerStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

// Middleware to handle file upload to Google Cloud Storage
export const uploadToGCS = async (req: Request, _res: Response, next: NextFunction) => {
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

    blobStream.on('error', (err) => {
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
