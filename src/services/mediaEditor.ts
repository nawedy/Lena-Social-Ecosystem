import { BskyAgent } from '@atproto/api';

export interface Filter {
  name: string;
  settings: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    hue?: number;
    blur?: number;
    sepia?: number;
    grayscale?: number;
  };
}

export interface EditingOptions {
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotate?: number;
  flip?: {
    horizontal: boolean;
    vertical: boolean;
  };
  resize?: {
    width: number;
    height: number;
  };
  filter?: Filter;
}

export class MediaEditorService {
  private agent: BskyAgent;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(agent: BskyAgent) {
    this.agent = agent;
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;
  }

  // Edit image with various options
  public async editImage(
    imageBlob: Blob,
    options: EditingOptions
  ): Promise<Blob> {
    const img = await this.loadImage(imageBlob);

    // Set canvas size
    this.canvas.width = options.resize?.width || img.width;
    this.canvas.height = options.resize?.height || img.height;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply transformations
    this.ctx.save();

    // Handle rotation
    if (options.rotate) {
      this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.rotate((options.rotate * Math.PI) / 180);
      this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
    }

    // Handle flipping
    if (options.flip) {
      this.ctx.scale(
        options.flip.horizontal ? -1 : 1,
        options.flip.vertical ? -1 : 1
      );
    }

    // Draw image with crop
    if (options.crop) {
      this.ctx.drawImage(
        img,
        options.crop.x,
        options.crop.y,
        options.crop.width,
        options.crop.height,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    } else {
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    }

    // Apply filters
    if (options.filter) {
      this.applyFilter(options.filter);
    }

    this.ctx.restore();

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        blob => {
          if (!blob) reject(new Error('Failed to create blob'));
          else resolve(blob);
        },
        'image/jpeg',
        0.95
      );
    });
  }

  // Load image into canvas
  private loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  // Apply filter to canvas
  private applyFilter(filter: Filter): void {
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Apply brightness
      if (filter.settings.brightness) {
        data[i] = Math.min(255, r + filter.settings.brightness);
        data[i + 1] = Math.min(255, g + filter.settings.brightness);
        data[i + 2] = Math.min(255, b + filter.settings.brightness);
      }

      // Apply contrast
      if (filter.settings.contrast) {
        const factor =
          (259 * (filter.settings.contrast + 255)) /
          (255 * (259 - filter.settings.contrast));
        data[i] = Math.min(255, factor * (r - 128) + 128);
        data[i + 1] = Math.min(255, factor * (g - 128) + 128);
        data[i + 2] = Math.min(255, factor * (b - 128) + 128);
      }

      // Apply saturation
      if (filter.settings.saturation) {
        const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
        data[i] = Math.min(255, gray + filter.settings.saturation * (r - gray));
        data[i + 1] = Math.min(
          255,
          gray + filter.settings.saturation * (g - gray)
        );
        data[i + 2] = Math.min(
          255,
          gray + filter.settings.saturation * (b - gray)
        );
      }

      // Apply sepia
      if (filter.settings.sepia) {
        const sr = r * 0.393 + g * 0.769 + b * 0.189;
        const sg = r * 0.349 + g * 0.686 + b * 0.168;
        const sb = r * 0.272 + g * 0.534 + b * 0.131;
        data[i] = Math.min(255, sr);
        data[i + 1] = Math.min(255, sg);
        data[i + 2] = Math.min(255, sb);
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  // Get predefined filters
  public getPresetFilters(): Filter[] {
    return [
      {
        name: 'Vintage',
        settings: {
          sepia: 0.5,
          contrast: 20,
        },
      },
      {
        name: 'Bright',
        settings: {
          brightness: 30,
          saturation: 1.2,
        },
      },
      {
        name: 'Dramatic',
        settings: {
          contrast: 50,
          saturation: 1.4,
        },
      },
      {
        name: 'B&W',
        settings: {
          grayscale: 1,
          contrast: 20,
        },
      },
      {
        name: 'Warm',
        settings: {
          hue: 30,
          saturation: 1.2,
        },
      },
    ];
  }

  // Upload edited media to AT Protocol
  public async uploadEditedMedia(blob: Blob): Promise<{
    uri: string;
    cid: string;
    mimeType: string;
  }> {
    const response = await this.agent.uploadBlob(blob);

    return {
      uri: response.data.blob.ref.toString(),
      cid: response.data.blob.ref.toString().split('/').pop()!,
      mimeType: blob.type,
    };
  }
}
