// The front doors of the museum, seen from inside the entrance hall: carved walnut doors under
// a fanlight, in a temple front of two columns, an entablature and a pediment.
// Built in the wall's frame: x along the wall from the middle of the doorway, y up from the
// floor, negative z towards the room; the door leaves sit inside the wall's thickness.
import * as THREE from 'three';
import { matrix } from './batch.js';
import { ring } from './doorways.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n = 20) => new THREE.CylinderGeometry(r0, r1, h, n);
const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });

// the fanlight over the doors: glass showing the sky, with bars
function fanlight(add, M, w2, spring, barMaterial, { rays = 9, rings = [0.45] } = {}) {
  const fan = new THREE.Shape(); fan.absarc(0, 0, w2, 0, Math.PI, false); fan.closePath();
  add(new THREE.ShapeGeometry(fan, 32), M.laylight, matrix({ y: spring, z: 0.12, ry: Math.PI }));
  for (let i = 0; i <= rays; i++) {
    const a = (i / rays) * Math.PI;
    add(box(0.04, w2, 0.05), barMaterial, matrix({ x: Math.cos(a) * w2 / 2, y: spring + Math.sin(a) * w2 / 2, z: 0.1, rz: a - Math.PI / 2 }));
  }
  for (const r of rings) add(new THREE.TorusGeometry(r * w2, 0.025, 6, 32, Math.PI), barMaterial, matrix({ y: spring, z: 0.1 }));
  add(box(2 * w2, 0.1, 0.12), barMaterial, matrix({ y: spring, z: 0.1 }));
}

// a pair of leaves; panel(cx, lw, s) draws one leaf's details
function leaves(add, material, w2, spring, panel) {
  for (const s of [-1, 1]) {
    const lw = w2 - 0.02, cx = s * w2 / 2;
    add(box(lw, spring, 0.08), material, matrix({ x: cx, y: spring / 2, z: 0.1 }));
    panel(cx, lw, s);
  }
}

function temple(add, M, w2, spring) {
  leaves(add, M.door, w2, spring, (cx, lw, s) => {
    for (const [py, ph] of [[0.55, 0.7], [1.95, 1.7], [3.2, 0.5]]) {
      add(box(lw - 0.3, ph + 0.12, 0.03), M.wood, matrix({ x: cx, y: py, z: 0.05 }));      // moulded frame
      add(box(lw - 0.46, ph - 0.04, 0.04), M.door, matrix({ x: cx, y: py, z: 0.035 }));   // raised field
    }
    add(cyl(0.11, 0.11, 0.04), M.wood, matrix({ x: cx, y: 1.95, z: 0.012, rx: Math.PI / 2 })); // carved rosettes
    add(cyl(0.07, 0.07, 0.06), M.gilt, matrix({ x: cx, y: 1.95, z: 0.0, rx: Math.PI / 2 }));
    add(cyl(0.022, 0.022, 0.55, 10), M.brass, matrix({ x: s * 0.17, y: 1.25, z: 0.0 }));     // bar handles
  });
  fanlight(add, M, w2, spring, M.door);
  add(ring(w2, w2 + 0.2, spring, 0.1), M.stone, matrix({ z: -0.1 }));
  // two columns on pedestals, an entablature and a pediment
  const cx = w2 + 0.75, pedH = 0.9, colTop = spring + w2 + 0.45, shaft = colTop - pedH - 0.5;
  for (const s of [-1, 1]) {
    const x = s * cx;
    add(box(0.8, pedH, 0.75), M.stone, matrix({ x, y: pedH / 2, z: -0.37 }));
    add(box(0.9, 0.12, 0.85), M.stone, matrix({ x, y: pedH + 0.06, z: -0.42 }));
    add(new THREE.TorusGeometry(0.29, 0.06, 8, 24), M.stone, matrix({ x, y: pedH + 0.18, z: -0.36, rx: Math.PI / 2 }));
    add(cyl(0.25, 0.29, shaft, 28), M.marble, matrix({ x, y: pedH + 0.2 + shaft / 2, z: -0.36 }));
    const cy = pedH + 0.2 + shaft;
    add(box(0.62, 0.16, 0.62), M.stone, matrix({ x, y: cy + 0.08, z: -0.36 }));
    for (const v of [-1, 1]) add(cyl(0.1, 0.1, 0.62, 16), M.stone, matrix({ x: x + v * 0.3, y: cy + 0.05, z: -0.36, rx: Math.PI / 2 })); // volutes
    add(box(0.72, 0.08, 0.72), M.stone, matrix({ x, y: cy + 0.2, z: -0.36 }));
  }
  const ey = colTop - 0.26, span = 2 * cx + 0.9;
  add(box(span, 0.34, 0.6), M.stone, matrix({ y: ey + 0.17, z: -0.3 }));          // architrave
  add(box(span - 0.06, 0.5, 0.5), M.stone, matrix({ y: ey + 0.59, z: -0.25 }));    // frieze
  add(box(span + 0.36, 0.22, 0.86), M.stone, matrix({ y: ey + 0.95, z: -0.43 }));  // cornice
  const base = span / 2 + 0.1, rise = 1.15, py = ey + 1.06;
  const tri = new THREE.Shape(); tri.moveTo(-base, 0); tri.lineTo(base, 0); tri.lineTo(0, rise); tri.closePath();
  add(extrude(tri, 0.3), M.stone, matrix({ y: py, z: -0.3 }));
  const slope = Math.atan2(rise, base), len = Math.hypot(rise, base) + 0.25;
  for (const s of [-1, 1]) add(box(len, 0.2, 0.86), M.stone, matrix({ x: s * base / 2, y: py + rise / 2 + 0.06, z: -0.43, rz: -s * slope }));
}

export function frontDoors(add, M, width, spring) {
  temple(add, M, width / 2, spring);
}
