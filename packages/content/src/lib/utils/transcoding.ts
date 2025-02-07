import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ProcessingOptions } from '../types';

interface TranscodingResult {
  data: Blob;
  metadata: {
    width?: number;
    height?: number;
    duration: number;
    size: number;
    bitrate: number;
    codec: string;
    format: string;
  };
}

export async function transcodeVideo(
  file: File | Blob,
  options: ProcessingOptions
): Promise<TranscodingResult> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  const inputPath = 'input' + getFileExtension(file);
  const outputPath = 'output.mp4';

  await ffmpeg.writeFile(inputPath, await fetchFile(file));

  // Build FFmpeg command
  const command = [
    '-i', inputPath,
    // Video settings
    '-c:v', options.transcoding?.codec || 'libx264',
    '-preset', 'slow', // Better compression
    '-crf', '23', // Constant Rate Factor (18-28 is good)
    // If max dimensions specified, scale video
    ...(options.maxWidth || options.maxHeight ? [
      '-vf', `scale='min(${options.maxWidth || -1},iw)':'min(${options.maxHeight || -1},ih)':force_original_aspect_ratio=decrease`
    ] : []),
    // Frame rate
    ...(options.transcoding?.fps ? ['-r', options.transcoding.fps.toString()] : []),
    // Bitrate
    ...(options.transcoding?.bitrate ? ['-b:v', `${options.transcoding.bitrate}k`] : []),
    // Audio settings
    '-c:a', 'aac',
    '-b:a', '128k',
    // Output format settings
    '-movflags', '+faststart', // Enable streaming
    '-f', 'mp4', // Force MP4 format
    outputPath
  ];

  // Transcode video
  await ffmpeg.exec(command);

  // Get transcoded video info
  const info = await ffmpeg.exec([
    '-i', outputPath,
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams'
  ]);

  const metadata = JSON.parse(new TextDecoder().decode(info));
  const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
  const format = metadata.format;

  // Read transcoded file
  const data = await ffmpeg.readFile(outputPath);
  const blob = new Blob([data], { type: 'video/mp4' });

  return {
    data: blob,
    metadata: {
      width: videoStream ? parseInt(videoStream.width) : undefined,
      height: videoStream ? parseInt(videoStream.height) : undefined,
      duration: parseFloat(format.duration),
      size: blob.size,
      bitrate: parseInt(format.bit_rate) / 1000, // Convert to kbps
      codec: videoStream?.codec_name || '',
      format: format.format_name
    }
  };
}

export async function transcodeAudio(
  file: File | Blob,
  options: ProcessingOptions
): Promise<TranscodingResult> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  const inputPath = 'input' + getFileExtension(file);
  const outputPath = 'output.mp3';

  await ffmpeg.writeFile(inputPath, await fetchFile(file));

  // Build FFmpeg command
  const command = [
    '-i', inputPath,
    // Audio codec settings
    '-c:a', 'libmp3lame',
    '-q:a', '4', // VBR quality (0-9, lower is better)
    // Bitrate (if specified)
    ...(options.transcoding?.bitrate ? ['-b:a', `${options.transcoding.bitrate}k`] : []),
    // Metadata
    '-map_metadata', '0',
    // Output format
    '-f', 'mp3',
    outputPath
  ];

  // Transcode audio
  await ffmpeg.exec(command);

  // Get transcoded audio info
  const info = await ffmpeg.exec([
    '-i', outputPath,
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams'
  ]);

  const metadata = JSON.parse(new TextDecoder().decode(info));
  const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');
  const format = metadata.format;

  // Read transcoded file
  const data = await ffmpeg.readFile(outputPath);
  const blob = new Blob([data], { type: 'audio/mpeg' });

  return {
    data: blob,
    metadata: {
      duration: parseFloat(format.duration),
      size: blob.size,
      bitrate: parseInt(format.bit_rate) / 1000,
      codec: audioStream?.codec_name || '',
      format: format.format_name
    }
  };
}

export async function generateHLS(
  file: File | Blob,
  options: ProcessingOptions & {
    segmentDuration?: number;
    qualities?: Array<{
      width: number;
      height: number;
      bitrate: number;
    }>;
  }
): Promise<{
  playlist: string;
  segments: Blob[];
  metadata: TranscodingResult['metadata'];
}> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  const inputPath = 'input' + getFileExtension(file);
  const outputPath = 'stream.m3u8';
  const segmentPattern = 'segment_%03d.ts';

  await ffmpeg.writeFile(inputPath, await fetchFile(file));

  // Default qualities if not specified
  const qualities = options.qualities || [
    { width: 1920, height: 1080, bitrate: 5000 }, // 1080p
    { width: 1280, height: 720, bitrate: 2800 },  // 720p
    { width: 854, height: 480, bitrate: 1400 },   // 480p
    { width: 640, height: 360, bitrate: 800 }     // 360p
  ];

  // Create variant streams
  for (const quality of qualities) {
    const variantCommand = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:v', `${quality.bitrate}k`,
      '-b:a', '128k',
      '-vf', `scale=w=${quality.width}:h=${quality.height}:force_original_aspect_ratio=decrease`,
      '-f', 'hls',
      '-hls_time', (options.segmentDuration || 6).toString(),
      '-hls_list_size', '0',
      '-hls_segment_filename', `${quality.height}p_${segmentPattern}`,
      `${quality.height}p_${outputPath}`
    ];

    await ffmpeg.exec(variantCommand);
  }

  // Create master playlist
  let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n';
  for (const quality of qualities) {
    masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bitrate * 1000},RESOLUTION=${quality.width}x${quality.height}\n`;
    masterPlaylist += `${quality.height}p_${outputPath}\n`;
  }

  // Get video metadata
  const info = await ffmpeg.exec([
    '-i', inputPath,
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams'
  ]);

  const metadata = JSON.parse(new TextDecoder().decode(info));
  const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
  const format = metadata.format;

  // Collect all segments
  const segments: Blob[] = [];
  const files = await ffmpeg.listDir('.');
  for (const file of files) {
    if (file.name.endsWith('.ts')) {
      const data = await ffmpeg.readFile(file.name);
      segments.push(new Blob([data], { type: 'video/MP2T' }));
    }
  }

  return {
    playlist: masterPlaylist,
    segments,
    metadata: {
      width: parseInt(videoStream.width),
      height: parseInt(videoStream.height),
      duration: parseFloat(format.duration),
      size: segments.reduce((total, segment) => total + segment.size, 0),
      bitrate: parseInt(format.bit_rate) / 1000,
      codec: videoStream.codec_name,
      format: 'hls'
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