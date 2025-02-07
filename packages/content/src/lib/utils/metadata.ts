import sharp from 'sharp';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ContentMetadata } from '../types';

export async function extractMetadata(file: File | Blob): Promise<ContentMetadata> {
  const metadata: ContentMetadata = {
    size: file.size,
    format: file.type,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  if (file instanceof File) {
    metadata.title = file.name;
  }

  try {
    if (file.type.startsWith('image/')) {
      const imageMetadata = await extractImageMetadata(file);
      Object.assign(metadata, imageMetadata);
    } else if (file.type.startsWith('video/')) {
      const videoMetadata = await extractVideoMetadata(file);
      Object.assign(metadata, videoMetadata);
    } else if (file.type.startsWith('audio/')) {
      const audioMetadata = await extractAudioMetadata(file);
      Object.assign(metadata, audioMetadata);
    }
  } catch (error) {
    console.error('Error extracting metadata:', error);
  }

  return metadata;
}

async function extractImageMetadata(file: File | Blob): Promise<Partial<ContentMetadata>> {
  const buffer = await file.arrayBuffer();
  const image = sharp(buffer);
  const metadata = await image.metadata();

  return {
    dimensions: {
      width: metadata.width,
      height: metadata.height
    },
    format: metadata.format,
    ...(metadata.exif && { location: extractGPSFromEXIF(metadata.exif) })
  };
}

async function extractVideoMetadata(file: File | Blob): Promise<Partial<ContentMetadata>> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  const inputPath = 'input' + getFileExtension(file);
  await ffmpeg.writeFile(inputPath, await fetchFile(file));

  // Get video information using FFprobe
  const info = await ffmpeg.exec([
    '-i', inputPath,
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams'
  ]);

  const metadata = JSON.parse(new TextDecoder().decode(info));
  const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
  const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');

  return {
    dimensions: videoStream ? {
      width: parseInt(videoStream.width),
      height: parseInt(videoStream.height)
    } : undefined,
    duration: metadata.format.duration ? parseFloat(metadata.format.duration) : undefined,
    encoding: videoStream?.codec_name,
    format: metadata.format.format_name
  };
}

async function extractAudioMetadata(file: File | Blob): Promise<Partial<ContentMetadata>> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  const inputPath = 'input' + getFileExtension(file);
  await ffmpeg.writeFile(inputPath, await fetchFile(file));

  // Get audio information using FFprobe
  const info = await ffmpeg.exec([
    '-i', inputPath,
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams'
  ]);

  const metadata = JSON.parse(new TextDecoder().decode(info));
  const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');

  return {
    duration: metadata.format.duration ? parseFloat(metadata.format.duration) : undefined,
    encoding: audioStream?.codec_name,
    format: metadata.format.format_name
  };
}

function extractGPSFromEXIF(exif: Buffer): ContentMetadata['location'] | undefined {
  try {
    // This is a simplified example. In reality, you'd use a proper EXIF parsing library
    const exifData = JSON.parse(exif.toString());
    if (exifData.GPSLatitude && exifData.GPSLongitude) {
      return {
        latitude: convertGPSToDecimal(exifData.GPSLatitude, exifData.GPSLatitudeRef),
        longitude: convertGPSToDecimal(exifData.GPSLongitude, exifData.GPSLongitudeRef)
      };
    }
  } catch {
    return undefined;
  }
}

function convertGPSToDecimal(gps: [number, number, number], ref: string): number {
  const decimal = gps[0] + gps[1] / 60 + gps[2] / 3600;
  return ref === 'S' || ref === 'W' ? -decimal : decimal;
}

function getFileExtension(file: File | Blob): string {
  if (file instanceof File) {
    return '.' + file.name.split('.').pop();
  }
  const type = file.type.split('/')[1];
  return type ? '.' + type : '';
} 