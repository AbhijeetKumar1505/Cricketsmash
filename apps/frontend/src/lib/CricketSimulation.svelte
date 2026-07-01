<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EngineBridge } from '../bridge/EngineBridge.js';
  import { bindBridge }   from '../core/gameController.svelte.js';
  import { navigationState } from '../core/navigation.svelte.js';
  import { preloadAll } from '../game/CharacterManager.js';
  import { bonusGLBAssets } from '../render/entities/BonusGLBAssets.js';

  let host: HTMLDivElement;
  let engineBridge: EngineBridge | null = null;
  let ro: ResizeObserver | null = null;

  onMount(() => {
    // Kick off all GLB fetches immediately so Renderer._initGlbOverlays hits cache.
    // Bonus props (rover/spider/aircraft) are large — start them here, in parallel with
    // characters, instead of waiting for the Renderer constructor, so the download
    // overlaps scene init rather than appearing seconds late.
    void preloadAll();
    void bonusGLBAssets.preload();

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    host.appendChild(canvas);

    const rect = host.getBoundingClientRect();
    const params = new URLSearchParams(window.location.search);
    const debug = params.get('debug') === '1';
    engineBridge = new EngineBridge(canvas, rect.width || 720, rect.height || 400, {
      debug,
      batsmanAvatarId: navigationState.selectedAvatarId,
    });

    bindBridge(engineBridge);
    engineBridge.start();

    ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) engineBridge?.resize(r.width, r.height);
    });
    ro.observe(host);
  });

  onDestroy(() => {
    ro?.disconnect();
    engineBridge?.destroy();
    engineBridge = null;
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
