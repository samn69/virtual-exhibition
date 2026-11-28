// Picture frames: a moulded profile swept round the picture, mitred at the corners, in dark
// polished walnut with a thin gilt slip. A style is a list of profile points from the outer edge
// (r = 0, on the wall) to the inner lip (r = width, at the mount): [r, z, material].
// The user chose A (Walnut Classic) from four designs on 28 Nov.
import * as THREE from 'three';
import { canvasTexture, seeded } from './textures.js';

const MOUNT_Z = 0.072; // the mount's face; the inner lip comes down to it

// sample a curve between two points: shape(t) in 0..1 gives how far up the rise it is
function curve(points, [r0, z0], [r1, z1], mat, shape, steps = 8) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points.push([r0 + (r1 - r0) * t, z0 + (z1 - z0) * shape(t), mat]);
  }
}
const ogee = t => (1 - Math.cos(Math.PI * t)) / 2;          // S-curve
const cove = t => 1 - Math.sqrt(1 - t * t);                  // hollow, steep at the end
const bead = t => Math.sin(Math.PI * t);                     // a half round that comes back down

// each builder returns the profile; the last point must reach z = MOUNT_Z
export const FRAME_STYLE = 'A';
export const FRAME_STYLES = {
  // A: walnut moulding, an S-curve up to a flat top, a hollow down to a thin gilt slip
  A: () => {
    const p = [[0, 0, 'wood'], [0, 0.05, 'wood']];
    curve(p, [0, 0.05], [0.012, 0.05], 'wood', bead, 6);           // small outer bead
    curve(p, [0.012, 0.05], [0.055, 0.094], 'wood', ogee, 10);
    p.push([0.07, 0.094, 'wood']);
    curve(p, [0.07, 0.094], [0.105, 0.078], 'wood', t => cove(1 - t) * -1 + 1, 8);
    p.push([0.106, 0.084, 'gold']);
    curve(p, [0.106, 0.084], [0.12, MOUNT_Z], 'gold', ogee, 5);    // gilt slip
    return p;
  },
};

// ── materials ──
function woodTexture() {
  return canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#3d2015'; g.fillRect(0, 0, w, h);
    const random = seeded(7);
    for (let i = 0; i < 160; i++) { // long grain lines along the moulding
      const y = random() * h, wave = 2 + random() * 6, phase = random() * 6;
      g.strokeStyle = random() < 0.5 ? `rgba(20,9,4,${0.15 + random() * 0.3})` : `rgba(120,70,40,${0.05 + random() * 0.12})`;
      g.lineWidth = 0.6 + random() * 2.2;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 90 + phase) * wave);
      g.stroke();
    }
  }, { repeat: true, anisotropy: 4 });
}
let materials = null;
export function frameMaterials(envMap) {
  if (materials) return materials;
  const wood = woodTexture();
  const gold = { color: '#c9a04f', metalness: 1, roughness: 0.32, envMap, envMapIntensity: 1.1, emissive: '#2a1c06' };
  materials = {
    wood: new THREE.MeshStandardMaterial({ map: wood, color: '#ffffff', roughness: 0.42, metalness: 0, envMap, envMapIntensity: 0.25 }),
    gold: new THREE.MeshStandardMaterial(gold),
  };
  return materials;
}
export const MATERIAL_ORDER = ['wood', 'gold'];

// ── geometry ──
// halfW, halfH: half the size of the opening (the mount)
export function frameGeometry(style, halfW, halfH) {
  const profile = FRAME_STYLES[style]();
  const width = profile.at(-1)[0];
  const W = halfW + width, Hh = halfH + width;
  // a normal for each segment in (inward, up), and smoothed ones at the points between gentle bends
  const segs = [];
  for (let i = 1; i < profile.length; i++) {
    const [r0, z0] = profile[i - 1], [r1, z1] = profile[i];
    const dr = r1 - r0, dz = z1 - z0, len = Math.hypot(dr, dz) || 1;
    segs.push({ n: [-dz / len, dr / len], len });
  }
  const smooth = (a, b) => {
    if (!a || !b) return (a || b).n;
    const dot = a.n[0] * b.n[0] + a.n[1] * b.n[1];
    if (dot < Math.cos(Math.PI / 4)) return null;
    const x = a.n[0] + b.n[0], y = a.n[1] + b.n[1], l = Math.hypot(x, y);
    return [x / l, y / l];
  };
  // sides: outward direction d, and how to place a point at inset r, at fraction s along the side
  const sides = [
    { d: [0, -1], at: (r, s) => [-(W - r) + 2 * (W - r) * s, -(Hh - r)], len: (r) => 2 * (W - r) },
    { d: [1, 0], at: (r, s) => [W - r, -(Hh - r) + 2 * (Hh - r) * s], len: (r) => 2 * (Hh - r) },
    { d: [0, 1], at: (r, s) => [(W - r) - 2 * (W - r) * s, Hh - r], len: (r) => 2 * (W - r) },
    { d: [-1, 0], at: (r, s) => [-(W - r), (Hh - r) - 2 * (Hh - r) * s], len: (r) => 2 * (Hh - r) },
  ];
  const position = [], normal = [], uv = [];
  const groups = MATERIAL_ORDER.map(() => []);
  let v = 0;
  for (let i = 1; i < profile.length; i++) {
    const [r0, z0] = profile[i - 1], [r1, z1, mat] = profile[i];
    const seg = segs[i - 1];
    const n0 = smooth(segs[i - 2], seg) || seg.n, n1 = smooth(seg, segs[i]) || seg.n;
    const v0 = v, v1 = v + seg.len; v = v1;
    const list = groups[MATERIAL_ORDER.indexOf(mat)];
    for (const side of sides) {
      const corner = (r, z, s, n, vv) => {
        const [x, y] = side.at(r, s);
        // inward is -d
        list.push({ p: [x, y, z], n: [-side.d[0] * n[0], -side.d[1] * n[0], n[1]], uv: [(s - 0.5) * side.len(r) * 4 + 50, vv * 12] });
      };
      // a quad from the outer row (r0) to the inner row (r1); s = 0 and 1 are the mitred ends
      const a = [r0, z0, 0, n0, v0], b = [r0, z0, 1, n0, v0], c = [r1, z1, 1, n1, v1], d = [r1, z1, 0, n1, v1];
      for (const q of [a, b, c, a, c, d]) corner(...q);
    }
  }
  const geometry = new THREE.BufferGeometry();
  let start = 0;
  groups.forEach((list, index) => {
    for (const vert of list) { position.push(...vert.p); normal.push(...vert.n); uv.push(...vert.uv); }
    if (list.length) geometry.addGroup(start, list.length, index);
    start += list.length;
  });
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return { geometry, width };
}
