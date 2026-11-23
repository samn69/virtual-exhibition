// The staircases.
// Entrance: five oval marble steps with a red carpet runner, rising to the central hall.
// Stair hall: behind the central hall, a tall red hall with an imperial staircase: one wide
// flight up to a landing with a marble relief of Roma in a gold niche, then two flights turning back to a gallery on the floor above.
// Visitors glide up or down along the stairs.
import * as THREE from 'three';
import { Batch, matrix } from './batch.js';
import { floorY, FLOOR_H, H, BASE, DOOR, ENTRANCE_STEPS, ENTRANCE_HALF } from './constants.js';
import { wallShape } from './shapes.js';
import { doorway } from './doorways.js';
import { nameplate } from './building.js';
import { ceiling } from './ceilings.js';
import { romaRelief } from './relief.js';
import { canvasTexture, seeded } from './textures.js';

const ZS = -9.6;          // the stair hall's south wall, behind the central hall
const TREAD = 0.32;
const GALLERY = 3.0;      // depth of the gallery in front of the doorway on upper floors
const ZA = ZS - GALLERY;  // where the first flight starts
const MARGIN = 0.45;

// ── the niche on the stair landing ──
// An arched recess lined with gold mosaic in a stone frame like the doorways, a marble plinth, and
// the relief of Roma standing on it. Built in the wall's frame: x along the wall, y up from the
// landing, -z out into the stair hall.
const NICHE = { width: 2.0, spring: 2.9, plinth: 0.4 };
NICHE.top = NICHE.spring + NICHE.width / 2 + 0.36 + 0.6; // the frame's keystone

let mosaic = null;
function goldMosaic() { // small gold glass tiles, each catching the light a little differently
  if (mosaic) return mosaic;
  mosaic = canvasTexture(512, 512, (g, w, h) => {
    const random = seeded(17), n = 64, s = w / n;
    g.fillStyle = '#3a2a10'; g.fillRect(0, 0, w, h); // the grout
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const l = 42 + random() * 26, hue = 40 + random() * 8;
      g.fillStyle = `hsl(${hue}, ${62 + random() * 20}%, ${l}%)`;
      g.fillRect(i * s + 0.8 + random(), j * s + 0.8 + random(), s - 1.8, s - 1.8);
    }
  }, { repeat: true, anisotropy: 4 });
  mosaic.repeat.set(1 / 0.5, 1 / 0.5); // 64 tiles to half a metre
  return mosaic;
}

