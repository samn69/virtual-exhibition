// Ceilings. The entrance, the top floor's hall and the stair hall are roofed in glass: a shallow
// arched vault on a grid of white bars, like a museum court, with the sky showing through. Halls
// with a floor above have a plaster groin vault, and the rooms have a plain moulded ceiling.
import * as THREE from 'three';
import { matrix } from './batch.js';

// a horizontal rectangle facing down, texture in metres
function under(x0, x1, z0, z1) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  return g;
}

// ── a museum court roof, like the Greek and Roman court of the Metropolitan Museum ──
// A shallow arched vault of clear glass (the sky shows through) on a close grid of slim white bars, with heavier arches
// every few panes, rising from a deep moulded cornice; the ends are plaster half-moons with a
// round wreath. at() places things in vault coordinates (across, up, along) at the springing.
function courtRoof(roof, M, at, span, length, pad) {
  const r = span / 2, rise = Math.min(r * 0.5, 2.5), k = rise / r, along = length + 2 * pad;
  const flat = { sy: k };
  roof.add(new THREE.CylinderGeometry(r, r, along, 64, 1, true, -Math.PI / 2, Math.PI), M.laylight, at(0, 0, 0, { rx: -Math.PI / 2, sz: k }));
  // the grid: bars across every ~0.8 m, a heavier arch every fourth, and bars along the vault
  const ribs = Math.max(4, Math.round(length / 0.8));
  for (let i = 1; i < ribs; i++) {
    const heavy = i % 4 === 0;
    roof.add(new THREE.TorusGeometry(r - (heavy ? 0.07 : 0.03), heavy ? 0.07 : 0.025, 6, 64, Math.PI), M.glazing, at(0, 0, -length / 2 + (length * i) / ribs, flat));
  }
  const bars = Math.max(10, Math.round((Math.PI * (r + rise) / 2) / 0.6)); // panes about 0.6 m wide
  for (let i = 1; i < bars; i++) {
    const a = (i / bars) * Math.PI;
    const x = Math.cos(a) * (r - 0.03), y = Math.sin(a) * (r - 0.03) * k;
    const slope = Math.atan2(Math.cos(a) * k, Math.sin(a)); // lie along the curve
    roof.add(new THREE.BoxGeometry(0.05, 0.05, length), M.glazing, at(x, y, 0, { rz: slope }));
  }
  // the ends: plaster half-moons with a wreath, framed by a heavy arch
  for (const s of [-1, 1]) {
    const end = at(0, 0, s * (length / 2 - 0.02));
    const local = (extra = {}) => end.clone().multiply(matrix(extra));
    roof.add(new THREE.CircleGeometry(r, 48, 0, Math.PI), M.plaster, local(flat));
    roof.add(new THREE.TorusGeometry(r - 0.1, 0.1, 8, 64, Math.PI), M.stone, local({ z: -s * 0.08, ...flat }));
    const cy = rise * 0.45, wz = -s * 0.06;
    roof.add(new THREE.TorusGeometry(0.42, 0.07, 10, 40), M.stone, local({ y: cy, z: wz }));
    for (let i = 0; i < 18; i++) { // leaves round the wreath
      const a = (i / 18) * Math.PI * 2;
      roof.add(new THREE.SphereGeometry(0.07, 8, 6), M.stone, local({ x: Math.cos(a) * 0.42, y: cy + Math.sin(a) * 0.42, z: wz - s * 0.04, rz: a + 0.6, sx: 1.8, sy: 0.7, sz: 0.6 }));
    }
    roof.add(new THREE.CircleGeometry(0.34, 32), M.plaster, local({ y: cy, z: wz + s * 0.03, ry: s > 0 ? Math.PI : 0 }));
  }
  // a deep cornice along each long side where the vault springs: three projecting steps and a
  // row of dentils
  for (const s of [-1, 1]) {
    for (const [w, h, dy] of [[0.6, 0.16, -0.08], [0.42, 0.14, -0.23], [0.28, 0.2, -0.4]]) {
      roof.add(new THREE.BoxGeometry(w, h, along), M.stone, at(s * (r - w / 2 + 0.02), dy, 0));
    }
    const n = Math.round(length / 0.22);
    for (let i = 0; i < n; i++) roof.add(new THREE.BoxGeometry(0.1, 0.1, 0.11), M.stone, at(s * (r - 0.3), -0.55, -length / 2 + (i + 0.5) * length / n));
  }
}

