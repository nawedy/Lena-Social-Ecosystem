/**
 * Image processing utilities for filters and adjustments
 */

/**
 * Apply a filter to image data
 */
export async function applyImageFilter(
  imageData: ImageData,
  filterId: string
): Promise<ImageData> {
  const { width, height, data } = imageData;
  const newData = new Uint8ClampedArray(data);

  switch (filterId) {
    case 'chrome':
      applyChromeFilter(newData);
      break;
    case 'fade':
      applyFadeFilter(newData);
      break;
    case 'mono':
      applyMonoFilter(newData);
      break;
    case 'noir':
      applyNoirFilter(newData);
      break;
    case 'process':
      applyProcessFilter(newData);
      break;
    case 'tonal':
      applyTonalFilter(newData);
      break;
    case 'transfer':
      applyTransferFilter(newData);
      break;
  }

  return new ImageData(newData, width, height);
}

/**
 * Apply an adjustment to image data
 */
export async function applyImageAdjustment(
  imageData: ImageData,
  adjustment: string,
  value: number
): Promise<ImageData> {
  const { width, height, data } = imageData;
  const newData = new Uint8ClampedArray(data);

  switch (adjustment) {
    case 'brightness':
      adjustBrightness(newData, value);
      break;
    case 'contrast':
      adjustContrast(newData, value);
      break;
    case 'saturation':
      adjustSaturation(newData, value);
      break;
    case 'temperature':
      adjustTemperature(newData, value);
      break;
    case 'vignette':
      applyVignette(newData, width, height, value);
      break;
  }

  return new ImageData(newData, width, height);
}

// Filter implementations
function applyChromeFilter(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Increase contrast and cool tones
    data[i] = Math.min(255, r * 1.2);
    data[i + 1] = Math.min(255, g * 1.1);
    data[i + 2] = Math.min(255, b * 0.9);
  }
}

function applyFadeFilter(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Reduce contrast and add warm tint
    data[i] = Math.min(255, r * 0.9 + 40);
    data[i + 1] = Math.min(255, g * 0.9 + 30);
    data[i + 2] = Math.min(255, b * 0.9 + 20);
  }
}

function applyMonoFilter(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Convert to grayscale
    const gray = (r * 0.299 + g * 0.587 + b * 0.114);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

function applyNoirFilter(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // High contrast black and white
    const gray = (r * 0.299 + g * 0.587 + b * 0.114);
    const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
    data[i] = contrast;
    data[i + 1] = contrast;
    data[i + 2] = contrast;
  }
}

function applyProcessFilter(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Cross-processed look
    data[i] = Math.min(255, r * 1.2);
    data[i + 1] = Math.min(255, g * 0.9);
    data[i + 2] = Math.min(255, b * 1.1);
  }
}

function applyTonalFilter(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Split-toning effect
    const gray = (r * 0.299 + g * 0.587 + b * 0.114);
    if (gray > 128) {
      // Warm highlights
      data[i] = Math.min(255, gray * 1.1);
      data[i + 1] = Math.min(255, gray * 1.05);
      data[i + 2] = Math.min(255, gray * 0.9);
    } else {
      // Cool shadows
      data[i] = Math.min(255, gray * 0.9);
      data[i + 1] = Math.min(255, gray * 0.95);
      data[i + 2] = Math.min(255, gray * 1.1);
    }
  }
}

function applyTransferFilter(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Color transfer effect
    data[i] = Math.min(255, r * 1.1 + g * 0.1);
    data[i + 1] = Math.min(255, g * 1.1 + b * 0.1);
    data[i + 2] = Math.min(255, b * 1.1 + r * 0.1);
  }
}

// Adjustment implementations
function adjustBrightness(data: Uint8ClampedArray, value: number) {
  const factor = 1 + (value / 100);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * factor);
    data[i + 1] = Math.min(255, data[i + 1] * factor);
    data[i + 2] = Math.min(255, data[i + 2] * factor);
  }
}

function adjustContrast(data: Uint8ClampedArray, value: number) {
  const factor = (259 * (value + 255)) / (255 * (259 - value));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
    data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
    data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
  }
}

function adjustSaturation(data: Uint8ClampedArray, value: number) {
  const factor = 1 + (value / 100);
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    data[i] = Math.min(255, Math.max(0, gray + (data[i] - gray) * factor));
    data[i + 1] = Math.min(255, Math.max(0, gray + (data[i + 1] - gray) * factor));
    data[i + 2] = Math.min(255, Math.max(0, gray + (data[i + 2] - gray) * factor));
  }
}

function adjustTemperature(data: Uint8ClampedArray, value: number) {
  const factor = value / 100;
  for (let i = 0; i < data.length; i += 4) {
    // Warm up (increase red, decrease blue) or cool down (decrease red, increase blue)
    data[i] = Math.min(255, Math.max(0, data[i] + factor * 25));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] - factor * 25));
  }
}

function applyVignette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  value: number
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  const intensity = value / 100;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const distance = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      const factor = 1 - (distance / maxDistance) * intensity;

      data[i] = Math.min(255, data[i] * factor);
      data[i + 1] = Math.min(255, data[i + 1] * factor);
      data[i + 2] = Math.min(255, data[i + 2] * factor);
    }
  }
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

  return [h, s, l];
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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

  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255)
  ];
} 