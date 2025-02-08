import { supabase } from '$lib/supabase';
import { api } from './api';
import type { ApiResponse } from '$lib/types';

interface StyleTransferOptions {
  style: 'impressionist' | 'cubist' | 'vangogh' | 'monet' | 'anime' | 'sketch' | 'watercolor';
  strength: number;
  preserveColor?: boolean;
  enhanceDetail?: boolean;
}

interface BackgroundRemovalOptions {
  mode: 'precise' | 'fast';
  feather?: number;
  refineMask?: boolean;
  returnMask?: boolean;
}

interface EnhancementOptions {
  denoise?: boolean;
  upscale?: boolean;
  hdr?: boolean;
  faceRetouching?: boolean;
  colorEnhancement?: boolean;
  smartContrast?: boolean;
}

interface ImageAnalysis {
  dominantColors: string[];
  objects: Array<{
    label: string;
    confidence: number;
    bbox: [number, number, number, number];
  }>;
  faces: Array<{
    bbox: [number, number, number, number];
    landmarks: Record<string, [number, number]>;
    attributes: {
      age: number;
      gender: string;
      emotion: string;
      occlusion: Record<string, boolean>;
    };
  }>;
  composition: {
    ruleOfThirds: number;
    symmetry: number;
    colorHarmony: number;
    complexity: number;
  };
  quality: {
    sharpness: number;
    noise: number;
    exposure: number;
    contrast: number;
  };
  nsfw: {
    isNsfw: boolean;
    scores: Record<string, number>;
  };
}

interface ObjectRemovalOptions {
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  mode: 'object' | 'person' | 'text' | 'defect';
  preserveStructure?: boolean;
  refineMask?: boolean;
  inpaintQuality?: 'fast' | 'balanced' | 'best';
}

interface FaceRetouchingOptions {
  features: {
    skin?: {
      smoothing?: number;
      evenness?: number;
      blemishRemoval?: boolean;
    };
    eyes?: {
      brightness?: number;
      color?: string;
      enlarge?: number;
    };
    lips?: {
      color?: string;
      definition?: number;
    };
    face?: {
      slimming?: number;
      jawline?: number;
      symmetry?: number;
    };
  };
  preserveNaturalLook?: boolean;
  enhanceFeatures?: boolean;
}

interface InpaintingOptions {
  mask: ImageData;
  prompt?: string;
  negativePrompt?: string;
  guidanceScale?: number;
  numInferenceSteps?: number;
  seed?: number;
  enhancePrompt?: boolean;
  preserveOriginalStyle?: boolean;
}

interface SuperResolutionOptions {
  scale: number;
  denoise?: boolean;
  enhanceDetails?: boolean;
  preserveColors?: boolean;
}

interface HarmonizationOptions {
  regions: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  blendStrength?: number;
  preserveStructure?: boolean;
  colorMatching?: boolean;
}

export class AiImageService {
  private modelEndpoints = {
    styleTransfer: '/api/ai/style-transfer',
    backgroundRemoval: '/api/ai/remove-background',
    enhancement: '/api/ai/enhance',
    analysis: '/api/ai/analyze',
    objectRemoval: '/api/ai/remove-object',
    faceRetouching: '/api/ai/retouch-face',
    inpainting: '/api/ai/inpaint',
    superResolution: '/api/ai/super-resolution',
    harmonization: '/api/ai/harmonize'
  };

