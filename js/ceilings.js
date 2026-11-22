// Ceilings. Halls get a skylight: the flat ceiling opens into an arched glass roof with iron ribs,
// the same shape as the doorways. The sky shows through the glass.
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
export function ceiling(batch, M, { x0, x1, z0, z1, y, height, skylight = true, roof = batch }) {
  const top = y + height, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const alongZ = z1 - z0 >= x1 - x0;
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

  // a flat ceiling with an opening for the skylight
  const across = span * 0.5, along = Math.min(length * 0.62, length - 2.4);
  const hole = alongZ ? [cx - across / 2, cx + across / 2, cz - along / 2, cz + along / 2] : [cx - along / 2, cx + along / 2, cz - across / 2, cz + across / 2];
  const [hx0, hx1, hz0, hz1] = hole;
  const X0 = x0 - pad, X1 = x1 + pad, Z0 = z0 - pad, Z1 = z1 + pad;
  for (const r of [[X0, X1, Z0, hz0], [X0, X1, hz1, Z1], [X0, hx0, hz0, hz1], [hx1, X1, hz0, hz1]]) batch.add(under(...r), M.ceiling, matrix({ y: top }));

  // an arched glass roof over the opening, with iron ribs
  const r = across / 2;
  roof.add(new THREE.CylinderGeometry(r, r, along, 32, 1, true, -Math.PI / 2, Math.PI), M.laylight, at(0, 0, 0, { rx: -Math.PI / 2 }));
  for (const s of [-1, 1]) roof.add(new THREE.CircleGeometry(r, 24, 0, Math.PI), M.laylight, at(0, 0, s * along / 2));
  const ribs = Math.max(2, Math.round(along / 1.2));
  for (let i = 0; i <= ribs; i++) roof.add(new THREE.TorusGeometry(r - 0.03, 0.035, 6, 24, Math.PI), M.iron, at(0, 0, -along / 2 + (along * i) / ribs));
  for (const a of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) roof.add(new THREE.BoxGeometry(0.05, 0.05, along), M.iron, at(Math.cos(a) * (r - 0.03), Math.sin(a) * (r - 0.03), 0));
  // a stone frame round the opening
  for (const s of [-1, 1]) {
    roof.add(new THREE.BoxGeometry(across + 0.6, 0.3, 0.3), M.stone, at(0, -0.15, s * (along / 2 + 0.15)));
    roof.add(new THREE.BoxGeometry(0.3, 0.3, along), M.stone, at(s * (across / 2 + 0.15), -0.15, 0));
  }
}
