// Ceilings. The entrance and the halls are roofed in glass: an arched vault over the whole space,
// on iron ribs. The sky shows through the glass. Rooms have a plain moulded ceiling.
import * as THREE from 'three';
import { matrix } from './batch.js';

// a horizontal rectangle facing down, texture in metres
function under(x0, x1, z0, z1) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  return g;
}

// roof: an optional separate batch for the glass vault, which rises above the ceiling (into the
// floor above, so it is only drawn while the visitor is below it)
export function ceiling(batch, M, { x0, x1, z0, z1, y, height, skylight = true, roof = batch, alongZ = z1 - z0 >= x1 - x0 }) {
  const top = y + height, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const span = alongZ ? x1 - x0 : z1 - z0, length = alongZ ? z1 - z0 : x1 - x0;
  // place something given in "vault coordinates" (a across, b along, up), centred on the space
  const base = matrix({ x: cx, y: top, z: cz, ry: alongZ ? 0 : Math.PI / 2 });
  const at = (a, up, b, extra = {}) => base.clone().multiply(matrix({ x: a, y: up, z: b, ...extra }));
  const pad = 0.2; // the ceiling runs over the walls

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

  // the whole ceiling is glass: one arched vault from wall to wall, the shape of the old skylight
  // (as high as it was, so flatter), on iron ribs, with half-round glass ends over the end walls
  const r = span / 2, rise = Math.min(r, 2.5), k = rise / r, along = length + 2 * pad;
  const flat = { sy: k }; // squash the round shapes into the vault's curve
  roof.add(new THREE.CylinderGeometry(r, r, along, 48, 1, true, -Math.PI / 2, Math.PI), M.laylight, at(0, 0, 0, { rx: -Math.PI / 2, sz: k }));
  for (const s of [-1, 1]) roof.add(new THREE.CircleGeometry(r, 32, 0, Math.PI), M.laylight, at(0, 0, s * length / 2, flat));
  // arched ribs across, and purlins along
  const ribs = Math.max(2, Math.round(length / 1.5));
  for (let i = 0; i <= ribs; i++) roof.add(new THREE.TorusGeometry(r - 0.04, 0.04, 6, 40, Math.PI), M.iron, at(0, 0, -length / 2 + (length * i) / ribs, flat));
  const purlins = 8;
  for (let i = 1; i < purlins; i++) {
    const a = (i / purlins) * Math.PI;
    roof.add(new THREE.BoxGeometry(0.06, 0.06, length), M.iron, at(Math.cos(a) * (r - 0.05), Math.sin(a) * (r - 0.05) * k, 0));
  }
  // the ends: iron bars in the half-round glass, like a fan
  for (const s of [-1, 1]) for (let i = 1; i < 6; i++) {
    const a = (i / 6) * Math.PI, x = Math.cos(a) * r / 2, y = Math.sin(a) * r * k / 2;
    roof.add(new THREE.BoxGeometry(0.05, Math.hypot(x * 2, y * 2), 0.05), M.iron, at(x, y, s * (length / 2 - 0.03), { rz: Math.atan2(y, x) - Math.PI / 2 }));
  }
  // an iron sill along the top of each long wall, where the vault starts
  for (const s of [-1, 1]) roof.add(new THREE.BoxGeometry(0.22, 0.12, along), M.iron, at(s * (r - 0.08), 0.03, 0));
}
