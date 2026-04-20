import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { createWebGLRenderer } from './renderer';
import { createScene } from './scene';
import { StadiumCameraRig } from './camera';
import { CameraSystem } from './CameraSystem';
import { LightingSystem } from './LightingSystem';
import { BallSystem } from './BallSystem';
import { CrowdSystem } from './CrowdSystem';
import { LedBannerSystem } from './arena/ledBanners';
import { SponsorBannerSystem } from './arena/sponsorBanners';
import { createStadiumStructure, type StadiumStructure } from './arena/stadiumStructure';
import type { EngineProps } from './CricketWebGLEngine.js';

/**
 * ArenaScene — central orchestrator for the modular 3D engine.
 * Manages systems, wires cross-system data (ball pos → camera, ball light),
 * and drives the render loop.
 */
export class ArenaScene {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  readonly cameraRig: StadiumCameraRig;

  private cameraSystem: CameraSystem;
  private lightingSystem: LightingSystem;
  private ballSystem: BallSystem;
  private crowdSystem: CrowdSystem;
  private ledBanners: LedBannerSystem;
  private sponsorBanners: SponsorBannerSystem;
  private stadiumStructure: StadiumStructure;
  private bloomPass: UnrealBloomPass;

  private rafId = 0;
  private lastT = performance.now() / 1000;
  private time = 0;
  private props: EngineProps;
  private prevPhase: string = 'idle';
  private prevTrajectory: string = 'neutral';
  private disposeRenderer: () => void;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, initialProps: EngineProps) {
    this.props = initialProps;

    const { renderer, dispose } = createWebGLRenderer(canvas);
    this.renderer = renderer;
    this.disposeRenderer = dispose;
    this.renderer.setSize(width, height, false);

    this.scene = createScene();
    this.scene.fog = new THREE.FogExp2(0x02020b, 0.012);

    const cam = new THREE.PerspectiveCamera(40, width / height, 0.1, 200);
    this.cameraRig = new StadiumCameraRig(cam);
    this.scene.add(this.cameraRig.group);
    this.cameraSystem = new CameraSystem(this.cameraRig);

    this.lightingSystem = new LightingSystem(this.scene);
    this.ballSystem = new BallSystem(this.scene);
    this.crowdSystem = new CrowdSystem(this.scene);

    // LED banners (multiplier display)
    this.ledBanners = new LedBannerSystem();
    this.scene.add(this.ledBanners.group);

    // Sponsor LED ribbon (parody brands)
    this.sponsorBanners = new SponsorBannerSystem();
    this.scene.add(this.sponsorBanners.group);

    // Stadium bowl, boundary boards, floodlight masts
    this.stadiumStructure = createStadiumStructure();
    this.scene.add(this.stadiumStructure.group);
    for (const spot of this.stadiumStructure.floodlightLights) {
      this.scene.add(spot);
      this.scene.add(spot.target);
    }

    // Post-processing
    const renderScene = new RenderPass(this.scene, this.cameraRig.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.4, 0.82);
    this.bloomPass.threshold = 0.82;
    this.bloomPass.strength = 0.35;
    this.bloomPass.radius = 0.5;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.render = this.render.bind(this);
    this.rafId = requestAnimationFrame(this.render);
  }

  updateProps(p: EngineProps) {
    this.props = p;
    this.cameraSystem.setPerspective(p.perspective);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.cameraRig.resize(w, h);
  }

  private render() {
    this.rafId = requestAnimationFrame(this.render);
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - this.lastT);
    this.lastT = now;
    this.time += dt;

    const ph = this.props.phase;
    const mult = this.props.multiplier;
    const traj = this.props.hitTrajectory;
    const runs = this.props.runs;

    // ── Transition detection ──
    if (ph !== this.prevPhase) {
      this.onPhaseTransition(this.prevPhase, ph, traj, runs, mult);
      this.prevPhase = ph;
    }

    if (ph === 'hit' && traj !== this.prevTrajectory) {
      this.onTrajectoryChange(traj, runs);
      this.prevTrajectory = traj;
    }

    // ── Updates ──
    this.lightingSystem.update(dt, this.time, this.props);
    this.ballSystem.update(dt, this.time, this.props);
    this.crowdSystem.update(dt, this.time, this.props);

    const ballPos = this.ballSystem.getBallWorldPos();
    const frame = this.ballSystem.getLastFrame();
    if (frame) {
      const lights = this.lightingSystem.getStadiumLights();
      lights.ballPoint.position.copy(ballPos);
      lights.ballPoint.color.setRGB(frame.glowRgb[0]!, frame.glowRgb[1]!, frame.glowRgb[2]!);
      lights.ballPoint.intensity = frame.glowStrength * 42;
    }

    this.cameraSystem.update(dt, this.time, this.props, ballPos);

    if (ph === 'hit') this.ledBanners.showMultiplier(mult);
    this.ledBanners.update(dt, ph);
    this.sponsorBanners.update(dt, ph);

    // Reactive bloom
    this.bloomPass.strength = ph === 'hit'
      ? 0.35 + Math.min(1.4, mult * 0.038)
      : 0.35;

    this.cameraRig.camera.lookAt(this.cameraRig.lookAtTarget);
    this.composer.render();
  }

  private onPhaseTransition(_prevPh: string, newPh: string, traj: string, runs: number, _mult: number) {
    switch (newPh) {
      case 'hit':
        if (traj === 'six') {
          this.sponsorBanners.triggerEvent('six');
          this.lightingSystem.triggerFlicker();
        } else if (traj === 'four') {
          this.sponsorBanners.triggerEvent('four');
        } else if (runs === 0) {
          this.sponsorBanners.triggerEvent('miss');
        }
        break;

      case 'wicket':
        this.sponsorBanners.triggerEvent('wicket');
        this.lightingSystem.triggerFlicker();
        break;

      case 'celebrate':
        this.lightingSystem.triggerFlicker();
        break;
    }
  }

  private onTrajectoryChange(traj: string, runs: number) {
    if (traj === 'six') {
      this.sponsorBanners.triggerEvent('six');
      this.lightingSystem.triggerFlicker();
    } else if (traj === 'four') {
      this.sponsorBanners.triggerEvent('four');
    } else if (runs === 0) {
      this.sponsorBanners.triggerEvent('miss');
    }
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.cameraSystem.dispose();
    this.ballSystem.dispose();
    this.crowdSystem.dispose();
    this.ledBanners.dispose();
    this.sponsorBanners.dispose();
    this.stadiumStructure.dispose();
    this.disposeRenderer();
  }
}
