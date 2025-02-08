/**
 * Image processing utilities for blending and effects
 */

type BlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return { h, s, l };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): RGBA {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a: 1
  };
}

/**
 * Get pixel data at position
 */
function getPixel(data: Uint8ClampedArray, index: number): RGBA {
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3] / 255
  };
}

/**
 * Set pixel data at position
 */
function setPixel(data: Uint8ClampedArray, index: number, color: RGBA) {
  data[index] = color.r;
  data[index + 1] = color.g;
  data[index + 2] = color.b;
  data[index + 3] = Math.round(color.a * 255);
}

/**
 * Blend two colors using specified mode
 */
function blendColors(base: RGBA, blend: RGBA, mode: BlendMode): RGBA {
  // Early return if blend is transparent
  if (blend.a === 0) return base;

  // Apply blend mode
  let result: RGBA;
  switch (mode) {
    case 'multiply':
      result = {
        r: (base.r * blend.r) / 255,
        g: (base.g * blend.g) / 255,
        b: (base.b * blend.b) / 255,
        a: base.a
      };
      break;

    case 'screen':
      result = {
        r: 255 - ((255 - base.r) * (255 - blend.r)) / 255,
        g: 255 - ((255 - base.g) * (255 - blend.g)) / 255,
        b: 255 - ((255 - base.b) * (255 - blend.b)) / 255,
        a: base.a
      };
      break;

    case 'overlay':
      result = {
        r: base.r < 128
          ? (2 * base.r * blend.r) / 255
          : 255 - (2 * (255 - base.r) * (255 - blend.r)) / 255,
        g: base.g < 128
          ? (2 * base.g * blend.g) / 255
          : 255 - (2 * (255 - base.g) * (255 - blend.g)) / 255,
        b: base.b < 128
          ? (2 * base.b * blend.b) / 255
          : 255 - (2 * (255 - base.b) * (255 - blend.b)) / 255,
        a: base.a
      };
      break;

    case 'darken':
      result = {
        r: Math.min(base.r, blend.r),
        g: Math.min(base.g, blend.g),
        b: Math.min(base.b, blend.b),
        a: base.a
      };
      break;

    case 'lighten':
      result = {
        r: Math.max(base.r, blend.r),
        g: Math.max(base.g, blend.g),
        b: Math.max(base.b, blend.b),
        a: base.a
      };
      break;

    case 'color-dodge':
      result = {
        r: base.r === 0 ? 0 : Math.min(255, (blend.r * 255) / (255 - base.r)),
        g: base.g === 0 ? 0 : Math.min(255, (blend.g * 255) / (255 - base.g)),
        b: base.b === 0 ? 0 : Math.min(255, (blend.b * 255) / (255 - base.b)),
        a: base.a
      };
      break;

    case 'color-burn':
      result = {
        r: base.r === 255 ? 255 : Math.max(0, 255 - ((255 - blend.r) * 255) / base.r),
        g: base.g === 255 ? 255 : Math.max(0, 255 - ((255 - blend.g) * 255) / base.g),
        b: base.b === 255 ? 255 : Math.max(0, 255 - ((255 - blend.b) * 255) / base.b),
        a: base.a
      };
      break;

    case 'hard-light':
      result = {
        r: blend.r < 128
          ? (2 * base.r * blend.r) / 255
          : 255 - (2 * (255 - base.r) * (255 - blend.r)) / 255,
        g: blend.g < 128
          ? (2 * base.g * blend.g) / 255
          : 255 - (2 * (255 - base.g) * (255 - blend.g)) / 255,
        b: blend.b < 128
          ? (2 * base.b * blend.b) / 255
          : 255 - (2 * (255 - base.b) * (255 - blend.b)) / 255,
        a: base.a
      };
      break;

    case 'soft-light':
      result = {
        r: blend.r < 128
          ? base.r - (255 - 2 * blend.r) * base.r * (255 - base.r) / (255 * 255)
          : base.r + (2 * blend.r - 255) * (Math.sqrt(base.r / 255) * 255 - base.r) / 255,
        g: blend.g < 128
          ? base.g - (255 - 2 * blend.g) * base.g * (255 - base.g) / (255 * 255)
          : base.g + (2 * blend.g - 255) * (Math.sqrt(base.g / 255) * 255 - base.g) / 255,
        b: blend.b < 128
          ? base.b - (255 - 2 * blend.b) * base.b * (255 - base.b) / (255 * 255)
          : base.b + (2 * blend.b - 255) * (Math.sqrt(base.b / 255) * 255 - base.b) / 255,
        a: base.a
      };
      break;

    case 'difference':
      result = {
        r: Math.abs(base.r - blend.r),
        g: Math.abs(base.g - blend.g),
        b: Math.abs(base.b - blend.b),
        a: base.a
      };
      break;

    case 'exclusion':
      result = {
        r: base.r + blend.r - (2 * base.r * blend.r) / 255,
        g: base.g + blend.g - (2 * base.g * blend.g) / 255,
        b: base.b + blend.b - (2 * base.b * blend.b) / 255,
        a: base.a
      };
      break;

    case 'hue':
    case 'saturation':
    case 'color':
    case 'luminosity': {
      const baseHsl = rgbToHsl(base.r, base.g, base.b);
      const blendHsl = rgbToHsl(blend.r, blend.g, blend.b);

      let h = baseHsl.h;
      let s = baseHsl.s;
      let l = baseHsl.l;

      switch (mode) {
        case 'hue':
          h = blendHsl.h;
          break;
        case 'saturation':
          s = blendHsl.s;
          break;
        case 'color':
          h = blendHsl.h;
          s = blendHsl.s;
          break;
        case 'luminosity':
          l = blendHsl.l;
          break;
      }

      const rgb = hslToRgb(h, s, l);
      result = { ...rgb, a: base.a };
      break;
    }

    default: // normal
      const alpha = blend.a;
      result = {
        r: (1 - alpha) * base.r + alpha * blend.r,
        g: (1 - alpha) * base.g + alpha * blend.g,
        b: (1 - alpha) * base.b + alpha * blend.b,
        a: base.a
      };
  }

  return result;
}

