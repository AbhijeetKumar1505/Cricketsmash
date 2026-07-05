<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { gameBus } from '../../game/GameEventBus.js';

  let {
    camera = null as THREE.Camera | null,
    containerWidth = 800,
    containerHeight = 600,
  } = $props<{
    camera?: THREE.Camera | null;
    containerWidth?: number;
    containerHeight?: number;
  }>();

  interface Popup {
    id: number;
    x: number;
    y: number;
    quality: string;
    multiplier: number;
    born: number;
  }

  let popups = $state<Popup[]>([]);
  let _counter = 0;

  const DURATION_MS = 1400;

  function project(wx: number, wy: number, wz: number): { x: number; y: number } | null {
    if (!camera) return null;
    const v = new THREE.Vector3(wx, wy, wz);
    v.project(camera);
    const x = (v.x * 0.5 + 0.5) * containerWidth;
    const y = (-v.y * 0.5 + 0.5) * containerHeight;
    return { x, y };
  }

  function qualityLabel(q: string, mult: number): string {
    if (q === 'miss') return 'MISS';
    if (mult >= 10) return 'PERFECT HIT';
    if (mult > 3)   return 'MEGA HIT';
    if (q === 'good') return 'GOOD HIT';
    return 'HIT';
  }

  function qualityColor(q: string, mult: number): string {
    if (q === 'miss') return '#ff4444';
    if (mult >= 10) return '#ffd700';
    if (mult >= 3)  return '#44ddff';
    return '#88ff88';
  }

  let _unsub: (() => void) | null = null;

  onMount(() => {
    _unsub = gameBus.on('HIT_POPUP', ({ quality, multiplier, worldX, worldY, worldZ }) => {
      const pos = project(worldX, worldY + 0.8, worldZ);
      if (!pos) return;
      const id = ++_counter;
      popups = [...popups, { id, x: pos.x, y: pos.y, quality, multiplier, born: Date.now() }];
      setTimeout(() => {
        popups = popups.filter(p => p.id !== id);
      }, DURATION_MS);
    });

    // Tick to update positions while popups are alive (optional drift)
    let raf = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      // Recalculate positions each frame if camera available
    }
    tick();
    return () => cancelAnimationFrame(raf);
  });

  onDestroy(() => {
    _unsub?.();
  });

  function popupStyle(p: Popup): string {
    const age = (Date.now() - p.born) / DURATION_MS;
    const scale = age < 0.15 ? (age / 0.15) * 1.15 : 1 + (1 - age) * 0.08;
    const opacity = age > 0.65 ? 1 - ((age - 0.65) / 0.35) : 1;
    const floatY = age * -55;
    const color = qualityColor(p.quality, p.multiplier);
    return [
      `left:${p.x}px`,
      `top:${p.y + floatY}px`,
      `transform:translate(-50%,-50%) scale(${scale.toFixed(3)})`,
      `opacity:${opacity.toFixed(3)}`,
      `color:${color}`,
      `text-shadow:0 0 18px ${color}`,
    ].join(';');
  }
</script>

{#each popups as p (p.id)}
  <div class="hit-popup" style={popupStyle(p)}>
    {qualityLabel(p.quality, p.multiplier)}
  </div>
{/each}

<style>
  .hit-popup {
    position: absolute;
    pointer-events: none;
    font-family: 'Outfit', sans-serif;
    font-size: 0.85rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    white-space: nowrap;
    z-index: 40;
    will-change: transform, opacity;
    -webkit-font-smoothing: antialiased;
  }
</style>
