<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { preloadCharacter, instantiateCharacter } from '../../game/CharacterManager.js';
  import type { PlayerId } from '../../game/CharacterManager.js';

  let {
    playerId,
    fullBody   = false,
    brightness = 1.0,
    renderW,
    renderH,
  }: {
    playerId:    PlayerId;
    fullBody?:   boolean;
    brightness?: number;
    renderW?:    number;
    renderH?:    number;
  } = $props();

  let canvasEl: HTMLCanvasElement;
  let raf = 0;
  let renderer: THREE.WebGLRenderer | null = null;

  onMount(async () => {
    const W = renderW ?? (fullBody ? 120 : 96);
    const H = renderH ?? (fullBody ? 200 : 96);

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15 * brightness;

    const scene = new THREE.Scene();

    // Warm key from upper-left
    const key = new THREE.DirectionalLight(0xfffbe8, 2.6 * brightness);
    key.position.set(-1, 2.5, 2.5);
    scene.add(key);
    // Cool rim from behind-right
    const rim = new THREE.DirectionalLight(0x3355dd, 0.7 * brightness);
    rim.position.set(1.5, 1, -2);
    scene.add(rim);
    // Soft bottom bounce (green grass feel)
    const bounce = new THREE.PointLight(0x224411, 0.6 * brightness, 5);
    bounce.position.set(0, -0.5, 0.5);
    scene.add(bounce);
    // Fill from front — extra brightness for fullBody showcase
    if (fullBody) {
      const fill = new THREE.DirectionalLight(0xfff5e0, 1.4 * brightness);
      fill.position.set(0.5, 1.5, 3);
      scene.add(fill);
    }
    // Ambient fill
    scene.add(new THREE.AmbientLight(0x998866, (fullBody ? 0.65 : 0.35) * brightness));

    const cam = new THREE.PerspectiveCamera(fullBody ? 42 : 36, W / H, 0.05, 40);

    await preloadCharacter(playerId);
    const inst = instantiateCharacter(playerId);

    if (inst) {
      // Normalise height to 1.7 units, feet at y=0
      const box = new THREE.Box3().setFromObject(inst.root);
      const h = box.max.y - box.min.y;
      const s = h > 0.01 ? 1.7 / h : 1;
      inst.root.scale.setScalar(s);
      inst.root.position.y = -box.min.y * s;
      scene.add(inst.root);

      if (fullBody) {
        // Frame full body with comfortable head + foot padding
        cam.position.set(0, 0.95, 2.55);
        cam.lookAt(0, 0.88, 0);
      } else {
        // Head/upper-chest portrait focus
        const focusY = 1.7 * 0.80;
        cam.position.set(0, focusY + 0.1, 1.05);
        cam.lookAt(0, focusY - 0.05, 0);
      }
    } else {
      cam.position.set(0, fullBody ? 0.9 : 1.2, fullBody ? 2.4 : 2);
      cam.lookAt(0, fullBody ? 0.85 : 1.0, 0);
    }

    let prev = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      if (inst) {
        inst.root.rotation.y = Math.sin(now * 0.00035) * 0.20 - 0.07;
        inst.mixer.update(dt);
      }
      renderer!.render(scene, cam);
    };
    loop();
  });

  onDestroy(() => {
    cancelAnimationFrame(raf);
    raf = 0;
    renderer?.dispose();
    renderer = null;
  });
</script>

<canvas
  bind:this={canvasEl}
  style="display:block; width:100%; height:100%;"
></canvas>