function niche(group, M, at) {
  const { width, spring, plinth } = NICHE, r = width / 2, deep = 0.45;
  const batch = new Batch();
  const add = (geometry, material, local) => batch.add(geometry, material, at.clone().multiply(local));
  // the niche stands out from the wall: a stone casing round an arched recess, with the same
  // frame as the doorways on its face
  const arch = (radius, shape = new THREE.Shape()) => { shape.moveTo(-radius, 0); shape.lineTo(-radius, spring); shape.absarc(0, spring, radius, Math.PI, 0, true); shape.lineTo(radius, 0); return shape; };
  const casing = arch(r + 0.36);
  casing.lineTo(r, 0); casing.lineTo(r, spring); casing.absarc(0, spring, r, 0, Math.PI, false); casing.lineTo(-r, 0); casing.closePath();
  add(new THREE.ExtrudeGeometry(casing, { depth: deep, bevelEnabled: false, curveSegments: 32 }), M.stone, matrix({ z: -deep }));
  doorway((geometry, material, local) => add(geometry, material, matrix({ z: -deep }).multiply(local)), M, width, spring);
  // the gold mosaic lining: the back, the sides, and a half-dome curving back from the arch
  const gold = new THREE.MeshPhongMaterial({ map: goldMosaic(), emissive: '#3a2a0c', specular: '#ffe9a8', shininess: 70, side: THREE.DoubleSide });
  const back = new THREE.Shape();
  back.moveTo(-r, 0); back.lineTo(r, 0); back.lineTo(r, spring); back.absarc(0, spring, r, 0, Math.PI, false); back.closePath();
  const flat = new THREE.ShapeGeometry(back, 32);
  // the lining sits a few centimetres inside the stone casing and in front of the wall: on the
  // same surface as them it would flicker against them as you move
  const inset = 0.03;
  add(flat, gold, matrix({ z: -inset, ry: Math.PI }));
  const metres = (g, w, h) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h); return g; }; // tiles stay square
  for (const s of [-1, 1]) add(metres(new THREE.PlaneGeometry(deep, spring), deep, spring), gold, matrix({ x: s * (r - inset), y: spring / 2, z: -deep / 2, ry: Math.PI / 2 }));
  add(metres(new THREE.SphereGeometry(r - inset, 32, 12, 0, Math.PI, 0, Math.PI / 2), Math.PI * r, (Math.PI / 2) * (r + deep) / 2), gold, matrix({ y: spring, z: -deep, sz: (deep - inset) / (r - inset) }));
  // the plinth: a moulded marble block standing out in front
  for (const [w, h, d, y] of [[width + 0.2, plinth, 0.8, plinth / 2], [width + 0.3, 0.06, 0.86, plinth - 0.03], [width + 0.3, 0.1, 0.86, 0.05]]) {
    add(new THREE.BoxGeometry(w, h, d), M.stone, matrix({ y, z: -d / 2 }));
  }
  batch.build(group);
  // the relief, on the plinth against the mosaic; it comes in when its pictures have loaded
  romaRelief().then(mesh => {
    mesh.applyMatrix4(at.clone().multiply(matrix({ y: plinth, z: -0.07, ry: Math.PI })));
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }).catch(error => console.warn("Couldn't load the relief", error));
}

// ── oval entrance steps ──
export const OVAL = { z: 9.6 };
const stepRise = () => BASE / ENTRANCE_STEPS;
const ovalRadii = k => {
  const t = k / (ENTRANCE_STEPS - 1);
  return [Math.min(5, ENTRANCE_HALF - 1.6) * (1 - t) + 2.1 * t, 3.0 * (1 - t) + 0.9 * t];
};
export function ovalStepsHeight(x, z) {
  const dz = Math.max(0, z - OVAL.z);
  for (let k = ENTRANCE_STEPS - 1; k >= 0; k--) {
    const [rx, rz] = ovalRadii(k);
    if ((x / rx) ** 2 + (dz / rz) ** 2 <= 1) return (k + 1) * stepRise();
  }
  return 0;
}

