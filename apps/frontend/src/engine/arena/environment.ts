import * as THREE from 'three';
import { GrassShader, DustShader } from './shaders.js';

export interface ArenaEnvironment {
  group: THREE.Group;
  grassMat: THREE.ShaderMaterial;
  ambientDust: THREE.Points;
  update: (time: number) => void;
}

export function createEnvironment(): ArenaEnvironment {
  const group = new THREE.Group();

  // 1. Dynamic Wave Grass Layer (Expansive Ground)
  const grassGeo = new THREE.PlaneGeometry(160, 160, 64, 64);
  grassGeo.rotateX(-Math.PI / 2);
  const grassMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 }
    },
    vertexShader: GrassShader.vertexShader,
    fragmentShader: GrassShader.fragmentShader,
    transparent: true,
    depthWrite: false
  });
  const grassNode = new THREE.Mesh(grassGeo, grassMat);
  grassNode.position.y = 0.005; // Slightly above real ground
  group.add(grassNode);

  // 1b. Neon Pitch Boundaries (Reactive Accents)
  const pitchBorderGeo = new THREE.PlaneGeometry(24, 64);
  const pitchBorderMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const pitchBorder = new THREE.Mesh(pitchBorderGeo, pitchBorderMat);
  pitchBorder.rotation.x = -Math.PI / 2;
  pitchBorder.position.y = 0.01;
  group.add(pitchBorder);

  // 2. Ambient Floating Atmosphere Motes
  const dustCount = 800;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(dustCount * 3);
  const dCol = new Float32Array(dustCount * 3);
  const dSize = new Float32Array(dustCount);
  
  for (let i = 0; i < dustCount; i++) {
    // Fill the arena bounding box
    dPos[i*3] = (Math.random() - 0.5) * 60;
    dPos[i*3+1] = Math.random() * 20;
    dPos[i*3+2] = (Math.random() - 0.5) * 60;
    
    // Golden atmospheric tint
    dCol[i*3] = 0.8 + Math.random() * 0.2;
    dCol[i*3+1] = 0.7 + Math.random() * 0.2;
    dCol[i*3+2] = 0.4 + Math.random() * 0.2;
    
    dSize[i] = Math.random() * 2.5 + 1.0;
  }
  
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
  dGeo.setAttribute('size', new THREE.BufferAttribute(dSize, 1));
  
  const dMat = new THREE.ShaderMaterial({
    vertexShader: DustShader.vertexShader,
    fragmentShader: DustShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  
  const ambientDust = new THREE.Points(dGeo, dMat);
  group.add(ambientDust);

  return {
    group,
    grassMat,
    ambientDust,
    update: (time: number) => {
      // Drive Grass Wind Shaders
      grassMat.uniforms.time.value = time;
      
      // Slowly rotate the entire dust cluster volume over time
      ambientDust.rotation.y = time * 0.02;
      // Gentle bobbing
      ambientDust.position.y = Math.sin(time * 0.3) * 0.5;
    }
  };
}
