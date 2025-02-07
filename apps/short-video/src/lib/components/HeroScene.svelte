<!-- HeroScene.svelte -->
<script lang="ts">
  import { T } from '@threlte/core';
  import { useFrame } from '@threlte/core';
  import { onMount } from 'svelte';
  import * as THREE from 'three';

  let particles: THREE.Points;
  const clock = new THREE.Clock();
  const particleCount = 1000;
  const particleGeometry = new THREE.BufferGeometry();
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.02,
    color: 0x00FFFF,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  // Create particle positions
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  onMount(() => {
    particles = new THREE.Points(particleGeometry, particleMaterial);
    clock.start();
  });

  // Animate particles
  useFrame(() => {
    if (particles) {
      particles.rotation.y += 0.001;
      const positions = particles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3 + 1] += Math.sin(clock.getElapsedTime() * 0.1 + i * 0.1) * 0.001;
      }
      particles.geometry.attributes.position.needsUpdate = true;
    }
  });
</script>

<T.PerspectiveCamera
  position={[0, 0, 5]}
  fov={75}
  makeDefault
>
  <T.AmbientLight intensity={0.5} />
  <T.DirectionalLight position={[10, 10, 10]} intensity={1} />
  
  {#if particles}
    <T is={particles} />
  {/if}
</T.PerspectiveCamera> 