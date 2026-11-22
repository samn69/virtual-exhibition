// The two staircases.
// Entrance: oval marble steps, each smaller than the one below, rising to the central hall.
// Stairwell: a round tower behind the central hall with a spiral staircase around an open
// well, a bronze railing and a dome with an oculus. A visitor glides up or down it.
import * as THREE from 'three';
import { Batch, matrix } from './batch.js';
import { floorY, FLOOR_H, H, BASE, DOOR } from './constants.js';
import { wallShape, archTrim } from './shapes.js';
import { canvasTexture } from './textures.js';

export const STAIR = { cx: 0, cz: -13.8, r: 4.2, well: 1.7 };
const LANDING = 50;                  // degrees either side of the doorway
const STEPS = 22, RISE = FLOOR_H / (STEPS + 1), SPAN = 360 - 2 * LANDING, STEP_DEG = SPAN / STEPS;
const rad = d => (d * Math.PI) / 180;

// ── oval entrance steps ──
export const OVAL = { z: 9.6, count: 10, rise: BASE / 10 };
const ovalRadii = k => [5.6 + (1.8 - 5.6) * (k / (OVAL.count - 1)), 5.0 + (0.9 - 5.0) * (k / (OVAL.count - 1))];
export function ovalStepsHeight(x, z) {
  const dz = Math.max(0, z - OVAL.z);
  for (let k = OVAL.count - 1; k >= 0; k--) {
    const [rx, rz] = ovalRadii(k);
    if ((x / rx) ** 2 + (dz / rz) ** 2 <= 1) return (k + 1) * OVAL.rise;
  }
  return 0;
}

// a flat ring sector in the stairwell, as a shape seen from above
function sector(r0, r1, from, to, segments = 24) {
  const shape = new THREE.Shape(), pt = (r, d) => [r * Math.sin(rad(d)), -r * Math.cos(rad(d))];
  shape.moveTo(...pt(r1, from));
  for (let i = 1; i <= segments; i++) shape.lineTo(...pt(r1, from + ((to - from) * i) / segments));
  if (r0 > 0) for (let i = segments; i >= 0; i--) shape.lineTo(...pt(r0, from + ((to - from) * i) / segments));
  else shape.lineTo(0, 0);
  shape.closePath();
  return shape;
}
const slab = (shape, thickness) => new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1 });

function floorSign(label) {
  return canvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#1d1712'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8954a'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#d9bb72'; g.font = '64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, w / 2, h / 2 + 3);
  });
}

