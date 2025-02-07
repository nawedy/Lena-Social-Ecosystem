<!-- MixerView.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Button, Icon, Slider } from '@lena/ui';

  export let audioContext: AudioContext;
  export let sourceNode: MediaElementAudioSourceNode;
  export let presets: Array<{
    id: string;
    name: string;
    settings: AudioSettings;
  }> = [];

  interface AudioSettings {
    volume: number;
    equalizer: number[];
    compression: {
      threshold: number;
      ratio: number;
      attack: number;
      release: number;
    };
    reverb: {
      mix: number;
      decay: number;
      damping: number;
    };
    delay: {
      time: number;
      feedback: number;
      mix: number;
    };
    filter: {
      frequency: number;
      resonance: number;
      type: BiquadFilterType;
    };
  }

  const dispatch = createEventDispatcher();
  let showEqualizer = true;
  let showEffects = true;
  let showAnalyzer = true;
  let selectedPreset = '';

  // Audio Nodes
  let gainNode: GainNode;
  let analyserNode: AnalyserNode;
  let equalizerNodes: BiquadFilterNode[] = [];
  let compressorNode: DynamicsCompressorNode;
  let reverbNode: ConvolverNode;
  let delayNode: DelayNode;
  let filterNode: BiquadFilterNode;

  // Canvas Elements
  let spectrumCanvas: HTMLCanvasElement;
  let waveformCanvas: HTMLCanvasElement;
  let animationFrame: number;

  // Settings
  let volume = 1;
  let eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000];
  let eqGains = Array(8).fill(0);
  let compressorThreshold = -24;
  let compressorRatio = 4;
  let compressorAttack = 0.003;
  let compressorRelease = 0.25;
  let reverbMix = 0.3;
  let reverbDecay = 2;
  let reverbDamping = 0.5;
  let delayTime = 0.3;
  let delayFeedback = 0.3;
  let delayMix = 0.3;
  let filterFrequency = 1000;
  let filterResonance = 1;
  let filterType: BiquadFilterType = 'lowpass';

  onMount(async () => {
    initializeAudioNodes();
    setupAnalyzer();
    startVisualization();

    return () => {
      cancelAnimationFrame(animationFrame);
      disconnectNodes();
    };
  });

  function initializeAudioNodes() {
    // Create nodes
    gainNode = audioContext.createGain();
    analyserNode = audioContext.createAnalyser();
    compressorNode = audioContext.createDynamicsCompressor();
    delayNode = audioContext.createDelay(5.0);
    filterNode = audioContext.createBiquadFilter();

    // Create EQ bands
    equalizerNodes = eqFrequencies.map(freq => {
      const filter = audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      return filter;
    });

    // Create reverb
    createReverb().then(node => {
      reverbNode = node;
      connectNodes();
    });

    // Initial settings
    gainNode.gain.value = volume;
    compressorNode.threshold.value = compressorThreshold;
    compressorNode.ratio.value = compressorRatio;
    compressorNode.attack.value = compressorAttack;
    compressorNode.release.value = compressorRelease;
    delayNode.delayTime.value = delayTime;
    filterNode.frequency.value = filterFrequency;
    filterNode.Q.value = filterResonance;
    filterNode.type = filterType;
  }

  async function createReverb(): Promise<ConvolverNode> {
    const impulseUrl = '/audio/impulse-responses/hall.wav';
    const response = await fetch(impulseUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const convolver = audioContext.createConvolver();
    convolver.buffer = audioBuffer;
    return convolver;
  }

  function connectNodes() {
    // Disconnect existing connections
    sourceNode?.disconnect();

    // Create audio processing chain
    sourceNode
      .connect(gainNode)
      .connect(compressorNode);

    // Connect EQ bands in series
    let lastNode: AudioNode = compressorNode;
    equalizerNodes.forEach(eq => {
      lastNode.connect(eq);
      lastNode = eq;
    });

    // Connect effects
    lastNode
      .connect(filterNode)
      .connect(delayNode)
      .connect(reverbNode)
      .connect(analyserNode)
      .connect(audioContext.destination);
  }

  function disconnectNodes() {
    sourceNode?.disconnect();
    gainNode?.disconnect();
    analyserNode?.disconnect();
    equalizerNodes.forEach(node => node.disconnect());
    compressorNode?.disconnect();
    reverbNode?.disconnect();
    delayNode?.disconnect();
    filterNode?.disconnect();
  }

  function setupAnalyzer() {
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.8;
  }

  function startVisualization() {
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      animationFrame = requestAnimationFrame(draw);

      // Draw spectrum
      if (spectrumCanvas) {
        const ctx = spectrumCanvas.getContext('2d')!;
        const width = spectrumCanvas.width;
        const height = spectrumCanvas.height;
        const barWidth = width / bufferLength * 2.5;

        analyserNode.getByteFrequencyData(dataArray);
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(0, 0, width, height);

        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height;
          const hue = (i / bufferLength) * 360;
          ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }

      // Draw waveform
      if (waveformCanvas) {
        const ctx = waveformCanvas.getContext('2d')!;
        const width = waveformCanvas.width;
        const height = waveformCanvas.height;

        analyserNode.getByteTimeDomainData(dataArray);
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(0, 0, width, height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00ffff';
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * height / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }
    }

    draw();
  }

  function loadPreset(presetId: string) {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    const { settings } = preset;
    volume = settings.volume;
    eqGains = settings.equalizer;
    compressorThreshold = settings.compression.threshold;
    compressorRatio = settings.compression.ratio;
    compressorAttack = settings.compression.attack;
    compressorRelease = settings.compression.release;
    reverbMix = settings.reverb.mix;
    reverbDecay = settings.reverb.decay;
    reverbDamping = settings.reverb.damping;
    delayTime = settings.delay.time;
    delayFeedback = settings.delay.feedback;
    delayMix = settings.delay.mix;
    filterFrequency = settings.filter.frequency;
    filterResonance = settings.filter.resonance;
    filterType = settings.filter.type;

    updateAllNodes();
  }

  function savePreset() {
    const settings: AudioSettings = {
      volume,
      equalizer: eqGains,
      compression: {
        threshold: compressorThreshold,
        ratio: compressorRatio,
        attack: compressorAttack,
        release: compressorRelease
      },
      reverb: {
        mix: reverbMix,
        decay: reverbDecay,
        damping: reverbDamping
      },
      delay: {
        time: delayTime,
        feedback: delayFeedback,
        mix: delayMix
      },
      filter: {
        frequency: filterFrequency,
        resonance: filterResonance,
        type: filterType
      }
    };

    dispatch('savePreset', { settings });
  }

  function updateAllNodes() {
    if (!gainNode) return;

    gainNode.gain.value = volume;
    equalizerNodes.forEach((eq, i) => eq.gain.value = eqGains[i]);
    compressorNode.threshold.value = compressorThreshold;
    compressorNode.ratio.value = compressorRatio;
    compressorNode.attack.value = compressorAttack;
    compressorNode.release.value = compressorRelease;
    delayNode.delayTime.value = delayTime;
    filterNode.frequency.value = filterFrequency;
    filterNode.Q.value = filterResonance;
    filterNode.type = filterType;

    dispatch('settingsChange', {
      volume,
      equalizer: eqGains,
      compression: {
        threshold: compressorThreshold,
        ratio: compressorRatio,
        attack: compressorAttack,
        release: compressorRelease
      },
      reverb: {
        mix: reverbMix,
        decay: reverbDecay,
        damping: reverbDamping
      },
      delay: {
        time: delayTime,
        feedback: delayFeedback,
        mix: delayMix
      },
      filter: {
        frequency: filterFrequency,
        resonance: filterResonance,
        type: filterType
      }
    });
  }

  $: {
    if (gainNode) {
      updateAllNodes();
    }
  }
</script>

<div class="rounded-lg bg-gray-800/50 overflow-hidden">
  <!-- Header -->
  <div class="p-4 border-b border-gray-700">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon name="sliders" size={24} class="text-primary-400" />
        <h2 class="text-lg font-medium">Audio Mixer</h2>
      </div>
      <div class="flex items-center gap-2">
        {#if presets.length > 0}
          <select
            bind:value={selectedPreset}
            on:change={() => loadPreset(selectedPreset)}
            class="bg-gray-700/50 border border-gray-600 rounded-lg px-2 py-1 text-sm"
          >
            <option value="">Select Preset</option>
            {#each presets as preset}
              <option value={preset.id}>{preset.name}</option>
            {/each}
          </select>
        {/if}
        <Button
          variant="outline"
          size="sm"
          on:click={savePreset}
        >
          Save Preset
        </Button>
      </div>
    </div>
  </div>

  <div class="p-4 space-y-6">
    <!-- Master Volume -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="text-sm text-gray-400">Master Volume</label>
        <span class="text-sm text-gray-500">{Math.round(volume * 100)}%</span>
      </div>
      <Slider
        value={volume}
        min={0}
        max={1}
        step={0.01}
        on:change={(e) => volume = e.detail}
      />
    </div>

    <!-- Equalizer -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-400">Equalizer</h3>
        <Button
          variant="ghost"
          size="sm"
          on:click={() => showEqualizer = !showEqualizer}
        >
          <Icon name={showEqualizer ? 'chevron-up' : 'chevron-down'} size={20} />
        </Button>
      </div>

      {#if showEqualizer}
        <div class="grid grid-cols-8 gap-2">
          {#each equalizerNodes as eq, i}
            <div class="flex flex-col items-center gap-2">
              <div class="h-32 flex items-center">
                <Slider
                  value={eqGains[i]}
                  min={-12}
                  max={12}
                  step={1}
                  orientation="vertical"
                  on:change={(e) => {
                    eqGains[i] = e.detail;
                    eq.gain.value = e.detail;
                  }}
                />
              </div>
              <span class="text-xs text-gray-400">
                {eqFrequencies[i] < 1000 
                  ? eqFrequencies[i]
                  : `${(eqFrequencies[i] / 1000).toFixed(1)}K`}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Effects -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-400">Effects</h3>
        <Button
          variant="ghost"
          size="sm"
          on:click={() => showEffects = !showEffects}
        >
          <Icon name={showEffects ? 'chevron-up' : 'chevron-down'} size={20} />
        </Button>
      </div>

      {#if showEffects}
        <div class="grid grid-cols-2 gap-6">
          <!-- Compressor -->
          <div class="space-y-4">
            <h4 class="font-medium">Compressor</h4>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Threshold</label>
              <Slider
                value={compressorThreshold}
                min={-60}
                max={0}
                step={1}
                on:change={(e) => compressorThreshold = e.detail}
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Ratio</label>
              <Slider
                value={compressorRatio}
                min={1}
                max={20}
                step={0.5}
                on:change={(e) => compressorRatio = e.detail}
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Attack</label>
              <Slider
                value={compressorAttack}
                min={0}
                max={1}
                step={0.001}
                on:change={(e) => compressorAttack = e.detail}
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Release</label>
              <Slider
                value={compressorRelease}
                min={0.01}
                max={1}
                step={0.01}
                on:change={(e) => compressorRelease = e.detail}
              />
            </div>
          </div>

          <!-- Reverb -->
          <div class="space-y-4">
            <h4 class="font-medium">Reverb</h4>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Mix</label>
              <Slider
                value={reverbMix}
                min={0}
                max={1}
                step={0.01}
                on:change={(e) => reverbMix = e.detail}
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Decay</label>
              <Slider
                value={reverbDecay}
                min={0.1}
                max={10}
                step={0.1}
                on:change={(e) => reverbDecay = e.detail}
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Damping</label>
              <Slider
                value={reverbDamping}
                min={0}
                max={1}
                step={0.01}
                on:change={(e) => reverbDamping = e.detail}
              />
            </div>
          </div>

          <!-- Delay -->
          <div class="space-y-4">
            <h4 class="font-medium">Delay</h4>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Time</label>
              <Slider
                value={delayTime}
                min={0}
                max={2}
                step={0.01}
                on:change={(e) => delayTime = e.detail}
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Feedback</label>
              <Slider
                value={delayFeedback}
                min={0}
                max={0.9}
                step={0.01}
                on:change={(e) => delayFeedback = e.detail}
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Mix</label>
              <Slider
                value={delayMix}
                min={0}
                max={1}
                step={0.01}
                on:change={(e) => delayMix = e.detail}
              />
            </div>
          </div>

          <!-- Filter -->
          <div class="space-y-4">
            <h4 class="font-medium">Filter</h4>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Type</label>
              <select
                bind:value={filterType}
                class="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-2 py-1"
              >
                <option value="lowpass">Low Pass</option>
                <option value="highpass">High Pass</option>
                <option value="bandpass">Band Pass</option>
                <option value="notch">Notch</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Frequency</label>
              <Slider
                value={filterFrequency}
                min={20}
                max={20000}
                step={1}
                on:change={(e) => filterFrequency = e.detail}
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm text-gray-400">Resonance</label>
              <Slider
                value={filterResonance}
                min={0.1}
                max={20}
                step={0.1}
                on:change={(e) => filterResonance = e.detail}
              />
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Analyzer -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-400">Analyzer</h3>
        <Button
          variant="ghost"
          size="sm"
          on:click={() => showAnalyzer = !showAnalyzer}
        >
          <Icon name={showAnalyzer ? 'chevron-up' : 'chevron-down'} size={20} />
        </Button>
      </div>

      {#if showAnalyzer}
        <div class="space-y-4">
          <div class="h-32 bg-black rounded-lg overflow-hidden">
            <canvas
              bind:this={spectrumCanvas}
              width="1024"
              height="128"
              class="w-full h-full"
            />
          </div>
          <div class="h-32 bg-black rounded-lg overflow-hidden">
            <canvas
              bind:this={waveformCanvas}
              width="1024"
              height="128"
              class="w-full h-full"
            />
          </div>
        </div>
      {/if}
    </div>
  </div>
</div> 