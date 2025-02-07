import sharp from 'sharp';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import imageCompression from 'browser-image-compression';
import type { ProcessingOptions } from '../types';

export async function optimizeImage(
  file: File | Blob,
  options: ProcessingOptions
): Promise<{ data: Blob; metadata: { width: number; height: number; size: number } }> {
  // First, try browser-based compression for better performance
  if (file instanceof File && file.type.startsWith('image/')) {
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: options.maxSize ? options.maxSize / (1024 * 1024) : 1,
        maxWidthOrHeight: Math.max(options.maxWidth || 1920, options.maxHeight || 1080),
        useWebWorker: true,
        initialQuality: options.quality ? options.quality / 100 : 0.8
      });

      return {
        data: compressed,
        metadata: {
          width: compressed.width || 0,
          height: compressed.height || 0,
          size: compressed.size
        }
      };
    } catch (error) {
      console.warn('Browser-based compression failed, falling back to Sharp:', error);
    }
  }

  // Fall back to Sharp for more advanced optimization
  const buffer = await file.arrayBuffer();
  let pipeline = sharp(buffer);

  // Get original metadata
  const metadata = await pipeline.metadata();

  // Resize if needed
  if (options.maxWidth || options.maxHeight) {
    pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  // Apply format-specific optimizations
  if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
    pipeline = pipeline.jpeg({
      quality: options.quality || 80,
      progressive: true,
      optimizeCoding: true,
      mozjpeg: true
    });
  } else if (metadata.format === 'png') {
    pipeline = pipeline.png({
      quality: options.quality || 80,
      progressive: true,
      palette: true,
      compressionLevel: 9
    });
  } else if (metadata.format === 'webp') {
    pipeline = pipeline.webp({
      quality: options.quality || 80,
      lossless: false,
      nearLossless: true,
      smartSubsample: true
    });
  }

  const optimizedBuffer = await pipeline.toBuffer({ resolveWithObject: true });
  const optimizedBlob = new Blob([optimizedBuffer.data], { type: `image/${metadata.format}` });

  return {
    data: optimizedBlob,
    metadata: {
      width: optimizedBuffer.info.width,
      height: optimizedBuffer.info.height,
      size: optimizedBuffer.info.size
    }
  };
}

export async function optimizeVideo(
  file: File | Blob,
  options: ProcessingOptions
): Promise<{ data: Blob; metadata: { width: number; height: number; size: number; duration: number } }> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  const inputPath = 'input' + getFileExtension(file);
  const outputPath = 'output.mp4';

  await ffmpeg.writeFile(inputPath, await fetchFile(file));

  // Build FFmpeg command for optimization
  const command = [
    '-i', inputPath,
    // Video codec settings
    '-c:v', options.transcoding?.codec || 'libx264',
    '-preset', 'slow', // Better compression
    '-crf', '23', // Constant Rate Factor (18-28 is good)
    // If max dimensions specified, scale video
    ...(options.maxWidth || options.maxHeight ? [
      '-vf', `scale='min(${options.maxWidth || -1},iw)':'min(${options.maxHeight || -1},ih)':force_original_aspect_ratio=decrease`
    ] : []),
    // Frame rate
    ...(options.transcoding?.fps ? ['-r', options.transcoding.fps.toString()] : []),
    // Audio codec settings
    '-c:a', 'aac',
    '-b:a', '128k',
    // Output format
    '-movflags', '+faststart', // Enable streaming
    outputPath
  ];

  await ffmpeg.exec(command);

  // Get optimized video info
  const info = await ffmpeg.exec([
    '-i', outputPath,
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams'
  ]);

  const metadata = JSON.parse(new TextDecoder().decode(info));
  const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');

  const optimizedData = await ffmpeg.readFile(outputPath);
  const optimizedBlob = new Blob([optimizedData], { type: 'video/mp4' });

  return {
    data: optimizedBlob,
    metadata: {
      width: parseInt(videoStream.width),
      height: parseInt(videoStream.height),
      size: optimizedBlob.size,
      duration: parseFloat(metadata.format.duration)
    }
  };
}

export async function optimizeAudio(
  file: File | Blob,
  options: ProcessingOptions
): Promise<{ data: Blob; metadata: { size: number; duration: number } }> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  const inputPath = 'input' + getFileExtension(file);
  const outputPath = 'output.mp3';

  await ffmpeg.writeFile(inputPath, await fetchFile(file));

  // Build FFmpeg command for audio optimization
  const command = [
    '-i', inputPath,
    '-c:a', 'libmp3lame',
    '-q:a', '4', // VBR quality (0-9, lower is better)
    '-map_metadata', '0', // Preserve metadata
    outputPath
  ];

  await ffmpeg.exec(command);

  // Get optimized audio info
  const info = await ffmpeg.exec([
    '-i', outputPath,
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams'
  ]);

  const metadata = JSON.parse(new TextDecoder().decode(info));
  const optimizedData = await ffmpeg.readFile(outputPath);
  const optimizedBlob = new Blob([optimizedData], { type: 'audio/mpeg' });

  return {
    data: optimizedBlob,
    metadata: {
      size: optimizedBlob.size,
      duration: parseFloat(metadata.format.duration)
    }
  };
}

function getFileExtension(file: File | Blob): string {
  if (file instanceof File) {
    return '.' + file.name.split('.').pop();
  }
  const type = file.type.split('/')[1];
  return type ? '.' + type : '';
} 