export function buildStairs({ floors, root, M, raycastTargets, entranceGroup, decor }) {
  const { cx, cz, r: R, well } = STAIR;
  const group = new THREE.Group();
  group.name = 'stairwell';
  root.add(group);
  const batch = new Batch();
  const stoneInside = M.stone.clone(); stoneInside.side = THREE.BackSide;
  const topY = floorY(floors - 1) + H;

  // round wall, open where it meets the doorways, and the dome with an oculus
  const open = Math.asin(1.2 / R);
  batch.add(new THREE.CylinderGeometry(R, R, topY - BASE, 72, 1, true, open, Math.PI * 2 - 2 * open), stoneInside, matrix({ x: cx, y: (topY + BASE) / 2, z: cz }));
  for (let f = 0; f < floors; f++) { // a moulded band at each floor
    batch.add(new THREE.CylinderGeometry(R - 0.12, R - 0.12, 0.26, 72, 1, true, open, Math.PI * 2 - 2 * open), stoneInside, matrix({ x: cx, y: floorY(f) + H - 0.13, z: cz }));
  }
  batch.add(new THREE.SphereGeometry(R, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), stoneInside, matrix({ x: cx, y: topY, z: cz }));
  batch.add(new THREE.CircleGeometry(0.95, 40), M.laylight, matrix({ x: cx, y: topY + R - 0.08, z: cz, rx: Math.PI / 2 }));

  // the stairwell side of each floor's doorway
  for (let f = 0; f < floors; f++) {
    const y = floorY(f), height = f < floors - 1 ? FLOOR_H : H;
    batch.add(new THREE.ExtrudeGeometry(wallShape(2.6, height, [{ u: 0, width: DOOR.width, spring: DOOR.spring, bottom: 0 }]), { depth: 0.5, bevelEnabled: false, curveSegments: 20 }), M.stone, matrix({ y, z: -9.9 }));
    batch.add(archTrim(DOOR.width, DOOR.spring), M.stone, matrix({ y, z: -9.95 }));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ map: floorSign(`Floor ${f + 1}`), toneMapped: false }));
    sign.position.set(0, y + DOOR.spring + DOOR.width / 2 + 0.6, -9.97);
    sign.rotation.y = Math.PI;
    group.add(sign);
  }

  // ground floor of the well, and a landing at every floor above
  batch.add(slab(sector(0, R, -180, 180, 72), 0.3), M.marble, matrix({ x: cx, y: BASE - 0.3, z: cz, rx: -Math.PI / 2 }), { kind: 'floor', floor: 0 });
  for (let f = 1; f < floors; f++) {
    batch.add(slab(sector(well, R, -LANDING, LANDING), 0.3), M.marble, matrix({ x: cx, y: floorY(f) - 0.3, z: cz, rx: -Math.PI / 2 }), { kind: 'floor', floor: f });
  }

  // the spiral: one flight per floor, wedge steps around the open well
  const railPoints = [], balusters = [];
  for (let f = 0; f < floors - 1; f++) {
    const y = floorY(f);
    for (let k = 0; k < STEPS; k++) {
      const from = LANDING + k * STEP_DEG, top = y + (k + 1) * RISE;
      batch.add(slab(sector(well, R - 0.02, from, from + STEP_DEG + 0.4, 4), 0.16), M.marble, matrix({ x: cx, y: top - 0.16, z: cz, rx: -Math.PI / 2 }), { kind: 'stairs', floor: f });
      balusters.push([from + STEP_DEG / 2, top]);
    }
    const run = [];
    for (let d = LANDING; d <= 360 - LANDING; d += 5) run.push(new THREE.Vector3(cx + (well + 0.05) * Math.sin(rad(d)), y + RISE + ((d - LANDING) / SPAN) * (FLOOR_H - RISE) + 0.95, cz + (well + 0.05) * Math.cos(rad(d))));
    railPoints.push(run);
  }
  for (let f = 1; f < floors; f++) { // rail around the well at each landing
    const y = floorY(f), run = [];
    for (let d = -LANDING; d <= LANDING; d += 5) run.push(new THREE.Vector3(cx + (well + 0.05) * Math.sin(rad(d)), y + 0.95, cz + (well + 0.05) * Math.cos(rad(d))));
    railPoints.push(run);
    for (let d = -LANDING + 5; d < LANDING; d += 10) balusters.push([d, y]);
  }
  for (const run of railPoints) batch.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), run.length * 2, 0.035, 8), M.brass, matrix());
  for (const [d, y] of balusters) {
    batch.add(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 6), M.brass, matrix({ x: cx + (well + 0.05) * Math.sin(rad(d)), y: y + 0.475, z: cz + (well + 0.05) * Math.cos(rad(d)) }));
  }
  batch.build(group, raycastTargets);
  decor.push({ group, type: 'vase', x: cx, y: BASE, z: cz, ry: 0 });

  // oval entrance steps, against the wall under the doorway to the hall
  const steps = new Batch();
  for (let k = 0; k < OVAL.count; k++) {
    const [rx, rz] = ovalRadii(k), shape = new THREE.Shape();
    shape.moveTo(-rx, 0);
    shape.absellipse(0, 0, rx, rz, Math.PI, 0, true);
    shape.closePath();
    steps.add(new THREE.ExtrudeGeometry(shape, { depth: (k + 1) * OVAL.rise, bevelEnabled: false, curveSegments: 48 }), M.marble, matrix({ y: (k + 1) * OVAL.rise, z: OVAL.z, rx: Math.PI / 2 }), { kind: 'floor', floor: 0 });
  }
  steps.build(entranceGroup, raycastTargets);

  const inside = (x, z) => Math.hypot(x - cx, z - cz);
  const angle = (x, z) => (Math.atan2(x - cx, z - cz) * 180) / Math.PI;
  return {
    group,
    contains: (x, z) => z < -9.45 && inside(x, z) < R + 0.3,
    onLanding: (f, x, z) => z < -9.45 && inside(x, z) < R + 0.3,
    walkable: (f, x, z) => {
      const r = inside(x, z);
      return r <= R - 0.45 && r >= (f === 0 ? 1.15 : well + 0.35) && Math.abs(angle(x, z)) <= LANDING - 8;
    },
    // gliding round the spiral from one floor to the next (dir +1 up, -1 down)
    glidePath(from, dir) {
      const base = floorY(dir > 0 ? from : from - 1), rp = (well + R) / 2;
      return {
        to: from + dir,
        path: s => {
          const deg = 360 * (dir > 0 ? s : 1 - s), phi = rad(deg);
          const climb = deg <= LANDING ? 0 : deg >= 360 - LANDING ? 1 : (deg - LANDING) / SPAN;
          return { x: cx + rp * Math.sin(phi), z: cz + rp * Math.cos(phi), y: base + climb * FLOOR_H, yaw: dir > 0 ? phi - Math.PI / 2 : phi + Math.PI / 2 };
        },
        endYaw: Math.PI, // arrive facing the doorway to the hall
      };
    },
  };
}