// one bay of a groin vault, the crown at y = rise above the springing (y = 0), in four parts split
// along the diagonals so the groins stay sharp: the two side parts follow the arch across the bay
// (half-length b), the two end parts the arch along it (half-span a). Faces look down.
function groinBay(a, b, rise, n = 24, hole = 0) {
  const parts = [];
  for (const [side, along] of [[1, false], [-1, false], [1, true], [-1, true]]) {
    const pos = [], idx = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const s = i / n, t = -1 + (2 * j) / n, h = rise * Math.sqrt(Math.max(0, 1 - (t * s) ** 2));
      if (along) pos.push(t * s * a, h, side * s * b); else pos.push(side * s * a, h, t * s * b);
    }
    const inside = k => Math.hypot(pos[3 * k], pos[3 * k + 2]) < hole;
    const tri = (u, v, w) => { if (!(inside(u) && inside(v) && inside(w))) idx.push(u, v, w); };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = i * (n + 1) + j, q = p + n + 1;
      tri(p, q, p + 1); tri(p + 1, q, q + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // make the faces look down into the hall
    const ny = g.attributes.normal.getY(n * (n + 1) + Math.floor(n / 2)); // a vertex at the wall, never in the hole
    if (ny > 0) { const flip = []; for (let k = 0; k < idx.length; k += 3) flip.push(idx[k], idx[k + 2], idx[k + 1]); g.setIndex(flip); g.computeVertexNormals(); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    parts.push(g);
  }
  return parts;
}

// a shallow coffered dome set into the crown of a vault bay (y = 0 is the crown, and the dome
// rises into the 60 cm below the floor above): a deep moulded ring hanging down to meet the vault,
// a band of warm light hidden behind it, radial ribs and two rings dividing the dome into
// panels, and a round medallion in the middle where the chandelier hangs
export const DOME = { radius: 3, rise: 0.48 };
function dome(batch, M, at, lip = 0.24) {
  const R = DOME.radius, h = DOME.rise, n = 96;
  const Rs = (R * R + h * h) / (2 * h), cy = h - Rs; // the sphere the dome is part of
  const local = (x, y, z, extra = {}) => at.clone().multiply(matrix({ x, y, z, ...extra }));
  const surface = r => cy + Math.sqrt(Rs * Rs - r * r); // the height of the dome r from the middle
  batch.add(new THREE.SphereGeometry(Rs, n, 24, 0, Math.PI * 2, 0, Math.asin(R / Rs)), M.dome, local(0, cy, 0));
  // the ring: a drum from the dome down past the vault, a flat soffit, and mouldings on both edges
  batch.add(new THREE.CylinderGeometry(R, R, lip, n, 1, true), M.plaster, local(0, -lip / 2, 0));
  batch.add(new THREE.RingGeometry(R, R + 0.55, n, 1), M.plaster, local(0, -lip, 0, { rx: Math.PI / 2 }));
  batch.add(new THREE.CylinderGeometry(R + 0.55, R + 0.55, lip, n, 1, true), M.plaster, local(0, -lip / 2, 0)); // its outside, up into the vault
  batch.add(new THREE.TorusGeometry(R + 0.02, 0.06, 8, n), M.stone, local(0, -lip, 0, { rx: Math.PI / 2 }));
  batch.add(new THREE.TorusGeometry(R + 0.55, 0.045, 8, n), M.stone, local(0, -lip + 0.02, 0, { rx: Math.PI / 2 }));
  batch.add(new THREE.TorusGeometry(R + 0.3, 0.025, 6, n), M.stone, local(0, -lip - 0.01, 0, { rx: Math.PI / 2 }));
  // the hidden light: a glowing strip round the foot of the dome, just above the drum
  batch.add(new THREE.CylinderGeometry(R - 0.01, R - 0.01, 0.1, n, 1, true), M.cove, local(0, surface(R) - 0.06, 0));
  // coffers: 16 ribs from the ring to the medallion, and two rings across them
  const ribs = 16, inner = 0.7, rings = [0.45 * R, 0.74 * R];
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2, pts = [];
    for (let k = 0; k <= 12; k++) { const r = inner + (R - 0.05 - inner) * (k / 12); pts.push(new THREE.Vector3(Math.cos(a) * r, surface(r) - 0.035, Math.sin(a) * r)); }
    batch.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.035, 5, false), M.stone, at);
  }
  for (const r of rings) batch.add(new THREE.TorusGeometry(r, 0.035, 6, n), M.stone, local(0, surface(r) - 0.035, 0, { rx: Math.PI / 2 }));
  // the medallion: a moulded disc with a rosette
  batch.add(new THREE.TorusGeometry(inner, 0.05, 8, 48), M.stone, local(0, surface(inner) - 0.04, 0, { rx: Math.PI / 2 }));
  batch.add(new THREE.CylinderGeometry(0.44, 0.5, 0.06, 32), M.stone, local(0, h - 0.04, 0));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    batch.add(new THREE.SphereGeometry(0.09, 10, 6), M.stone, local(Math.cos(a) * 0.3, h - 0.08, Math.sin(a) * 0.3, { ry: -a, sx: 1.9, sy: 0.4, sz: 0.85 }));
  }
}

