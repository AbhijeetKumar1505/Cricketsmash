import * as THREE from 'three';
import { preloadCharacter, instantiateCharacter } from '../game/CharacterManager.js';
import { AnimationManager } from '../game/AnimationManager.js';
import type { PlayerId } from '../game/CharacterManager.js';

/**
 * Standalone Three.js scene for the reactive hero character panel.
 * Rendered into its own canvas (separate from the main game renderer).
 *
 * Position: x=0, y=-1.5, z=3.5 — character centered, scale 1.5×
 */
export class CharacterPanel {
  private readonly _gl: THREE.WebGLRenderer;
  private readonly _scene: THREE.Scene;
  private readonly _camera: THREE.PerspectiveCamera;
  private readonly _anim: AnimationManager;
  private readonly _clock = new THREE.Clock();

  private _raf = 0;
  private _currentId: PlayerId | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this._gl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this._gl.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this._gl.outputColorSpace = THREE.SRGBColorSpace;
    this._gl.toneMapping = THREE.ACESFilmicToneMapping;
    this._gl.toneMappingExposure = 1.1;
    this._gl.setClearColor(0x000000, 0);

    this._scene = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 50);
    this._camera.position.set(0, 1.2, 4.5);
    this._camera.lookAt(0, 1.0, 0);

    this._anim = new AnimationManager();

    this._buildLighting();
    this._loop = this._loop.bind(this);
  }

  private _buildLighting(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this._scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffeedd, 1.8);
    key.position.set(1.5, 3, 3);
    this._scene.add(key);

    const fill = new THREE.DirectionalLight(0x4488ff, 0.7);
    fill.position.set(-2, 1, 1);
    this._scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffaa44, 0.5);
    rim.position.set(0, 2, -3);
    this._scene.add(rim);
  }

  async setCharacter(id: PlayerId): Promise<void> {
    if (this._currentId === id) return;

    // Remove previous character
    const prev = this._scene.getObjectByName('__hero_char__');
    if (prev) this._scene.remove(prev);
    this._anim.detach();

    await preloadCharacter(id);
    const char = instantiateCharacter(id);
    if (!char) return;

    this._currentId = id;
    char.root.name = '__hero_char__';

    // Position: spec says x=0, y=-1.5, z=3.5 (relative to scene origin)
    char.root.position.set(0, -1.5, 0);
    char.root.scale.setScalar(1.5);

    this._scene.add(char.root);
    this._anim.attach(char);
    this._anim.setState('IDLE');
  }

  triggerAnimation(
    state: 'CELEBRATE' | 'BAT_SWING' | 'BAT_BIG_HIT' | 'BAT_HUGE_HIT' | 'ANGRY' | 'INSURANCE' | 'IDLE',
  ): void {
    this._anim.setState(state);
    // Auto-return to idle for non-looping states
    if (state !== 'IDLE') {
      setTimeout(() => this._anim.setState('IDLE'), 1800);
    }
  }

  start(): void {
    if (this._raf) return;
    this._clock.start();
    this._loop();
  }

  stop(): void {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  resize(width: number, height: number): void {
    this._gl.setSize(width, height);
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.stop();
    this._anim.detach();
    this._gl.dispose();
  }

  private _loop(): void {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(this._clock.getDelta(), 0.05);

    // Slow orbital drift for cinematic feel
    const t = performance.now() * 0.0003;
    this._camera.position.x = Math.sin(t) * 0.35;
    this._camera.lookAt(0, 1.0, 0);

    this._anim.update(dt);
    this._gl.render(this._scene, this._camera);
  }
}
