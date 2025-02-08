<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components/ui';
  import * as tf from '@tensorflow/tfjs';
  import * as bodyPix from '@tensorflow-models/body-pix';
  import * as blazeface from '@tensorflow-models/blazeface';

  export let video: HTMLVideoElement;
  export let canvas: HTMLCanvasElement;
  export let width: number;
  export let height: number;

  let ctx: CanvasRenderingContext2D | null;
  let bodyPixModel: bodyPix.BodyPix | null = null;
  let blazefaceModel: any = null;
  let selectedFilter = 'none';
  let selectedEffect = 'none';
  let processing = false;
  let segmentation: any = null;
  let faceDetection: any = null;

  const dispatch = createEventDispatcher<{
    filterChange: { filter: string };
    effectChange: { effect: string };
  }>();

  const filters = [
    { id: 'none', name: 'Normal' },
    { id: 'grayscale', name: 'Grayscale' },
    { id: 'sepia', name: 'Sepia' },
    { id: 'vintage', name: 'Vintage' },
    { id: 'brightness', name: 'Bright' },
    { id: 'contrast', name: 'Contrast' },
    { id: 'saturation', name: 'Saturate' },
    { id: 'blur', name: 'Blur' }
  ];

  const effects = [
    { id: 'none', name: 'None' },
    { id: 'background-blur', name: 'Background Blur' },
    { id: 'background-replace', name: 'Background Replace' },
    { id: 'face-effects', name: 'Face Effects' },
    { id: 'glitch', name: 'Glitch' },
    { id: 'pixelate', name: 'Pixelate' },
    { id: 'rgb-shift', name: 'RGB Shift' },
    { id: 'vhs', name: 'VHS' }
  ];

  onMount(async () => {
    ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    // Load AI models
    await Promise.all([
      loadBodyPixModel(),
      loadBlazefaceModel()
    ]);

    // Start processing frames
    processFrame();
  });

  async function loadBodyPixModel() {
    try {
      bodyPixModel = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });
    } catch (error) {
      console.error('Failed to load BodyPix model:', error);
    }
  }

  async function loadBlazefaceModel() {
    try {
      blazefaceModel = await blazeface.load();
    } catch (error) {
      console.error('Failed to load Blazeface model:', error);
    }
  }

  async function processFrame() {
    if (!ctx || !video || processing) return;

    processing = true;

    try {
      // Draw original frame
      ctx.drawImage(video, 0, 0, width, height);

      // Apply selected filter
      if (selectedFilter !== 'none') {
        applyFilter(selectedFilter);
      }

      // Apply selected effect
      if (selectedEffect !== 'none') {
        await applyEffect(selectedEffect);
      }
    } catch (error) {
      console.error('Error processing frame:', error);
    } finally {
      processing = false;
      requestAnimationFrame(processFrame);
    }
  }

  function applyFilter(filter: string) {
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    switch (filter) {
      case 'grayscale':
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
        }
        break;

      case 'sepia':
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
          data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
          data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }
        break;

      case 'vintage':
        for (let i = 0; i < data.length; i += 4) {
          data[i] *= 1.2;
          data[i + 2] *= 0.8;
        }
        break;

      case 'brightness':
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] * 1.2);
          data[i + 1] = Math.min(255, data[i + 1] * 1.2);
          data[i + 2] = Math.min(255, data[i + 2] * 1.2);
        }
        break;

      case 'contrast':
        const factor = 1.2;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = factor * (data[i] - 128) + 128;
          data[i + 1] = factor * (data[i + 1] - 128) + 128;
          data[i + 2] = factor * (data[i + 2] - 128) + 128;
        }
        break;

      case 'saturation':
        for (let i = 0; i < data.length; i += 4) {
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          const delta = max - min;
          if (delta !== 0) {
            const factor = 1.5;
            for (let j = 0; j < 3; j++) {
              data[i + j] = Math.min(255, data[i + j] + (data[i + j] - min) * (factor - 1));
            }
          }
        }
        break;

      case 'blur':
        // Simple box blur
        const radius = 2;
        const kernel = [];
        const size = radius * 2 + 1;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            kernel.push(1 / (size * size));
          }
        }
        applyConvolution(imageData, kernel, size);
        break;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  async function applyEffect(effect: string) {
    if (!ctx) return;

    switch (effect) {
      case 'background-blur':
        if (bodyPixModel) {
          segmentation = await bodyPixModel.segmentPerson(canvas);
          const backgroundBlurAmount = 8;
          await bodyPix.drawBokehEffect(
            canvas,
            video,
            segmentation,
            backgroundBlurAmount,
            7
          );
        }
        break;

      case 'background-replace':
        if (bodyPixModel) {
          segmentation = await bodyPixModel.segmentPerson(canvas);
          const backgroundColor = { r: 0, g: 0, b: 0, a: 255 };
          const foregroundColor = { r: 255, g: 255, b: 255, a: 255 };
          const backgroundDarkeningMask = bodyPix.toMask(
            segmentation,
            foregroundColor,
            backgroundColor
          );
          ctx.putImageData(backgroundDarkeningMask, 0, 0);
        }
        break;

      case 'face-effects':
        if (blazefaceModel) {
          const predictions = await blazefaceModel.estimateFaces(video, false);
          if (predictions.length > 0) {
            const imageData = ctx.getImageData(0, 0, width, height);
            predictions.forEach((prediction: any) => {
              const start = prediction.topLeft;
              const end = prediction.bottomRight;
              const size = [end[0] - start[0], end[1] - start[1]];
              // Add fun effects around detected faces
              drawFaceEffect(imageData, start, size);
            });
            ctx.putImageData(imageData, 0, 0);
          }
        }
        break;

      case 'glitch':
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const amount = Math.random() * 10;
        const shift = Math.random() * 20 - 10;

        for (let i = 0; i < data.length; i += 4) {
          if (Math.random() < 0.05) {
            data[i] = data[i + amount * 4] || data[i];
            data[i + 1] = data[i + 1 + shift * 4] || data[i + 1];
          }
        }
        ctx.putImageData(imageData, 0, 0);
        break;

      case 'pixelate':
        const size = 10;
        for (let y = 0; y < height; y += size) {
          for (let x = 0; x < width; x += size) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            ctx.fillStyle = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
            ctx.fillRect(x, y, size, size);
          }
        }
        break;

      case 'rgb-shift':
        const imageData2 = ctx.getImageData(0, 0, width, height);
        const data2 = imageData2.data;
        const amount2 = 5;
        for (let i = 0; i < data2.length; i += 4) {
          data2[i] = data2[i + amount2 * 4] || data2[i];
          data2[i + 2] = data2[i + 2 - amount2 * 4] || data2[i + 2];
        }
        ctx.putImageData(imageData2, 0, 0);
        break;

      case 'vhs':
        const imageData3 = ctx.getImageData(0, 0, width, height);
        const data3 = imageData3.data;
        for (let i = 0; i < data3.length; i += 4) {
          const offset = Math.sin(i / 4000) * 10;
          data3[i] = data3[i + offset * 4] || data3[i];
          data3[i + 1] = data3[i + 1] || data3[i + 1];
          data3[i + 2] = data3[i + 2 - offset * 4] || data3[i + 2];
        }
        ctx.putImageData(imageData3, 0, 0);
        break;
    }
  }

  function applyConvolution(imageData: ImageData, kernel: number[], kernelSize: number) {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const output = new Uint8ClampedArray(data.length);
    const half = Math.floor(kernelSize / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = (y * w + x) * 4;
        let r = 0, g = 0, b = 0;

        for (let cy = 0; cy < kernelSize; cy++) {
          for (let cx = 0; cx < kernelSize; cx++) {
            const cpx = ((Math.min(Math.max(y + (cy - half), 0), h - 1)) * w +
                        (Math.min(Math.max(x + (cx - half), 0), w - 1))) * 4;
            const weight = kernel[cy * kernelSize + cx];
            r += data[cpx] * weight;
            g += data[cpx + 1] * weight;
            b += data[cpx + 2] * weight;
          }
        }

        output[px] = r;
        output[px + 1] = g;
        output[px + 2] = b;
        output[px + 3] = data[px + 3];
      }
    }

    for (let i = 0; i < data.length; i++) {
      data[i] = output[i];
    }
  }

  function drawFaceEffect(imageData: ImageData, start: number[], size: number[]) {
    const data = imageData.data;
    const centerX = start[0] + size[0] / 2;
    const centerY = start[1] + size[1] / 2;
    const radius = Math.max(size[0], size[1]) / 2;

    for (let y = Math.max(0, start[1] - radius); y < Math.min(height, start[1] + size[1] + radius); y++) {
      for (let x = Math.max(0, start[0] - radius); x < Math.min(width, start[0] + size[0] + radius); x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < radius) {
          const i = (y * width + x) * 4;
          const factor = 1 - distance / radius;
          data[i] = Math.min(255, data[i] + factor * 50);
          data[i + 2] = Math.min(255, data[i + 2] + factor * 50);
        }
      }
    }
  }

  function handleFilterChange(filter: string) {
    selectedFilter = filter;
    dispatch('filterChange', { filter });
  }

  function handleEffectChange(effect: string) {
    selectedEffect = effect;
    dispatch('effectChange', { effect });
  }
</script>

<div class="space-y-4">
  <!-- Filters -->
  <div>
    <h3 class="text-sm font-medium mb-2">Filters</h3>
    <div class="flex flex-wrap gap-2">
      {#each filters as filter}
        <Button
          variant="ghost"
          size="sm"
          class="rounded-full"
          class:bg-primary={selectedFilter === filter.id}
          class:text-white={selectedFilter === filter.id}
          on:click={() => handleFilterChange(filter.id)}
        >
          {filter.name}
        </Button>
      {/each}
    </div>
  </div>

  <!-- Effects -->
  <div>
    <h3 class="text-sm font-medium mb-2">Effects</h3>
    <div class="flex flex-wrap gap-2">
      {#each effects as effect}
        <Button
          variant="ghost"
          size="sm"
          class="rounded-full"
          class:bg-primary={selectedEffect === effect.id}
          class:text-white={selectedEffect === effect.id}
          on:click={() => handleEffectChange(effect.id)}
        >
          {effect.name}
        </Button>
      {/each}
    </div>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 