// a flat arch band following an elliptical arch (half-span r, rise h) in the x-y plane, w thick
// along z, standing d below the vault surface
function archBand(r, h, w, d, n = 40) {
  const shape = new THREE.Shape();
  shape.moveTo(-r, 0);
  for (let i = 0; i <= n; i++) { const a = Math.PI - (i / n) * Math.PI; shape.lineTo(r * Math.cos(a), h * Math.sin(a)); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; shape.lineTo((r - d) * Math.cos(a), (h - d) * Math.sin(a)); }
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -w / 2);
  return g;
}

// the half-elliptical plaster face of a lunette, facing +z
function lunette(r, h, n = 40) {
  const shape = new THREE.Shape();
  shape.moveTo(-r, 0);
  for (let i = 0; i <= n; i++) { const a = Math.PI - (i / n) * Math.PI; shape.lineTo(r * Math.cos(a), h * Math.sin(a)); }
  return new THREE.ShapeGeometry(shape);
}

// roof: an optional separate batch for the glass vault, which rises above the ceiling (into the
// floor above, so it is only drawn while the visitor is below it)
export function ceiling(batch, M, { x0, x1, z0, z1, y, height, skylight = true, arched = false, roof = batch, alongZ = z1 - z0 >= x1 - x0 }) {
  const top = y + height, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const span = alongZ ? x1 - x0 : z1 - z0, length = alongZ ? z1 - z0 : x1 - x0;
  // place something given in "vault coordinates" (a across, b along, up), centred on the space
  const base = matrix({ x: cx, y: top, z: cz, ry: alongZ ? 0 : Math.PI / 2 });
  const at = (a, up, b, extra = {}) => base.clone().multiply(matrix({ x: a, y: up, z: b, ...extra }));
  const pad = 0.2; // the ceiling runs over the walls

  if (!skylight && arched) { // a plaster groin vault, as in a Mediterranean arcade: square-ish bays,
    // each two barrel vaults crossing, so the groins run corner to corner. Plain arches between the
    // bays rest on flat pilasters, and the half-round lunettes on the walls are plaster too. It
    // springs low (the lunettes rise over the doorways and their name signs) and reaches the full
    // ceiling height in the middle of each bay, where the chandeliers hang.
    const a = span / 2, bays = Math.max(1, Math.round(length / span)), b = length / bays / 2;
    const rise = Math.min(a, b, 3), springAt = -rise; // below the ceiling top
    const centres = [];
    for (let i = 0; i < bays; i++) {
      const c = -length / 2 + b * (2 * i + 1);
      centres.push(c);
      for (const g of groinBay(a, b, rise, 48, DOME.radius + 0.25)) batch.add(g, M.plaster, at(0, springAt, c));
      // how far the vault has fallen below the crown at the dome's outer moulding, along the
      // diagonal (where it falls most): the ring hangs down that far, so it meets the vault all round
      const d = (DOME.radius + 0.55) / Math.SQRT2;
      const drop = rise - rise * Math.max(Math.sqrt(1 - (d / a) ** 2), Math.sqrt(1 - (d / b) ** 2));
      dome(batch, M, at(0, 0, c), drop + 0.06);
    }
    const pier = 0.7, proud = 0.12, band = 0.12; // pilaster width and how far it stands out; arch band depth
    // arches: across the hall between the bays and against the end walls, and along the side walls
    for (let i = 0; i <= bays; i++) {
      const z = -length / 2 + 2 * b * i, end = i === 0 || i === bays;
      const w = end ? pier / 2 : pier, off = end ? (i === 0 ? pier / 4 : -pier / 4) : 0;
      batch.add(archBand(a, rise, w, band), M.plaster, at(0, springAt, z + off));
    }
    for (const c of centres) for (const s of [-1, 1]) {
      batch.add(archBand(b, rise, proud * 2, band), M.plaster, at(s * a, springAt, c, { ry: Math.PI / 2 }));
      batch.add(lunette(b - 0.01, rise), M.plaster, at(s * (a - 0.012), springAt, c, { ry: -s * Math.PI / 2 }));
    }
    for (const s of [-1, 1]) batch.add(lunette(a - 0.01, rise), M.plaster, at(0, springAt, s * (length / 2 - 0.012), { ry: s > 0 ? Math.PI : 0 }));
    // flat pilasters from the floor to the springing, with a moulded impost on top
    const pilaster = (x, z, wx, wz) => {
      batch.add(new THREE.BoxGeometry(wx, height - rise, wz), M.plaster, at(x, -height + (height - rise) / 2, z));
      batch.add(new THREE.BoxGeometry(wx + 0.12, 0.14, wz + 0.12), M.stone, at(x, springAt - 0.07, z));
      batch.add(new THREE.BoxGeometry(wx + 0.06, 0.08, wz + 0.06), M.stone, at(x, springAt - 0.18, z));
      batch.add(new THREE.BoxGeometry(wx + 0.08, 0.2, wz + 0.08), M.stone, at(x, -height + 0.1, z)); // base
    };
    for (let i = 0; i <= bays; i++) {
      const z = -length / 2 + 2 * b * i, end = i === 0 || i === bays;
      const wz = end ? pier / 2 : pier, zc = end ? z + (i === 0 ? pier / 4 : -pier / 4) : z;
      for (const s of [-1, 1]) {
        pilaster(s * (a - proud / 2), zc, proud, wz);
        if (end) pilaster(s * (a - pier / 4), z + (i === 0 ? proud / 2 : -proud / 2), pier / 2, proud);
      }
    }
    // where to hang the lights: the middle of each bay, from the top of its dome
    return centres.map(c => new THREE.Vector3(0, DOME.rise, c).applyMatrix4(base));
  }

  if (!skylight) { // a plain ceiling with a moulded panel and a rosette in the middle
    batch.add(under(x0 - pad, x1 + pad, z0 - pad, z1 + pad), M.ceiling, matrix({ y: top }));
    const pa = span - 2.4, pb = length - 2.4;
    for (const s of [-1, 1]) {
      batch.add(new THREE.BoxGeometry(pa + 0.16, 0.08, 0.16), M.stone, at(0, -0.04, s * pb / 2));
      batch.add(new THREE.BoxGeometry(0.16, 0.08, pb), M.stone, at(s * pa / 2, -0.04, 0));
    }
    batch.add(new THREE.CylinderGeometry(0.45, 0.3, 0.1, 32), M.stone, at(0, -0.05, 0));
    batch.add(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.stone, at(0, -0.1, 0));
    return;
  }

  // the whole ceiling is glass
  courtRoof(roof, M, at, span, length, pad);
}