function ovalSteps(group, M, raycastTargets) {
  const batch = new Batch(), rise = stepRise(), n = ENTRANCE_STEPS;
  for (let k = 0; k < n; k++) {
    const [rx, rz] = ovalRadii(k), shape = new THREE.Shape();
    shape.moveTo(-rx, 0);
    shape.absellipse(0, 0, rx, rz, Math.PI, 0, true);
    shape.closePath();
    batch.add(new THREE.ExtrudeGeometry(shape, { depth: (k + 1) * rise, bevelEnabled: false, curveSegments: 48 }), M.marble, matrix({ y: (k + 1) * rise, z: OVAL.z, rx: Math.PI / 2 }), { kind: 'floor', floor: 0 });
  }
  // a red carpet runner up the middle, with a brass rod at the foot of each step
  const half = 1.3, N = 16, xs = Array.from({ length: N + 1 }, (_, i) => -half + (2 * half * i) / N);
  const front = (k, x) => { const [rx, rz] = ovalRadii(k); return rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)); };
  for (let k = 0; k < n; k++) {
    const tread = new THREE.Shape();
    tread.moveTo(xs[0], -front(k, xs[0]));
    for (const x of xs) tread.lineTo(x, -front(k, x));
    for (const x of [...xs].reverse()) tread.lineTo(x, k < n - 1 ? -front(k + 1, x) : 0.02);
    tread.closePath();
    batch.add(new THREE.ShapeGeometry(tread), M.carpet, matrix({ y: (k + 1) * rise + 0.006, z: OVAL.z, rx: -Math.PI / 2 }), { kind: 'floor', floor: 0 });
    const position = [], index = [];
    for (const x of xs) { const z = OVAL.z + front(k, x) + 0.006; position.push(x, k * rise, z, x, (k + 1) * rise + 0.006, z); }
    for (let i = 0; i < N; i++) { const a = 2 * i; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const riser = new THREE.BufferGeometry();
    riser.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    riser.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((position.length / 3) * 2).fill(0), 2));
    riser.setIndex(index);
    riser.computeVertexNormals();
    batch.add(riser, M.carpet, matrix());
    const rod = xs.map(x => new THREE.Vector3(x, k * rise + 0.02, OVAL.z + front(k, x) + 0.02));
    batch.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rod), 24, 0.012, 6), M.brass, matrix());
  }
  // the runner carries on through the doorway into the hall
  const runner = new THREE.PlaneGeometry(2 * half, 2.4); runner.rotateX(-Math.PI / 2);
  batch.add(runner, M.carpet, matrix({ y: BASE + 0.006, z: OVAL.z - 0.9 }), { kind: 'floor', floor: 0 });
  batch.build(group, raycastTargets);
}

// ── parts of the grand staircases ──
const baluster = (() => {
  const profile = [[0, 0], [0.06, 0], [0.06, 0.06], [0.035, 0.12], [0.07, 0.34], [0.03, 0.6], [0.06, 0.7], [0, 0.72]];
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 6);
})();

class Builder {
  constructor(M) { this.M = M; this.batch = new Batch(); }
  box(x, y, z, sx, sy, sz, material, meta, ry = 0) { this.batch.add(new THREE.BoxGeometry(sx, sy, sz), material, matrix({ x, y, z, ry }), meta); }
  // a level slab whose top is at y
  rug(x0, x1, z0, z1, y, meta) { this.box((x0 + x1) / 2, y + 0.007, (z0 + z1) / 2, x1 - x0, 0.014, z1 - z0, this.M.carpet, meta); }
  slab(x0, x1, z0, z1, y, meta, thick = 0.45) { this.box((x0 + x1) / 2, y - thick / 2, (z0 + z1) / 2, x1 - x0, thick, z1 - z0, this.M.marble, meta); }
  // a straight flight; (x, z) is the middle of its first step's front edge
  flight({ x, z, dir: [dx, dz], width, steps, rise, y0, solid, meta }) {
    const yaw = Math.atan2(dx, dz), cw = width * 0.72; // a red carpet runner up the middle
    const at = (along, y, extra = {}) => matrix({ x: x + dx * along, y, z: z + dz * along, ry: yaw, ...extra });
    for (let k = 0; k < steps; k++) {
      const along = (k + 0.5) * TREAD, top = y0 + (k + 1) * rise, h = solid ? top - y0 + 0.02 : rise + 0.14;
      this.box(x + dx * along, top - h / 2, z + dz * along, width, h, TREAD + 0.02, this.M.marble, meta, yaw);
      this.batch.add(new THREE.BoxGeometry(cw, 0.014, TREAD + 0.02), this.M.carpet, at(along, top + 0.007), meta);        // on the tread
      this.batch.add(new THREE.BoxGeometry(cw, rise, 0.014), this.M.carpet, at(k * TREAD - 0.017, top - rise / 2), meta);  // down the riser
      this.batch.add(new THREE.CylinderGeometry(0.012, 0.012, cw + 0.12, 8), this.M.brass, at(k * TREAD - 0.03, top - rise + 0.02, { rz: Math.PI / 2 }));
    }
    if (!solid) { // the sloping underside
      const run = (steps - 1) * TREAD, climb = (steps - 1) * rise, along = TREAD + run / 2;
      this.batch.add(new THREE.BoxGeometry(width, 0.3, Math.hypot(run, climb) + 0.2), this.M.stone,
        matrix({ x: x + dx * along, y: y0 - 0.14 + climb / 2 - 0.15, z: z + dz * along, ry: yaw, rx: -Math.atan2(climb, run) }));
    }
  }
  // a stone balustrade from a to b ([x, y, z] along its foot)
  balustrade([ax, ay, az], [bx, by, bz]) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, h = Math.hypot(dx, dz);
    if (h < 0.05) return;
    const L = Math.hypot(h, dy), ry = Math.atan2(dx, dz), rx = -Math.atan2(dy, h);
    const at = (t, up) => ({ x: ax + dx * t, y: ay + dy * t + up, z: az + dz * t });
    this.batch.add(new THREE.BoxGeometry(0.2, 0.1, L), this.M.stone, matrix({ ...at(0.5, 0.95), ry, rx }));
    this.batch.add(new THREE.BoxGeometry(0.2, 0.14, L), this.M.stone, matrix({ ...at(0.5, 0.07), ry, rx }));
    const count = Math.max(2, Math.round(h / 0.32));
    for (let i = 0; i < count; i++) this.batch.add(baluster, this.M.stone, matrix(at((i + 0.5) / count, 0.14)));
  }
  column(x, z, y0, y1) {
    const h = y1 - y0;
    this.box(x, y0 + 0.15, z, 0.66, 0.3, 0.66, this.M.stone);
    this.batch.add(new THREE.CylinderGeometry(0.22, 0.26, h - 0.6, 16), this.M.marble, matrix({ x, y: y0 + h / 2, z }));
    this.box(x, y1 - 0.15, z, 0.66, 0.3, 0.66, this.M.stone);
  }
}

