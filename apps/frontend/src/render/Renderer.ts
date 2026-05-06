import * as THREE from 'three';
import type { EngineSnapshot } from '../engine/GameEngine.js';
import { DoodleAssets } from './doodle/DoodleAssets.js';
import { Scene } from './Scene.js';
import { Camera } from './Camera.js';
import { BallEntity } from './entities/Ball.js';
import { BatsmanEntity } from './entities/Batsman.js';
import { BowlerEntity } from './entities/Bowler.js';
import { StadiumEntity } from './entities/Stadium.js';
import { FielderEntity, FIELDER_POSITIONS } from './entities/Fielder.js';
import type { Renderable } from '../engine/loop/GameLoop.js';

export class Renderer implements Renderable {
  private readonly gl: THREE.WebGLRenderer;
  private readonly scene: Scene;
  private readonly cam: Camera;
  private readonly assets: DoodleAssets;
  private readonly ball: BallEntity;
  private readonly batsman: BatsmanEntity;
  private readonly bowler: BowlerEntity;
  private readonly stadium: StadiumEntity;
  private readonly fielders: FielderEntity[];

  private snapshot: EngineSnapshot | null = null;
  private _lastTime = 0;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.gl.setSize(width, height);
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = false;

    this.assets = new DoodleAssets();
    this.scene = new Scene();
    this.cam = new Camera(width / height);

    this.stadium = new StadiumEntity(this.assets);
    this.bowler = new BowlerEntity(this.assets);
    this.batsman = new BatsmanEntity(this.assets);
    this.ball = new BallEntity(this.assets);

    this.fielders = FIELDER_POSITIONS.map(
      ([x, z, facing], i) => new FielderEntity(x, z, facing, this.assets, i, i === 0),
    );

    this.scene.add(this.stadium.root);
    for (const f of this.fielders) this.scene.add(f.root);
    this.scene.add(this.bowler.root);
    this.scene.add(this.batsman.root);
    this.scene.add(this.ball.root);
  }

  setSnapshot(snap: EngineSnapshot): void {
    this.snapshot = snap;
  }

  updateScoreboard(ballIdx: number, totalBalls: number, multiplier: number): void {
    this.stadium.updateScoreboard(ballIdx, totalBalls, multiplier);
  }

  render(): void {
    const now = performance.now() * 0.001;
    const dt = this._lastTime > 0 ? Math.min(now - this._lastTime, 0.05) : 0;
    this._lastTime = now;

    this.stadium.updateAnimations(dt, this.cam.three);

    if (!this.snapshot) {
      this.gl.render(this.scene.three, this.cam.three);
      return;
    }

    const { ball, batsman, bowler, feedback } = this.snapshot;
    const camera = this.cam.three;

    this.ball.update(ball);
    this.batsman.update(batsman, camera);
    this.bowler.update(bowler, camera);
    for (const f of this.fielders) f.update(camera);

    this.cam.update(this.snapshot, feedback.shakeOffset);
    this.gl.render(this.scene.three, this.cam.three);
  }

  resize(width: number, height: number): void {
    this.gl.setSize(width, height);
    this.cam.resize(width / height);
  }

  dispose(): void {
    this.gl.dispose();
    this.ball.dispose();
    this.batsman.dispose();
    this.bowler.dispose();
    this.stadium.dispose();
    for (const f of this.fielders) f.dispose();
    this.assets.dispose();
  }
}
