// The classical stone frame round every arched doorway: a stepped moulding round the arch,
// a keystone at the top, imposts where the arch springs and plinths at the foot.
// Everything is built in the wall's own frame: x along the wall from the doorway's centre,
// y up from the threshold, negative z towards the room.
import * as THREE from 'three';
import { matrix } from './batch.js';

// a U-shaped band round the opening: two jambs and the arch, from radius r0 to r1
export function ring(r0, r1, spring, depth) {
  const s = new THREE.Shape();
  s.moveTo(-r1, 0); s.lineTo(-r1, spring); s.absarc(0, spring, r1, Math.PI, 0, true); s.lineTo(r1, 0);
  s.lineTo(r0, 0); s.lineTo(r0, spring); s.absarc(0, spring, r0, 0, Math.PI, false); s.lineTo(-r0, 0); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 24 });
}
const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// how far the frame reaches either side of the opening's centre at picture height
export const doorwayHalfWidth = width => width / 2 + 0.46;

// add a doorway frame. add(geometry, material, localMatrix) places a piece; returns the height
// for the sign above the keystone, and the top of the frame
export function doorway(add, M, width, spring) {
  const w2 = width / 2, top = spring + w2;
  add(ring(w2, w2 + 0.14, spring, 0.07), M.stone, matrix({ z: -0.07 }));
  add(ring(w2 + 0.14, w2 + 0.3, spring, 0.12), M.stone, matrix({ z: -0.12 }));
  add(ring(w2 + 0.3, w2 + 0.36, spring, 0.16), M.stone, matrix({ z: -0.16 }));
  for (const s of [-1, 1]) {
    add(box(0.5, 0.34, 0.22), M.stone, matrix({ x: s * (w2 + 0.2), y: 0.17, z: -0.11 }));       // plinth
    add(box(0.52, 0.16, 0.22), M.stone, matrix({ x: s * (w2 + 0.2), y: spring - 0.08, z: -0.11 })); // impost
  }
  // the keystone, wider at the top
  const key = new THREE.Shape(), kb = top - 0.04, kt = top + 0.5;
  key.moveTo(-0.13, kb); key.lineTo(0.13, kb); key.lineTo(0.2, kt); key.lineTo(-0.2, kt); key.closePath();
  add(extrude(key, 0.22), M.stone, matrix({ z: -0.22 }));
  add(box(0.48, 0.07, 0.26), M.stone, matrix({ y: kt + 0.035, z: -0.13 }));
  return { sign: kt + 0.4, top: kt + 0.07 };
}
