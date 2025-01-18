import imageCompression from 'browser-image-compression';
import { BskyAgent, ComAtprotoRepoUploadBlob } from '@atproto/api';

export interface MediaOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  preserveExif?: boolean;
}

export interface MediaPreview {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

export class MediaService {
  private agent: BskyAgent;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  public async processAndUploadImage(
    file: File,
    options: MediaOptions = {}
  ): Promise<{
    preview: MediaPreview;
    blob: ComAtprotoRepoUploadBlob.Response;
  }> {
    // Default options for AT Protocol compatibility
    const defaultOptions: MediaOptions = {
      maxSizeMB: 1,
      maxWidthOrHeight: 2000,
      useWebWorker: true,
      preserveExif: true,
      ...options,
    };

    try {
      // Generate preview
      const preview = await this.generatePreview(file);

      // Compress image
      const compressedFile = await imageCompression(file, defaultOptions);

      // Upload to AT Protocol
      const blob = await this.agent.uploadBlob(compressedFile, {
        encoding: file.type,
      });

      return {
        preview,
        blob,
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }

  private async generatePreview(file: File): Promise<MediaPreview> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = async () => {
        try {
          const { width, height } = this.calculatePreviewDimensions(
            img.width,
            img.height,
            300 // max preview size
          );

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            blob => {
              if (!blob) {
                reject(new Error('Could not generate preview blob'));
                return;
              }

              resolve({
                blob,
                url,
                width,
                height,
              });
            },
            'image/jpeg',
            0.8
          );
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(url);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not load image'));
      };

      img.src = url;
    });
  }

  private calculatePreviewDimensions(
    width: number,
    height: number,
    maxSize: number
  ): { width: number; height: number } {
    if (width <= maxSize && height <= maxSize) {
      return { width, height };
    }

    const ratio = width / height;

    if (ratio > 1) {
      return {
        width: maxSize,
        height: Math.round(maxSize / ratio),
      };
    } else {
      return {
        width: Math.round(maxSize * ratio),
        height: maxSize,
      };
    }
  }

  public async processVideo(file: File): Promise<MediaPreview> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        const { width, height } = this.calculatePreviewDimensions(
          video.videoWidth,
          video.videoHeight,
          300
        );

        video.currentTime = 1; // Get frame from 1 second in

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            ctx.drawImage(video, 0, 0, width, height);

            canvas.toBlob(
              blob => {
                if (!blob) {
                  reject(new Error('Could not generate preview blob'));
                  return;
                }

                resolve({
                  blob,
                  url,
                  width,
                  height,
                });
              },
              'image/jpeg',
              0.8
            );
          } catch (error) {
            reject(error);
          } finally {
            URL.revokeObjectURL(url);
          }
        };
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not load video'));
      };

      video.src = url;
    });
  }
}
