<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EngineBridge } from '../bridge/EngineBridge.js';
  import { bindBridge }   from '../core/gameController.svelte.js';

  let host: HTMLDivElement;
  let engineBridge: EngineBridge | null = null;
  let ro: ResizeObserver | null = null;

  onMount(() => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    host.appendChild(canvas);

    const rect = host.getBoundingClientRect();
    const params = new URLSearchParams(window.location.search);
    const debug = params.get('debug') === '1';
    engineBridge = new EngineBridge(canvas, rect.width || 720, rect.height || 400, { debug });

    // Wire engine events → game controller reactive state
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