  /**
   * Apply AI style transfer to an image
   */
  async applyStyle(
    imageUrl: string,
    options: StyleTransferOptions
  ): Promise<ApiResponse<string>> {
    try {
      const formData = new FormData();
      formData.append('image_url', imageUrl);
      formData.append('style', options.style);
      formData.append('strength', options.strength.toString());
      if (options.preserveColor !== undefined) {
        formData.append('preserve_color', options.preserveColor.toString());
      }
      if (options.enhanceDetail !== undefined) {
        formData.append('enhance_detail', options.enhanceDetail.toString());
      }

      const response = await fetch(this.modelEndpoints.styleTransfer, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Style transfer failed');

      const { url } = await response.json();
      return { data: url };
    } catch (error) {
      console.error('Style transfer failed:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Remove background from an image
   */
  async removeBackground(
    imageUrl: string,
    options: BackgroundRemovalOptions
  ): Promise<ApiResponse<{ url: string; mask?: string }>> {
    try {
      const formData = new FormData();
      formData.append('image_url', imageUrl);
      formData.append('mode', options.mode);
      if (options.feather !== undefined) {
        formData.append('feather', options.feather.toString());
      }
      if (options.refineMask !== undefined) {
        formData.append('refine_mask', options.refineMask.toString());
      }
      if (options.returnMask !== undefined) {
        formData.append('return_mask', options.returnMask.toString());
      }

      const response = await fetch(this.modelEndpoints.backgroundRemoval, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Background removal failed');

      const result = await response.json();
      return { data: result };
    } catch (error) {
      console.error('Background removal failed:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Apply AI enhancements to an image
   */
  async enhance(
    imageUrl: string,
    options: EnhancementOptions
  ): Promise<ApiResponse<string>> {
    try {
      const formData = new FormData();
      formData.append('image_url', imageUrl);
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, value.toString());
      });

      const response = await fetch(this.modelEndpoints.enhancement, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Image enhancement failed');

      const { url } = await response.json();
      return { data: url };
    } catch (error) {
      console.error('Image enhancement failed:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Analyze image content and quality
   */
  async analyze(imageUrl: string): Promise<ApiResponse<ImageAnalysis>> {
    try {
      const response = await fetch(this.modelEndpoints.analysis, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_url: imageUrl })
      });

      if (!response.ok) throw new Error('Image analysis failed');

      const analysis = await response.json();
      return { data: analysis };
    } catch (error) {
      console.error('Image analysis failed:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Generate image variations
   */
  async generateVariations(
    imageUrl: string,
    count: number = 4
  ): Promise<ApiResponse<string[]>> {
    try {
      const response = await fetch('/api/ai/variations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: imageUrl,
          count
        })
      });

      if (!response.ok) throw new Error('Variation generation failed');

      const { urls } = await response.json();
      return { data: urls };
    } catch (error) {
      console.error('Variation generation failed:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Restore old or damaged photos
   */
  async restorePhoto(imageUrl: string): Promise<ApiResponse<string>> {
    try {
      const response = await fetch('/api/ai/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_url: imageUrl })
      });

      if (!response.ok) throw new Error('Photo restoration failed');

      const { url } = await response.json();
      return { data: url };
    } catch (error) {
      console.error('Photo restoration failed:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Colorize black and white photos
   */
  async colorize(imageUrl: string): Promise<ApiResponse<string>> {
    try {
      const response = await fetch('/api/ai/colorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_url: imageUrl })
      });

      if (!response.ok) throw new Error('Colorization failed');

      const { url } = await response.json();
      return { data: url };
    } catch (error) {
      console.error('Colorization failed:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Generate image description
   */
  async generateDescription(imageUrl: string): Promise<ApiResponse<{
    caption: string;
    tags: string[];
    nsfw: boolean;
  }>> {
    try {
      const response = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_url: imageUrl })
      });

      if (!response.ok) throw new Error('Description generation failed');

      const result = await response.json();
      return { data: result };
    } catch (error) {
      console.error('Description generation failed:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Detect and extract text from images (OCR)
   */
  async extractText(imageUrl: string): Promise<ApiResponse<{
    text: string;
    blocks: Array<{
      text: string;
      confidence: number;
      bbox: [number, number, number, number];
    }>;
  }>> {
    try {
      const response = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_url: imageUrl })
      });

      if (!response.ok) throw new Error('Text extraction failed');

      const result = await response.json();
      return { data: result };
    } catch (error) {
      console.error('Text extraction failed:', error);
      return { error: { message: error.message } };
    }
  }

  /**
   * Remove objects from an image using AI
   */
  async removeObject(
    imageData: ImageData,
    options: ObjectRemovalOptions
  ): Promise<ApiResponse<ImageData>> {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve!, 'image/png'));

      const formData = new FormData();
      formData.append('image', blob);
      formData.append('options', JSON.stringify(options));

      const response = await api.post(this.modelEndpoints.objectRemoval, formData);
      if (!response.ok) throw new Error('Failed to remove object');

      const resultBlob = await response.blob();
      const resultImage = await createImageBitmap(resultBlob);
      
      canvas.width = resultImage.width;
      canvas.height = resultImage.height;
      ctx.drawImage(resultImage, 0, 0);
      
      return {
        success: true,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height)
      };
    } catch (error) {
      console.error('Error removing object:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove object'
      };
    }
  }

  /**
   * Apply face retouching using AI
   */
  async retouchFace(
    imageData: ImageData,
    options: FaceRetouchingOptions
  ): Promise<ApiResponse<ImageData>> {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve!, 'image/png'));

      const formData = new FormData();
      formData.append('image', blob);
      formData.append('options', JSON.stringify(options));

      const response = await api.post(this.modelEndpoints.faceRetouching, formData);
      if (!response.ok) throw new Error('Failed to retouch face');

      const resultBlob = await response.blob();
      const resultImage = await createImageBitmap(resultBlob);
      
      canvas.width = resultImage.width;
      canvas.height = resultImage.height;
      ctx.drawImage(resultImage, 0, 0);
      
      return {
        success: true,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height)
      };
    } catch (error) {
      console.error('Error retouching face:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retouch face'
      };
    }
  }

