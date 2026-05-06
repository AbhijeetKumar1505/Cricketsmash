import * as THREE from 'three';

function makePitchTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;

  g.fillStyle = '#c7a763'; // Darker cartoon tan for pitch
  g.fillRect(0, 0, 512, 128);

  g.strokeStyle = 'white';
  g.lineWidth = 4;
  // Creases
  g.beginPath(); g.moveTo(80, 15); g.lineTo(80, 113); g.stroke();
  g.beginPath(); g.moveTo(432, 15); g.lineTo(432, 113); g.stroke();
  g.beginPath(); g.moveTo(110, 0); g.lineTo(110, 128); g.stroke();
  g.beginPath(); g.moveTo(402, 0); g.lineTo(402, 128); g.stroke();

  return new THREE.CanvasTexture(c);
}

export function createPitchStrip(): THREE.Mesh {
  const pitchTex = makePitchTexture();
  const pitchGeo = new THREE.PlaneGeometry(3, 20);
  const pitchMat = new THREE.MeshPhongMaterial({ map: pitchTex });
  const pitch = new THREE.Mesh(pitchGeo, pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0.02, 0);
  return pitch;
}
