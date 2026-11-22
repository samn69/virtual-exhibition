// Light fittings and panelling, drawn in code and merged into each floor's batch:
// a crystal chandelier for each room, brass wall lights with two pleated shades for the entrance
// and the halls, and dark wood panelling along the lower walls of the rooms.
import * as THREE from 'three';
import { matrix } from './batch.js';
import { canvasTexture, seeded } from './textures.js';

const lathe = (points, segments = 24) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
const tube = (points, radius, segments = 16) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 6, false);

// a box whose texture is in metres on every face, so the wood grain keeps its size
function woodBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x, -x, +y, -y, +z, -z
  for (let i = 0; i < uv.count; i++) { const [a, b] = faces[Math.floor(i / 4)]; uv.setXY(i, uv.getX(i) * a, uv.getY(i) * b); }
  return g;
}

let shared = null;
export function fittingMaterials() {
  if (shared) return shared;
  const mahogany = canvasTexture(512, 1024, (g, w, h) => { // dark reddish-brown wood, grain running up
    const random = seeded(53);
    g.fillStyle = '#4a1f12'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const x = random() * w, width = 1 + random() * 5, light = random() < 0.5;
      g.strokeStyle = light ? `rgba(130,58,32,${0.06 + random() * 0.1})` : `rgba(30,10,5,${0.06 + random() * 0.12})`;
      g.lineWidth = width; g.beginPath();
      const amp = 2 + random() * 10, freq = 0.004 + random() * 0.01, phase = random() * 6;
      for (let y = 0; y <= h; y += 16) g.lineTo(x + Math.sin(y * freq + phase) * amp, y);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) { // soft figure in the wood
      const x = random() * w, y = random() * h, r = 40 + random() * 120;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(120,50,25,0.18)'); grad.addColorStop(1, 'rgba(120,50,25,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    }
  }, { repeat: true, anisotropy: 4 });
  const glow = canvasTexture(256, 256, (g, w, h) => { // warm light on the wall round a lamp
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,214,150,0.55)'); grad.addColorStop(0.35, 'rgba(255,190,120,0.22)'); grad.addColorStop(1, 'rgba(255,180,110,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  shared = {
    mahogany: new THREE.MeshLambertMaterial({ map: mahogany, color: '#f0d4c4' }), // the raised panels, catching the light
    mahoganyFrame: new THREE.MeshLambertMaterial({ map: mahogany, color: '#a88a7c' }), // rails, stiles and mouldings, darker
    groove: new THREE.MeshBasicMaterial({ color: '#140805' }), // the shadow line round each panel
    crystal: new THREE.MeshPhongMaterial({ color: '#f4f2ee', emissive: '#8a8274', specular: '#ffffff', shininess: 160, flatShading: true }),
    candle: new THREE.MeshLambertMaterial({ color: '#f6f0e2', emissive: '#6a6050' }),
    flame: new THREE.MeshBasicMaterial({ color: '#ffe2a0' }),
    halo: new THREE.MeshBasicMaterial({ color: '#ffb860', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
    shade: new THREE.MeshBasicMaterial({ color: '#f5dca6', side: THREE.DoubleSide }),
    jade: new THREE.MeshPhongMaterial({ color: '#1c2a25', specular: '#7a8a80', shininess: 80 }),
    wallGlow: new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  };
  for (const m of Object.values(shared)) m.userData.shared = true;
  return shared;
}

// ── a crystal chandelier with candles, hanging from the ceiling at local y = 0 ──
// A crown and a basket of crystal strands at the top, a brass stem, two tiers of curved arms
// with candles, festoons of crystal beads between the arms, and a crystal ball at the bottom.
// About 1.3 m across and 3.1 m from the ceiling to the bottom.
export function chandelier(add, M) {
  const F = fittingMaterials(), random = seeded(91);
  const bead = new THREE.OctahedronGeometry(0.024, 0), drop = new THREE.OctahedronGeometry(0.038, 0);
  const crystal = (x, y, z, big = false) => add(big ? drop : bead, F.crystal, matrix({ x, y, z, sy: big ? 1.8 : 1.3, ry: random() }));

  add(new THREE.CylinderGeometry(0.2, 0.14, 0.08, 24), M.gilt, matrix({ y: -0.04 }));
  for (let i = 0; i < 15; i++) add(new THREE.TorusGeometry(0.035, 0.009, 6, 12), M.gilt, matrix({ y: -0.13 - i * 0.09, ry: (i % 2) * Math.PI / 2 }));

  // the crown: a ring with curled leaves and drops
  const crownY = -1.55;
  add(new THREE.TorusGeometry(0.34, 0.018, 6, 40), M.gilt, matrix({ y: crownY, rx: Math.PI / 2 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 0.34, z = Math.sin(a) * 0.34;
    add(new THREE.TorusGeometry(0.06, 0.012, 5, 12, Math.PI * 1.4), M.gilt, matrix({ x: x * 1.05, y: crownY + 0.07, z: z * 1.05, ry: -a + Math.PI / 2, rz: 0.4 }));
    crystal(x * 1.15, crownY - 0.03, z * 1.15, true);
  }
  // the basket: strands of crystals narrowing from the crown to the stem
  const strands = 24, beads = 9, basketBottom = -2.25;
  for (let i = 0; i < strands; i++) {
    const a = (i / strands) * Math.PI * 2;
    for (let k = 0; k < beads; k++) {
      const t = k / (beads - 1), r = 0.32 - 0.2 * t, y = crownY - 0.04 + (basketBottom - crownY) * t;
      crystal(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  add(new THREE.TorusGeometry(0.12, 0.014, 6, 24), M.gilt, matrix({ y: basketBottom, rx: Math.PI / 2 }));

  // the stem: a turned brass baluster
  add(lathe([[0, 0], [0.05, 0], [0.09, 0.08], [0.06, 0.16], [0.05, 0.3], [0.08, 0.42], [0.05, 0.5], [0.04, 0.62], [0.1, 0.7], [0.06, 0.78], [0.04, 0.9], [0, 0.9]]), M.gilt, matrix({ y: -3.0 + 0.1 }));

  // two tiers of arms: each curves out and up to a cup with a candle, with a crystal hanging below
  const tiers = [{ y: -2.55, r: 0.62, n: 10, rise: 0.22 }, { y: -2.25, r: 0.4, n: 6, rise: 0.2 }];
  for (const { y, r, n, rise } of tiers) {
    add(new THREE.TorusGeometry(0.11, 0.025, 8, 24), M.gilt, matrix({ y, rx: Math.PI / 2 }));
    const tips = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (n === 6 ? Math.PI / 6 : 0), c = Math.cos(a), s = Math.sin(a);
      const at = (rr, yy) => [c * rr, y + yy, s * rr];
      add(tube([at(0.1, 0), at(r * 0.45, -0.1), at(r * 0.85, -0.05), at(r, rise - 0.06)], 0.012), M.gilt, new THREE.Matrix4());
      const [x, , z] = at(r, 0), top = y + rise;
      add(lathe([[0, 0], [0.02, 0], [0.05, 0.03], [0.06, 0.05], [0.055, 0.055], [0, 0.04]]), M.gilt, matrix({ x, y: top - 0.06, z })); // the cup (bobeche)
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 10), F.candle, matrix({ x, y: top + 0.06, z }));
      add(new THREE.SphereGeometry(0.014, 8, 6), F.flame, matrix({ x, y: top + 0.155, z, sy: 2 }));
      add(new THREE.SphereGeometry(0.05, 10, 8), F.halo, matrix({ x, y: top + 0.16, z, sy: 1.4 }));
      crystal(x, top - 0.1, z); crystal(x, top - 0.15, z, true);
      tips.push([x, top - 0.06, z]);
    }
    // festoons of beads from cup to cup
    for (let i = 0; i < n; i++) {
      const [ax, ay, az] = tips[i], [bx, by, bz] = tips[(i + 1) % n];
      for (let k = 1; k < 7; k++) { const t = k / 7, sag = Math.sin(t * Math.PI) * 0.12; crystal(ax + (bx - ax) * t, ay + (by - ay) * t - sag, az + (bz - az) * t); }
    }
  }
  // the bottom: a crystal ball and a drop
  add(new THREE.IcosahedronGeometry(0.06, 1), F.crystal, matrix({ y: -3.0 }));
  crystal(0, -3.1, 0, true);
}

// ── a brass wall light with two pleated shades ──
// In a wall's frame (x along the wall, y up, z into the wall): an ornate backplate, two arms
// curving down and up, dark knobs, candle sleeves and cream shades, and a warm glow on the wall.
export function sconce(add, M) {
  const F = fittingMaterials();
  // the backplate: a cartouche with scrolls, a shell at the top
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.3);
  shape.bezierCurveTo(0.05, -0.27, 0.1, -0.2, 0.07, -0.12);
  shape.bezierCurveTo(0.12, -0.08, 0.13, 0.0, 0.07, 0.04);
  shape.bezierCurveTo(0.1, 0.1, 0.09, 0.18, 0.05, 0.22);
  shape.bezierCurveTo(0.1, 0.27, 0.06, 0.36, 0, 0.38);
  shape.bezierCurveTo(-0.06, 0.36, -0.1, 0.27, -0.05, 0.22);
  shape.bezierCurveTo(-0.09, 0.18, -0.1, 0.1, -0.07, 0.04);
  shape.bezierCurveTo(-0.13, 0.0, -0.12, -0.08, -0.07, -0.12);
  shape.bezierCurveTo(-0.1, -0.2, -0.05, -0.27, 0, -0.3);
  const plate = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 10 });
  add(plate, M.gilt, matrix({ z: -0.015, ry: Math.PI }));
  add(new THREE.SphereGeometry(0.035, 12, 8), M.gilt, matrix({ y: 0.02, z: -0.06 }));
  for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(0.012, 0.09, 0.012), M.gilt, matrix({ y: 0.31, z: -0.05, rz: (i - 3) * 0.28 }).multiply(matrix({ y: 0.04 }))); // the shell
  add(lathe([[0, 0], [0.04, 0], [0.05, 0.04], [0.03, 0.08], [0, 0.1]], 16), M.gilt, matrix({ y: -0.4, z: -0.05 })); // a finial below

  for (const s of [-1, 1]) {
    const x = s * 0.25;
    add(tube([[0, -0.18, -0.06], [s * 0.06, -0.34, -0.12], [s * 0.2, -0.36, -0.15], [x, -0.24, -0.15], [x, -0.1, -0.15]], 0.014, 20), M.gilt, new THREE.Matrix4());
    const at = y => matrix({ x, y, z: -0.15 });
    add(lathe([[0, 0], [0.05, 0], [0.055, 0.02], [0.03, 0.035], [0, 0.035]], 16), M.gilt, at(-0.1)); // the cup
    add(new THREE.SphereGeometry(0.04, 16, 10), F.jade, matrix({ x, y: -0.03, z: -0.15, sy: 0.8 }));
    add(new THREE.CylinderGeometry(0.018, 0.022, 0.14, 12), M.gilt, at(0.07));
    // the shade: a pleated drum, wider at the bottom, glowing from the bulb inside
    const shade = lathe([[0.12, 0], [0.08, 0.17]], 64), p = shade.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.025 * Math.cos(a * 32); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    shade.computeVertexNormals();
    add(shade, F.shade, at(0.1));
    add(new THREE.TorusGeometry(0.122, 0.006, 4, 40), M.gilt, matrix({ x, y: 0.1, z: -0.15, rx: Math.PI / 2 }));
    add(new THREE.TorusGeometry(0.082, 0.005, 4, 40), M.gilt, matrix({ x, y: 0.27, z: -0.15, rx: Math.PI / 2 }));
  }
  // light on the wall round it
  add(new THREE.PlaneGeometry(1.5, 1.3), F.wallGlow, matrix({ y: 0.12, z: -0.012, ry: Math.PI }));
}

// ── dark wood panelling along the lower part of a wall, between the doorways ──
// gaps: [from, to] stretches along the wall (x) to leave open. It runs from the skirting to a
// moulded rail at 0.64 m (below the lowest frames), in raised panels about 0.8 m wide.
export const PANEL_TOP = 0.64;
export function wainscot(add, length, gaps) {
  const { mahogany: panel, mahoganyFrame: wood, groove } = fittingMaterials();
  const runs = [];
  let from = -length / 2;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) { if (a - from > 0.3) runs.push([from, a]); from = Math.max(from, b); }
  if (length / 2 - from > 0.3) runs.push([from, length / 2]);
  const board = 0.02, bottom = 0.2, rail = 0.07, stile = 0.07;
  for (const [a, b] of runs) {
    const w = b - a, cx = (a + b) / 2;
    add(woodBox(w, PANEL_TOP - bottom, board), wood, matrix({ x: cx, y: (PANEL_TOP + bottom) / 2, z: -board / 2 })); // the backing boards
    add(woodBox(w, rail, 0.025), wood, matrix({ x: cx, y: bottom + rail / 2, z: -board - 0.0125 })); // the bottom rail
    add(woodBox(w, rail, 0.025), wood, matrix({ x: cx, y: PANEL_TOP - 0.05 - rail / 2, z: -board - 0.0125 })); // the top rail
    add(woodBox(w + 0.02, 0.05, 0.06), wood, matrix({ x: cx, y: PANEL_TOP - 0.025, z: -0.03 })); // the dado rail, a moulded cap
    add(woodBox(w + 0.02, 0.018, 0.075), wood, matrix({ x: cx, y: PANEL_TOP + 0.004, z: -0.0375 }));
    const panels = Math.max(1, Math.round(w / 0.8)), pw = w / panels;
    const ph = PANEL_TOP - 0.05 - rail - (bottom + rail);
    const py = bottom + rail + ph / 2;
    for (let i = 0; i <= panels; i++) add(woodBox(stile, ph, 0.025), wood, matrix({ x: a + i * pw + (i === 0 ? stile / 2 : i === panels ? -stile / 2 : 0), y: py, z: -board - 0.0125 }));
    for (let i = 0; i < panels; i++) { // a raised panel with a moulding round it
      const x = a + (i + 0.5) * pw, iw = pw - stile - 0.06, ih = ph - 0.06;
      add(woodBox(pw - stile, ph, 0.004), groove, matrix({ x, y: py, z: -board - 0.002 })); // shadow round the panel
      add(woodBox(iw, ih, 0.03), panel, matrix({ x, y: py, z: -board - 0.015 }));
      add(woodBox(iw - 0.12, ih - 0.1, 0.012), panel, matrix({ x, y: py, z: -board - 0.036 })); // the raised field
      for (const s of [-1, 1]) {
        add(woodBox(iw - 0.1, 0.008, 0.004), groove, matrix({ x, y: py + s * (ih / 2 - 0.045), z: -board - 0.031 }));
        add(woodBox(0.008, ih - 0.09, 0.004), groove, matrix({ x: x + s * (iw / 2 - 0.055), y: py, z: -board - 0.031 }));
      }
    }
  }
}