/**
 * Apply blend mode to image data
 */
export function blendLayers(
  baseData: ImageData,
  blendData: ImageData,
  mode: BlendMode = 'normal',
  opacity: number = 1
): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(baseData.data),
    baseData.width,
    baseData.height
  );

  for (let i = 0; i < baseData.data.length; i += 4) {
    const baseColor = getPixel(baseData.data, i);
    const blendColor = getPixel(blendData.data, i);

    // Apply opacity
    blendColor.a *= opacity;

    // Blend colors
    const resultColor = blendColors(baseColor, blendColor, mode);
    setPixel(result.data, i, resultColor);
  }

  return result;
}

/**
 * Apply convolution filter to image data
 */
export function applyConvolution(
  imageData: ImageData,
  kernel: number[],
  divisor: number = 1,
  offset: number = 0
): ImageData {
  const kernelSize = Math.sqrt(kernel.length);
  const halfKernel = Math.floor(kernelSize / 2);
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < imageData.width; x++) {
      let r = 0, g = 0, b = 0;

      // Apply kernel to each pixel
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = x + kx - halfKernel;
          const py = y + ky - halfKernel;

          if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
            const i = (py * imageData.width + px) * 4;
            const weight = kernel[ky * kernelSize + kx];
            r += imageData.data[i] * weight;
            g += imageData.data[i + 1] * weight;
            b += imageData.data[i + 2] * weight;
          }
        }
      }

      const i = (y * imageData.width + x) * 4;
      result.data[i] = Math.min(255, Math.max(0, (r / divisor) + offset));
      result.data[i + 1] = Math.min(255, Math.max(0, (g / divisor) + offset));
      result.data[i + 2] = Math.min(255, Math.max(0, (b / divisor) + offset));
    }
  }

  return result;
}

// Common convolution kernels
export const kernels = {
  sharpen: [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ],
  blur: [
    1/9, 1/9, 1/9,
    1/9, 1/9, 1/9,
    1/9, 1/9, 1/9
  ],
  gaussianBlur: [
    1/16, 2/16, 1/16,
    2/16, 4/16, 2/16,
    1/16, 2/16, 1/16
  ],
  edgeDetection: [
    -1, -1, -1,
    -1, 8, -1,
    -1, -1, -1
  ],
  emboss: [
    -2, -1, 0,
    -1, 1, 1,
    0, 1, 2
  ]
}; 