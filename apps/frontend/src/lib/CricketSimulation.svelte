<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ArenaScene } from '../engine/ArenaScene';
  import type { EngineProps } from '../engine/CricketWebGLEngine.js';
  import type { CameraPerspective } from '../engine/camera.js';
  import type { SimPhase } from '../engine/physics/ballTrajectory.js';
  import type { ShotType } from '../core/modeEngine.js';

  let {
    phase = 'idle',
    multiplier = 1,
    hitTrajectory = 'neutral' as 'six' | 'four' | 'neutral',
    bowlerType = 'Fast' as 'Fast' | 'Spin' | 'Swing',
    runs = 0,
    deliveryKey = 0,
    perspective = 'broadcast' as CameraPerspective,
    phaseProgress = 0,
    shotType = 'defend' as ShotType,
    shotLabel = '',
  } = $props<{
    phase?: SimPhase;
    multiplier?: number;
    hitTrajectory?: 'six' | 'four' | 'neutral';
    bowlerType?: 'Fast' | 'Spin' | 'Swing';
    runs?: number;
    deliveryKey?: number;
    perspective?: CameraPerspective;
    phaseProgress?: number;
    shotType?: ShotType;
    shotLabel?: string;
  }>();

  let host: HTMLDivElement;
  let engine: ArenaScene | null = null;
  let ro: ResizeObserver | null = null;

  function syncEngineProps(): EngineProps {
    return {
      phase,
      multiplier,
      hitTrajectory,
      bowlerType,
      runs,
      deliveryKey,
      perspective,
      phaseProgress,
      shotType,
      shotLabel,
    };
  }

  onMount(() => {
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    host.appendChild(canvas);

    const rect = host.getBoundingClientRect();
    engine = new ArenaScene(canvas, rect.width || 720, rect.height || 400, syncEngineProps());

    ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        engine?.resize(r.width, r.height);
      }
    });
    ro.observe(host);
  });

  $effect(() => {
    engine?.updateProps(syncEngineProps());
  });

  onDestroy(() => {
    ro?.disconnect();
    engine?.dispose();
    engine = null;
  });
</script>

<div class="sim-wrap">
  <div class="stage" bind:this={host}></div>
</div>

<style>
  .sim-wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .stage {
    width: 100%;
    height: 100%;
  }

  .stage :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
