// Collects the building's thousands of small parts (walls, mouldings, steps…) and merges
// them into one mesh per material, so a phone draws a floor in a few dozen calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const helper = new THREE.Object3D();
export function matrix({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  helper.position.set(x, y, z);
  helper.rotation.set(rx, ry, rz, 'YXZ');
  helper.scale.set(sx, sy, sz);
  helper.updateMatrix();
  return helper.matrix.clone();
}

function slice(geometry, start, count) {
  const out = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const size = attribute.itemSize;
    out.setAttribute(name, new THREE.BufferAttribute(attribute.array.slice(start * size, (start + count) * size), size));
  }
  return out;
}

export class Batch {
  constructor() { this.parts = new Map(); }

  // material can be an array, matching the geometry's groups (e.g. wallpaper on the faces, stone on the edges)
  add(geometry, material, transform, meta = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(transform);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    const materials = [].concat(material);
    const count = g.attributes.position.count;
    const groups = Array.isArray(material) && g.groups.length ? g.groups : [{ start: 0, count, materialIndex: 0 }];
    for (const group of groups) {
      const m = materials[group.materialIndex];
      if (!m) continue;
      const piece = group.start === 0 && group.count >= count ? g : slice(g, group.start, Math.min(group.count, count - group.start));
      piece.clearGroups();
      const key = `${m.uuid}|${meta.kind || ''}|${meta.floor ?? ''}|${meta.step ?? ''}`;
      if (!this.parts.has(key)) this.parts.set(key, { material: m, meta, list: [] });
      this.parts.get(key).list.push(piece);
    }
  }

  build(parent, targets) {
    for (const { material, meta, list } of this.parts.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), material);
      mesh.userData = { ...meta };
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      if (meta.kind && targets) targets.push(mesh);
      list.forEach(g => g.dispose());
    }
    this.parts.clear();
  }
}
