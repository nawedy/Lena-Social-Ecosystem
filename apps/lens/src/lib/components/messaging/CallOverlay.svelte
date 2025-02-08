<!-- CallOverlay.svelte -->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Chat } from '$lib/types/messaging';
  import { auth } from '$lib/services/auth';
  import { analytics } from '$lib/services/analytics';
  import UserAvatar from '../shared/UserAvatar.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let chat: Chat;
  export let isVideoEnabled = true;
  export let isAudioEnabled = true;
  export let quality: 'auto' | '720p' | '1080p' = 'auto';

  // State
  let localVideo: HTMLVideoElement;
  let remoteVideo: HTMLVideoElement;
  let localStream: MediaStream | null = null;
  let remoteStream: MediaStream | null = null;
  let peerConnection: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let callDuration = 0;
  let callInterval: number;
  let networkStats = {
    bitrate: 0,
    packetLoss: 0,
    latency: 0
  };
  let statsInterval: number;

  // Computed
  $: currentUser = $auth.user;
  $: otherParticipant = chat.participants.find(p => p.userId !== currentUser?.id);
  $: isGroup = chat.type === 'group';

  // Lifecycle
  onMount(async () => {
    try {
      // Initialize WebRTC
      await setupWebRTC();

      // Start call duration timer
      callInterval = setInterval(() => {
        callDuration++;
      }, 1000);

      // Start network stats monitoring
      statsInterval = setInterval(updateNetworkStats, 1000);

      // Track call start
      analytics.trackEvent('call_started', {
        chatId: chat.id,
        type: isVideoEnabled ? 'video' : 'audio',
        participants: chat.participants.length
      });
    } catch (error) {
      console.error('Failed to setup call:', error);
      handleError(error);
    }
  });

  onDestroy(() => {
    cleanup();
  });

  // WebRTC setup
  async function setupWebRTC() {
    // Create peer connection with TURN/STUN servers
    peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:your-turn-server.com',
          username: 'username',
          credential: 'credential'
        }
      ],
      iceCandidatePoolSize: 10
    });

    // Set up local media stream
    localStream = await navigator.mediaDevices.getUserMedia({
      video: isVideoEnabled ? {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: 'user'
      } : false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // Add tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream!);
    });

    // Set up data channel for metadata
    dataChannel = peerConnection.createDataChannel('metadata');
    dataChannel.onmessage = handleDataChannelMessage;

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];
        if (remoteVideo) {
          remoteVideo.srcObject = remoteStream;
        }
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      switch (peerConnection?.connectionState) {
        case 'connected':
          console.log('Call connected');
          break;
        case 'disconnected':
        case 'failed':
          handleError(new Error('Call connection lost'));
          break;
        case 'closed':
          cleanup();
          break;
      }
    };

    // Handle ICE candidate events
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send candidate to other peer via signaling server
        sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Set local video
    if (localVideo) {
      localVideo.srcObject = localStream;
    }

    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send offer to other peer via signaling server
    sendSignalingMessage({
      type: 'offer',
      offer
    });
  }

  // Media controls
  function toggleVideo() {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        isVideoEnabled = videoTrack.enabled;
        sendMetadata({ video: isVideoEnabled });
      }
    }
  }

  function toggleAudio() {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isAudioEnabled = audioTrack.enabled;
        sendMetadata({ audio: isAudioEnabled });
      }
    }
  }

  function switchCamera() {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const facingMode = videoTrack.getSettings().facingMode === 'user' ? 'environment' : 'user';
        navigator.mediaDevices.getUserMedia({
          video: { facingMode }
        }).then(newStream => {
          const newVideoTrack = newStream.getVideoTracks()[0];
          const sender = peerConnection?.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(newVideoTrack);
          }
          localStream.removeTrack(videoTrack);
          localStream.addTrack(newVideoTrack);
          if (localVideo) {
            localVideo.srcObject = localStream;
          }
        });
      }
    }
  }

  function setQuality(newQuality: typeof quality) {
    quality = newQuality;
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const constraints = {
          width: quality === '1080p' ? 1920 : quality === '720p' ? 1280 : undefined,
          height: quality === '1080p' ? 1080 : quality === '720p' ? 720 : undefined
        };
        videoTrack.applyConstraints(constraints);
      }
    }
  }

  // Network stats
  async function updateNetworkStats() {
    if (!peerConnection) return;

    try {
      const stats = await peerConnection.getStats();
      let totalBitrate = 0;
      let totalPacketLoss = 0;
      let rttSum = 0;
      let rttCount = 0;

      stats.forEach(report => {
        if (report.type === 'outbound-rtp') {
          const now = report.timestamp;
          const bytes = report.bytesSent;
          const packets = report.packetsSent;
          const packetsLost = report.packetsLost;

          if (this.lastStats?.has(report.id)) {
            const last = this.lastStats.get(report.id);
            const duration = (now - last.timestamp) / 1000;
            const bitrate = 8 * (bytes - last.bytes) / duration / 1000; // kbps
            const packetLoss = ((packetsLost - last.packetsLost) / (packets - last.packets)) * 100;

            totalBitrate += bitrate;
            totalPacketLoss += packetLoss;
          }

          this.lastStats.set(report.id, {
            timestamp: now,
            bytes,
            packets,
            packetsLost
          });
        } else if (report.type === 'remote-inbound-rtp') {
          rttSum += report.roundTripTime;
          rttCount++;
        }
      });

      networkStats = {
        bitrate: Math.round(totalBitrate),
        packetLoss: Math.round(totalPacketLoss * 100) / 100,
        latency: rttCount > 0 ? Math.round(rttSum / rttCount * 1000) : 0
      };
    } catch (error) {
      console.error('Failed to update network stats:', error);
    }
  }

  // Signaling
  function sendSignalingMessage(message: any) {
    // Implement signaling server communication
  }

  function handleSignalingMessage(message: any) {
    switch (message.type) {
      case 'offer':
        handleOffer(message.offer);
        break;
      case 'answer':
        handleAnswer(message.answer);
        break;
      case 'ice-candidate':
        handleIceCandidate(message.candidate);
        break;
    }
  }

  async function handleOffer(offer: RTCSessionDescriptionInit) {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    sendSignalingMessage({
      type: 'answer',
      answer
    });
  }

  async function handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async function handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!peerConnection) return;
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  // Data channel
  function sendMetadata(data: any) {
    if (dataChannel?.readyState === 'open') {
      dataChannel.send(JSON.stringify(data));
    }
  }

  function handleDataChannelMessage(event: MessageEvent) {
    const data = JSON.parse(event.data);
    // Handle metadata updates
  }

  // Error handling
  function handleError(error: Error) {
    console.error('Call error:', error);
    analytics.trackEvent('call_error', {
      chatId: chat.id,
      error: error.message
    });
    cleanup();
    dispatch('error', { error });
  }

  // Cleanup
  function cleanup() {
    // Stop media tracks
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    // Clear intervals
    if (callInterval) clearInterval(callInterval);
    if (statsInterval) clearInterval(statsInterval);

    // Track call end
    analytics.trackEvent('call_ended', {
      chatId: chat.id,
      duration: callDuration
    });
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return [hours, minutes, remainingSeconds]
      .map(n => n.toString().padStart(2, '0'))
      .join(':');
  }