  /**
   * Apply inpainting using AI
   */
  async inpaint(
    imageData: ImageData,
    options: InpaintingOptions
  ): Promise<ApiResponse<ImageData>> {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Convert image and mask to blobs
      ctx.putImageData(imageData, 0, 0);
      const imageBlob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve!, 'image/png'));
      
      ctx.putImageData(options.mask, 0, 0);
      const maskBlob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve!, 'image/png'));

      const formData = new FormData();
      formData.append('image', imageBlob);
      formData.append('mask', maskBlob);
      formData.append('options', JSON.stringify(options));

      const response = await api.post(this.modelEndpoints.inpainting, formData);
      if (!response.ok) throw new Error('Failed to inpaint image');

      const resultBlob = await response.blob();
      const resultImage = await createImageBitmap(resultBlob);
      
      canvas.width = resultImage.width;
      canvas.height = resultImage.height;
      ctx.drawImage(resultImage, 0, 0);
      
      return {
        success: true,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height)
      };
    } catch (error) {
      console.error('Error inpainting image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to inpaint image'
      };
    }
  }

  /**
   * Apply super resolution using AI
   */
  async superResolution(
    imageData: ImageData,
    options: SuperResolutionOptions
  ): Promise<ApiResponse<ImageData>> {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve!, 'image/png'));

      const formData = new FormData();
      formData.append('image', blob);
      formData.append('options', JSON.stringify(options));

      const response = await api.post(this.modelEndpoints.superResolution, formData);
      if (!response.ok) throw new Error('Failed to apply super resolution');

      const resultBlob = await response.blob();
      const resultImage = await createImageBitmap(resultBlob);
      
      canvas.width = resultImage.width;
      canvas.height = resultImage.height;
      ctx.drawImage(resultImage, 0, 0);
      
      return {
        success: true,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height)
      };
    } catch (error) {
      console.error('Error applying super resolution:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply super resolution'
      };
    }
  }

  /**
   * Harmonize edited regions with the rest of the image using AI
   */
  async harmonize(
    imageData: ImageData,
    options: HarmonizationOptions
  ): Promise<ApiResponse<ImageData>> {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve!, 'image/png'));

      const formData = new FormData();
      formData.append('image', blob);
      formData.append('options', JSON.stringify(options));

      const response = await api.post(this.modelEndpoints.harmonization, formData);
      if (!response.ok) throw new Error('Failed to harmonize image');

      const resultBlob = await response.blob();
      const resultImage = await createImageBitmap(resultBlob);
      
      canvas.width = resultImage.width;
      canvas.height = resultImage.height;
      ctx.drawImage(resultImage, 0, 0);
      
      return {
        success: true,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height)
      };
    } catch (error) {
      console.error('Error harmonizing image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to harmonize image'
      };
    }
  }
}

// Create AI image service instance
export const aiImage = new AiImageService(); 