import type { VideoQuality } from '$lib/types';

/**
 * Format seconds into a human-readable time string (HH:MM:SS)
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(remainingSeconds)}`;
  }
  return `${padZero(minutes)}:${padZero(remainingSeconds)}`;
}

/**
 * Pad a number with leading zeros
 */
function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * Get the optimal video quality based on network conditions and screen size
 */
export function getOptimalQuality(
  qualities: VideoQuality[],
  connection: NetworkInformation | null,
  screenHeight: number
): VideoQuality {
  // Sort qualities by height (resolution)
  const sortedQualities = [...qualities].sort((a, b) => a.height - b.height);

  // Get connection type and speed
  const connectionType = connection?.type || 'unknown';
  const downlink = connection?.downlink || Infinity; // Mbps

  // Calculate maximum supported quality based on connection
  let maxBitrate: number;
  switch (connectionType) {
    case 'slow-2g':
      maxBitrate = 0.1 * 1024 * 1024; // 100 Kbps
      break;
    case '2g':
      maxBitrate = 0.384 * 1024 * 1024; // 384 Kbps
      break;
    case '3g':
      maxBitrate = 1.5 * 1024 * 1024; // 1.5 Mbps
      break;
    case '4g':
      maxBitrate = 5 * 1024 * 1024; // 5 Mbps
      break;
    default:
      maxBitrate = (downlink * 1024 * 1024) / 8; // Convert Mbps to Bps
  }

  // Find the highest quality that fits within constraints
  const optimalQuality = sortedQualities.reduce((best, current) => {
    const fitsResolution = current.height <= screenHeight;
    const fitsBandwidth = current.bitrate <= maxBitrate;
    
    if (fitsResolution && fitsBandwidth) {
      return current;
    }
    return best;
  });

  return optimalQuality || sortedQualities[0]; // Fallback to lowest quality
}

/**
 * Calculate video buffering progress
 */
export function calculateBufferProgress(
  buffered: TimeRanges,
  currentTime: number,
  duration: number
): number {
  if (buffered.length === 0) return 0;

  // Find the appropriate buffered range
  for (let i = 0; i < buffered.length; i++) {
    const start = buffered.start(i);
    const end = buffered.end(i);

    if (currentTime >= start && currentTime <= end) {
      return (end / duration) * 100;
    }
  }

  return 0;
}

/**
 * Generate video thumbnail at specific time
 */
export async function generateThumbnail(
  videoUrl: string,
  time: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    video.crossOrigin = 'anonymous';
    
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };

    video.onseeked = () => {
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = videoUrl;
    video.currentTime = time;
  });
}

/**
 * Check if the browser supports a specific video codec
 */
export function isCodecSupported(codec: string): boolean {
  const video = document.createElement('video');
  return video.canPlayType(codec) !== '';
}

/**
 * Calculate video dimensions maintaining aspect ratio
 */
export function calculateVideoDimensions(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number
): { width: number; height: number } {
  const aspectRatio = videoWidth / videoHeight;
  const containerRatio = containerWidth / containerHeight;

  if (containerRatio > aspectRatio) {
    // Container is wider than video
    return {
      width: containerHeight * aspectRatio,
      height: containerHeight
    };
  } else {
    // Container is taller than video
    return {
      width: containerWidth,
      height: containerWidth / aspectRatio
    };
  }
}

/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Parse HLS manifest to get available qualities
 */
export function parseHLSManifest(manifestUrl: string): Promise<VideoQuality[]> {
  return fetch(manifestUrl)
    .then(response => response.text())
    .then(manifest => {
      const qualities: VideoQuality[] = [];
      const lines = manifest.split('\n');
      let currentQuality: Partial<VideoQuality> = {};

      lines.forEach(line => {
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          const params = line.substring(18).split(',');
          params.forEach(param => {
            const [key, value] = param.split('=');
            switch (key) {
              case 'BANDWIDTH':
                currentQuality.bitrate = parseInt(value);
                break;
              case 'RESOLUTION':
                const [width, height] = value.split('x');
                currentQuality.width = parseInt(width);
                currentQuality.height = parseInt(height);
                break;
              case 'FRAME-RATE':
                currentQuality.fps = parseInt(value);
                break;
            }
          });
        } else if (line.endsWith('.m3u8')) {
          currentQuality.label = `${currentQuality.height}p`;
          qualities.push(currentQuality as VideoQuality);
          currentQuality = {};
        }
      });

      return qualities;
    });
}

/**
 * Check if the device is capable of playing HLS natively
 */
export function canPlayHLSNatively(): boolean {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

/**
 * Extract frames from video for thumbnail strip
 */
export async function extractFrames(
  videoUrl: string,
  frameCount: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const frames: string[] = [];

    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const interval = video.duration / frameCount;

      let currentFrame = 0;
      const captureFrame = () => {
        if (currentFrame >= frameCount) {
          resolve(frames);
          return;
        }

        video.currentTime = currentFrame * interval;
        currentFrame++;
      };

      video.onseeked = () => {
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.5));
          captureFrame();
        }
      };

      captureFrame();
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = videoUrl;
  });
} 