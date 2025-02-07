import sharp from 'sharp';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ProcessingOptions } from '../types';

export async function generateThumbnail(
  file: File | Blob,
  type: ProcessingOptions['type'],
  options: ProcessingOptions['thumbnailOptions'] = {
    width: 320,
    height: 180,
    quality: 70
  }
): Promise<Blob> {
  if (type === 'image') {
    return generateImageThumbnail(file, options);
  } else if (type === 'video') {
    return generateVideoThumbnail(file, options);
  } else {
    throw new Error(`Thumbnail generation not supported for type: ${type}`);
  }
}

async function generateImageThumbnail(
  file: File | Blob,
  options: NonNullable<ProcessingOptions['thumbnailOptions']>
): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const thumbnail = await sharp(buffer)
    .resize(options.width, options.height, {
      fit: 'cover',
      position: 'centre'
    })
    .jpeg({
      quality: options.quality,
      progressive: true,
      optimizeCoding: true,
      mozjpeg: true
    })
    .toBuffer();

  return new Blob([thumbnail], { type: 'image/jpeg' });
}

async function generateVideoThumbnail(
  file: File | Blob,
  options: NonNullable<ProcessingOptions['thumbnailOptions']>
): Promise<Blob> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  const inputPath = 'input' + getFileExtension(file);
  const outputPath = 'thumbnail.jpg';

  await ffmpeg.writeFile(inputPath, await fetchFile(file));

  // Get video duration
  const info = await ffmpeg.exec([
    '-i', inputPath,
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format'
  ]);

  const metadata = JSON.parse(new TextDecoder().decode(info));
  const duration = parseFloat(metadata.format.duration);

  // Generate thumbnails at different timestamps
  const timestamps = [
    1, // First second
    Math.floor(duration * 0.25), // 25% through
    Math.floor(duration * 0.5), // Halfway
    Math.floor(duration * 0.75) // 75% through
  ];

  const thumbnails: Buffer[] = [];

  for (const timestamp of timestamps) {
    // Extract frame
    await ffmpeg.exec([
      '-ss', timestamp.toString(),
      '-i', inputPath,
      '-vf', `scale=${options.width}:${options.height}:force_original_aspect_ratio=increase,crop=${options.width}:${options.height}`,
      '-vframes', '1',
      '-q:v', Math.round((100 - options.quality) / 10).toString(), // Convert quality to FFmpeg's scale
      outputPath
    ]);

    const frameData = await ffmpeg.readFile(outputPath);
    thumbnails.push(Buffer.from(frameData));
  }

  // Analyze thumbnails and pick the best one
  const bestThumbnail = await selectBestThumbnail(thumbnails);
  return new Blob([bestThumbnail], { type: 'image/jpeg' });
}

async function selectBestThumbnail(thumbnails: Buffer[]): Promise<Buffer> {
  // Score each thumbnail based on various factors
  const scores = await Promise.all(thumbnails.map(async thumbnail => {
    const image = sharp(thumbnail);
    const stats = await image.stats();
    const metadata = await image.metadata();

    // Calculate entropy (image complexity)
    const entropy = calculateEntropy(stats.channels[0].histogram);

    // Calculate brightness
    const brightness = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / stats.channels.length;

    // Calculate contrast
    const contrast = stats.channels.reduce((sum, channel) => sum + channel.stdev, 0) / stats.channels.length;

    // Combine scores (you can adjust weights based on importance)
    return entropy * 0.4 + // Favor complex images
           (brightness >= 30 && brightness <= 220 ? 1 : 0) * 0.3 + // Avoid too dark/bright images
           contrast * 0.3; // Favor high contrast images
  }));

  // Return the thumbnail with the highest score
  const bestIndex = scores.indexOf(Math.max(...scores));
  return thumbnails[bestIndex];
}

function calculateEntropy(histogram: number[]): number {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  let entropy = 0;

  for (const count of histogram) {
    if (count === 0) continue;
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

function getFileExtension(file: File | Blob): string {
  if (file instanceof File) {
    return '.' + file.name.split('.').pop();
  }
  const type = file.type.split('/')[1];
  return type ? '.' + type : '';
} 