</script>

<div class="call-overlay" transition:fade>
  <div class="call-content">
    <div class="video-container" class:video-enabled={isVideoEnabled}>
      {#if isVideoEnabled}
        <video
          bind:this={remoteVideo}
          class="remote-video"
          autoplay
          playsinline
        />
        <video
          bind:this={localVideo}
          class="local-video"
          autoplay
          playsinline
          muted
        />
      {:else}
        <div class="avatar-container">
          <UserAvatar
            user={otherParticipant}
            size="xl"
          />
          <div class="participant-name">
            {otherParticipant.displayName || otherParticipant.username}
          </div>
        </div>
      {/if}
    </div>

    <div class="call-info">
      <div class="duration">
        {formatDuration(callDuration)}
      </div>

      {#if networkStats.bitrate > 0}
        <div class="network-stats">
          <div class="stat">
            <span class="label">Bitrate:</span>
            <span class="value">{networkStats.bitrate} kbps</span>
          </div>
          <div class="stat">
            <span class="label">Packet Loss:</span>
            <span class="value">{networkStats.packetLoss}%</span>
          </div>
          <div class="stat">
            <span class="label">Latency:</span>
            <span class="value">{networkStats.latency}ms</span>
          </div>
        </div>
      {/if}
    </div>

    <div class="call-controls">
      <button
        class="control-button"
        class:active={isAudioEnabled}
        on:click={toggleAudio}
      >
        <Icon name={isAudioEnabled ? 'mic' : 'mic-off'} />
      </button>

      <button
        class="control-button"
        class:active={isVideoEnabled}
        on:click={toggleVideo}
      >
        <Icon name={isVideoEnabled ? 'video' : 'video-off'} />
      </button>

      {#if isVideoEnabled}
        <button
          class="control-button"
          on:click={switchCamera}
        >
          <Icon name="switch-camera" />
        </button>

        <div class="quality-selector">
          <select bind:value={quality}>
            <option value="auto">Auto</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </div>
      {/if}

      <button
        class="control-button end-call"
        on:click={() => dispatch('end')}
      >
        <Icon name="phone-off" />
      </button>
    </div>
  </div>
</div>

<style lang="postcss">
  .call-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    z-index: 100;
  }

  .call-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .video-container {
    flex: 1;
    position: relative;
    background: var(--surface-1);

    &.video-enabled {
      background: black;
    }
  }

  .remote-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .local-video {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 240px;
    height: 135px;
    border-radius: 8px;
    object-fit: cover;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .avatar-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .participant-name {
    color: white;
    font-size: 24px;
    font-weight: 500;
  }

  .call-info {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    color: white;
  }

  .duration {
    font-size: 18px;
    font-weight: 500;
  }

  .network-stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }

  .stat {
    display: flex;
    justify-content: space-between;
    gap: 8px;

    .label {
      color: rgba(255, 255, 255, 0.7);
    }
  }

  .call-controls {
    position: absolute;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 16px;
  }

  .control-button {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-4);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--surface-5);
    }

    &.active {
      background: var(--primary);

      &:hover {
        filter: brightness(1.1);
      }
    }

    &.end-call {
      background: var(--error);

      &:hover {
        filter: brightness(1.1);
      }
    }
  }

  .quality-selector {
    select {
      padding: 8px 12px;
      background: var(--surface-4);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      cursor: pointer;

      &:focus {
        outline: none;
        background: var(--surface-5);
      }
    }
  }
</style> 