// ── the imperial staircase: how big the hall is, one storey's flights, one floor's gallery,
// where visitors can walk, and the route of the glide (relative to the storey) ──
function design(F) {
  const half = FLOOR_H / 2, n = Math.round(half / 0.17), rise = FLOOR_H / (2 * n), run = (n - 1) * TREAD;
  const stairs = f => ({ kind: 'stairs', floor: f }), floorMeta = f => ({ kind: 'floor', floor: f });
  const inRect = (x, z, x0, x1, z0, z1) => x >= x0 && x <= x1 && z >= z0 && z <= z1;

  const W = 6, zB = ZA - run, z0 = zB - 2.8;
  return {
    W, z0,
    storey(b, f) {
      const y = floorY(f);
      b.flight({ x: 0, z: ZA, dir: [0, -1], width: 3.6, steps: n - 1, rise, y0: y, solid: f === 0, meta: stairs(f) });
      b.slab(-W, W, z0, zB, y + half, stairs(f));
      b.rug(-5.65, 5.65, zB - 1.5, zB, y + half, stairs(f)); // carpet across the landing, joining the flights
      for (const s of [-1, 1]) {
        b.flight({ x: s * 4.7, z: zB, dir: [0, 1], width: 2.6, steps: n - 1, rise, y0: y + half, solid: false, meta: stairs(f) });
        b.balustrade([s * 1.8, y, ZA], [s * 1.8, y + half, zB]);
        b.balustrade([s * 1.8, y + half, zB], [s * 3.4, y + half, zB]);
        b.balustrade([s * 3.4, y + half, zB], [s * 3.4, y + FLOOR_H, ZA]);
        if (f === 0) { b.column(s * 2.4, zB - 0.4, y, y + half - 0.45); b.column(s * 5.4, zB - 0.4, y, y + half - 0.45); }
      }
    },
    gallery(b, f) {
      const y = floorY(f), next = f < F - 1;
      b.slab(-W, W, ZA, ZS, y, floorMeta(f), 0.5);
      // carpet from the doorway to the stairs; above the ground floor it also joins the flights arriving from below
      b.rug(-1.3, 1.3, ZA, ZS, y, floorMeta(f));
      if (f > 0) b.rug(-5.65, 5.65, ZA, ZA + 1.3, y, floorMeta(f));
      for (const s of [-1, 1]) b.balustrade([s * (next ? 1.8 : 0), y, ZA], [s * 3.4, y, ZA]);
    },
    walkable(f, x, z) { return inRect(x, z, -W + MARGIN, W - MARGIN, ZA + 0.25, ZS + 0.15); },
    route() {
      return [[0, ZS - 0.7, 0], [0, ZA + 0.3, 0], [0, ZA, 0], [0, zB, half], [0, zB - 0.9, half], [4.7, zB - 0.9, half], [4.7, zB, half],
        [4.7, ZA, FLOOR_H], [4.6, ZA + 0.55, FLOOR_H], [3.0, ZA + 1.25, FLOOR_H], [1.0, ZA + 1.4, FLOOR_H], [0, ZA + 1.4, FLOOR_H]];
    },
    niche: [0, z0], // in the back wall of the landing, facing the first flight
  };
}

