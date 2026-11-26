// A doorway into a room that has no photos yet: it stays open, with a red velvet rope on brass
// posts across it and a small "Coming soon" sign, until the owner hangs photos there.
// Built in the wall's frame like the doorway itself: x along the wall from the doorway's centre,
// y up from the threshold, negative z towards the visitor.
import * as THREE from 'three';
import { matrix } from './batch.js';
import { canvasTexture } from './textures.js';

const SERIF = 'Georgia, "Times New Roman", serif';

// (a new texture for each gallery built: the old gallery's are freed with it)
function comingSoon() {
  return canvasTexture(700, 240, (g, w, h) => {
    g.fillStyle = '#1d1712'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8954a'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.lineWidth = 2; g.strokeRect(24, 24, w - 48, h - 48);
    g.fillStyle = '#e2c47c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `78px ${SERIF}`; g.fillText('Coming soon', w / 2, h / 2 + 4);
  });
}

export function closedDoorway(add, M, width) {
  const w2 = width / 2, z = -0.32; // just in front of the doorway, on the visitor's side
  for (const s of [-1, 1]) {
    const x = s * (w2 - 0.05);
    add(new THREE.CylinderGeometry(0.17, 0.2, 0.04, 20), M.brass, matrix({ x, y: 0.02, z }));
    add(new THREE.CylinderGeometry(0.025, 0.03, 0.92, 12), M.brass, matrix({ x, y: 0.48, z }));
    add(new THREE.SphereGeometry(0.05, 14, 10), M.brass, matrix({ x, y: 0.96, z }));
  }
  const rope = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-(w2 - 0.05), 0.9, z), new THREE.Vector3(0, 0.55, z), new THREE.Vector3(w2 - 0.05, 0.9, z));
  add(new THREE.TubeGeometry(rope, 24, 0.028, 8), M.velvet, matrix({}));
  // the sign hanging on the rope, in a gilt frame
  const w = 0.72, h = 0.25, sz = z - 0.04;
  add(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.02), M.gilt, matrix({ y: 0.6, z: sz + 0.012 }));
  add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: comingSoon(), toneMapped: false }), matrix({ y: 0.6, z: sz - 0.002, ry: Math.PI }));
}
