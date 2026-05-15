import * as THREE from 'three';
import { StadiumEntity } from './entities/Stadium.js';
import { DoodleAssets } from './doodle/DoodleAssets.js';

export class WelcomeScene {
  private readonly gl: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly assets: DoodleAssets;
  private readonly stadium: StadiumEntity;
  private readonly trophy: THREE.Group;
  private readonly ball: THREE.Group;
  
  private _time = 0;
  private _lastTime = 0;
  private _frameId = 0;

  constructor(canvas: HTMLCanvasElement) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.gl.setSize(width, height, false);
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 8, 25);
    this.camera.lookAt(0, 2, 0);

    this.assets = new DoodleAssets();
    this.stadium = new StadiumEntity(this.assets);
    this.scene.add(this.stadium.root);

    // Add ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    // Main spotlight on the trophy
    const spot = new THREE.SpotLight(0xffc800, 200);
    spot.position.set(0, 15, 5);
    spot.angle = Math.PI / 6;
    spot.penumbra = 0.5;
    spot.decay = 2;
    spot.distance = 50;
    this.scene.add(spot);

    // Build stylized trophy
    this.trophy = this.buildTrophy();
    this.trophy.position.set(0, 3, 0);
    this.scene.add(this.trophy);

    // Build rotating ball
    this.ball = this.buildBall();
    this.ball.position.set(6, 4, -2);
    this.scene.add(this.ball);

    this.animate();
  }

  private buildTrophy(): THREE.Group {
    const group = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.1,
      envMapIntensity: 1,
    });

    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 32), goldMat);
    group.add(base);

    // Stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 16), goldMat);
    stem.position.y = 1.9;
    group.add(stem);

    // Bowl
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
    bowl.position.y = 3.4;
    bowl.rotation.x = Math.PI;
    group.add(bowl);

    // Handles
    const handleGeo = new THREE.TorusGeometry(0.8, 0.1, 16, 32, Math.PI);
    const handleL = new THREE.Mesh(handleGeo, goldMat);
    handleL.position.set(-1.1, 4.2, 0);
    handleL.rotation.z = Math.PI / 2;
    group.add(handleL);

    const handleR = new THREE.Mesh(handleGeo, goldMat);
    handleR.position.set(1.1, 4.2, 0);
    handleR.rotation.z = -Math.PI / 2;
    group.add(handleR);

    return group;
  }

  private buildBall(): THREE.Group {
    const group = new THREE.Group();
    const ballGeo = new THREE.SphereGeometry(0.8, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xcc2020,
      roughness: 0.4,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(ballGeo, ballMat);
    group.add(mesh);

    // Stitching
    const stitchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ringGeo = new THREE.TorusGeometry(0.81, 0.02, 8, 64);
    const ring = new THREE.Mesh(ringGeo, stitchMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    return group;
  }

  private animate = () => {
    this._frameId = requestAnimationFrame(this.animate);
    
    const now = performance.now() * 0.001;
    const dt = this._lastTime > 0 ? now - this._lastTime : 0;
    this._lastTime = now;
    this._time += dt;

    // Orbit camera
    const radius = 22 + Math.sin(this._time * 0.2) * 3;
    this.camera.position.x = Math.cos(this._time * 0.15) * radius;
    this.camera.position.z = Math.sin(this._time * 0.15) * radius;
    this.camera.position.y = 6 + Math.sin(this._time * 0.3) * 4;
    this.camera.lookAt(0, 3, 0);

    // Animate trophy
    this.trophy.rotation.y += dt * 0.5;
    this.trophy.position.y = 3 + Math.sin(this._time * 1.5) * 0.2;

    // Animate ball
    this.ball.rotation.y += dt * 2;
    this.ball.rotation.x += dt * 1;
    this.ball.position.y = 5 + Math.sin(this._time * 2) * 0.5;
    this.ball.position.x = 8 * Math.cos(this._time * 0.4);
    this.ball.position.z = 8 * Math.sin(this._time * 0.4);

    // Update stadium (crowd wave, etc.)
    this.stadium.updateAnimations(dt, this.camera, 'idle');

    this.gl.render(this.scene, this.camera);
  };

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.gl.setSize(width, height, false);
  }

  dispose(): void {
    cancelAnimationFrame(this._frameId);
    this.gl.dispose();
    this.stadium.dispose();
    this.assets.dispose();
  }
}