export function buildStairs({ floors: F, root, M, raycastTargets, entranceGroup, decor, paper }) {
  ovalSteps(entranceGroup, M, raycastTargets);

  const d = design(F), { W, z0 } = d;
  const group = new THREE.Group();
  group.name = 'stair hall';
  root.add(group);
  const b = new Builder(M);
  const topY = floorY(F - 1) + H, height = topY - BASE;
  const zWall = z0; // the far wall

  // walls: wallpaper, with doorways to the central hall on every floor
  const wall = (m, length, doors = []) => b.batch.add(new THREE.ExtrudeGeometry(wallShape(length / 2, height, doors), { depth: 0.2, bevelEnabled: false, curveSegments: 20 }), [paper, M.stone], m);
  wall(matrix({ y: BASE, z: ZS }), 2 * W + 0.4, Array.from({ length: F }, (_, f) => ({ u: 0, width: DOOR.width, spring: DOOR.spring, bottom: f * FLOOR_H })));
  wall(matrix({ x: W, y: BASE, z: (ZS + zWall) / 2, ry: Math.PI / 2 }), ZS - zWall);
  wall(matrix({ x: -W, y: BASE, z: (ZS + zWall) / 2, ry: -Math.PI / 2 }), ZS - zWall);
  // the far wall, behind the landing: a large arched window with a smaller one each side
  const windows = F > 1 ? [{ u: 0, width: 2.8, spring: 4.2 }, { u: -3.75, width: 1.5, spring: 3.0 }, { u: 3.75, width: 1.5, spring: 3.0 }]
    .map(w => ({ ...w, bottom: FLOOR_H / 2 + NICHE.top + 0.3 })) : []; // the sills clear the niche on the landing
  wall(matrix({ y: BASE, z: z0, ry: Math.PI }), 2 * W + 0.4, windows);
  for (const w of windows) {
    const at = matrix({ x: w.u, y: BASE + w.bottom, z: z0, ry: Math.PI });
    const add = (geometry, material, local) => b.batch.add(geometry, material, at.clone().multiply(local));
    doorway(add, M, w.width, w.spring, { window: true });
    // the glass shows the sky; white glazing bars, with a fan of them in the arch
    const r = w.width / 2, glass = new THREE.Shape();
    glass.moveTo(-r, 0); glass.lineTo(r, 0); glass.lineTo(r, w.spring); glass.absarc(0, w.spring, r, 0, Math.PI, false); glass.closePath();
    add(new THREE.ShapeGeometry(glass, 24), M.laylight, matrix({ z: 0.1 }));
    const bar = (length, x, y, rz = 0) => add(new THREE.BoxGeometry(0.045, length, 0.06), M.stone, matrix({ x, y, z: 0.06, rz }));
    const columns = Math.max(2, Math.round(w.width / 0.5));
    for (let i = 1; i < columns; i++) { const x = -r + (w.width * i) / columns; bar(w.spring, x, w.spring / 2); }
    const rows = Math.max(3, Math.round(w.spring / 0.6));
    for (let j = 1; j <= rows; j++) bar(w.width, 0, (w.spring * j) / rows, Math.PI / 2);
    for (let i = 1; i < 6; i++) { const a = (i / 6) * Math.PI; bar(r, Math.cos(a) * r / 2, w.spring + Math.sin(a) * r / 2, a - Math.PI / 2); }
    add(new THREE.TorusGeometry(r * 0.45, 0.025, 6, 24, Math.PI), M.stone, matrix({ y: w.spring, z: 0.06 }));
  }
  // floor, ceiling and skylight, and a stone band at each floor
  const floor = new THREE.PlaneGeometry(2 * W, ZS - zWall); floor.rotateX(-Math.PI / 2);
  b.batch.add(floor, M.marble, matrix({ y: BASE, z: (ZS + zWall) / 2 }), { kind: 'floor', floor: 0 });
  ceiling(b.batch, M, { x0: -W, x1: W, z0: zWall, z1: ZS, y: BASE, height });
  for (let f = 0; f < F; f++) {
    const y = floorY(f);
    const at = matrix({ y, z: ZS }); // the doorway, seen from the stair hall (its room side is -z)
    const info = doorway((geometry, material, local) => b.batch.add(geometry, material, at.clone().multiply(local)), M, DOOR.width, DOOR.spring);
    group.add(nameplate(`Floor ${f + 1}`, info, at));
    const bands = [[0, ZS - 0.07, 2 * W, 0], [W - 0.07, (ZS + zWall) / 2, ZS - zWall, Math.PI / 2], [-W + 0.07, (ZS + zWall) / 2, ZS - zWall, Math.PI / 2]];
    if (!windows.length || !f) bands.push([0, z0 + 0.07, 2 * W, 0]); // not across the windows
    for (const [x, z, len, ry] of bands) {
      b.box(x, (f ? y - 0.75 : topY - 0.14), z, len, f ? 0.3 : 0.28, 0.14, M.stone, undefined, ry);
    }
  }

  for (let f = 0; f < F - 1; f++) d.storey(b, f);
  for (let f = 1; f < F; f++) d.gallery(b, f);
  b.batch.build(group, raycastTargets);
  if (d.niche) niche(group, M, matrix({ x: d.niche[0], y: floorY(0) + FLOOR_H / 2, z: d.niche[1], ry: Math.PI }));

  // the glide: a smooth curve through the route, walked at an even pace
  const route = d.route();
  const lengthOf = pts => pts.reduce((sum, p, i) => i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1], p[2] - pts[i - 1][2]) : 0, 0);
  const seconds = Math.max(7, lengthOf(route) / 2.6);
  return {
    group,
    contains: (x, z) => z < ZS + 0.15 && z > z0 - 0.5 && Math.abs(x) < W + 0.3,
    onLanding: (f, x, z) => z < ZS + 0.15 && d.walkable(f, x, z),
    walkable: (f, x, z) => z < ZS + 0.2 && d.walkable(f, x, z),
    glidePath(from, dir) {
      const storey = dir > 0 ? from : from - 1, base = floorY(storey);
      const curve = new THREE.CatmullRomCurve3(route.map(([x, z, y]) => new THREE.Vector3(x, base + y, z)), false, 'centripetal');
      const point = s => curve.getPointAt(THREE.MathUtils.clamp(dir > 0 ? s : 1 - s, 0, 1));
      const total = curve.getLength(), ahead = 0.9 / total;
      return {
        to: from + dir, seconds,
        path: s => {
          const p = point(s), a = point(Math.max(0, s - ahead)), c = point(Math.min(1, s + ahead));
          return { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(-(c.x - a.x), -(c.z - a.z)) };
        },
        endYaw: Math.PI, // arrive facing the doorway to the hall
      };
    },
  };
}
