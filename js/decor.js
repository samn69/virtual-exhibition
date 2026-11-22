// Sculptures and plants for the halls and the entrance.
// The bust, horse, ficus, alocasia and vase are free (CC0) models from Poly Haven, in assets/models.
// The monstera, snake plant and bird of paradise are drawn here.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { matrix } from './batch.js';
import { leafTexture, marbleTexture, seeded } from './textures.js';

const MODELS = {
  bust: { file: 'marble_bust_01', height: 0.56 },
  horse: { file: 'horse_statue_01', height: 1.25 },
  ficus: { file: 'potted_plant_01', height: 1.9 },
  alocasia: { file: 'potted_plant_02', height: 1.3 },
  vase: { file: 'antique_ceramic_vase_01', height: 0.55 },
};
const loader = new GLTFLoader();
const loading = new Map();
function model(type, envMap) {
  const { file, height } = MODELS[type];
  if (!loading.has(file)) {
    loading.set(file, loader.loadAsync(`assets/models/${file}/${file}.gltf`).then(gltf => {
      // scale to its real size, standing on y = 0, centred
      const scene = gltf.scene, box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
      const s = height / size.y;
      scene.traverse(o => { if (o.material) { o.material.userData.shared = true; o.material.envMap = envMap; o.material.envMapIntensity = 0.6; } });
      const wrapper = new THREE.Group();
      scene.position.set(-centre.x * s, -box.min.y * s, -centre.z * s);
      scene.scale.setScalar(s);
      wrapper.add(scene);
      return wrapper;
    }));
  }
  return loading.get(file).then(original => original.clone(true));
}

let shared = null;
function materials() {
  if (shared) return shared;
  const marble = marbleTexture(4);
  shared = {
    marble: new THREE.MeshLambertMaterial({ map: marble }),
    velvet: new THREE.MeshLambertMaterial({ color: '#6b1f24' }),
    terracotta: new THREE.MeshLambertMaterial({ color: '#b0643f' }),
    ceramic: new THREE.MeshLambertMaterial({ color: '#e6ddcc' }),
    soil: new THREE.MeshLambertMaterial({ color: '#3a2a1e' }),
    stem: new THREE.MeshLambertMaterial({ color: '#4d6b35' }),
    monstera: new THREE.MeshLambertMaterial({ map: leafTexture('monstera'), alphaTest: 0.5, side: THREE.DoubleSide }),
    bird: new THREE.MeshLambertMaterial({ map: leafTexture('bird'), alphaTest: 0.5, side: THREE.DoubleSide }),
    snake: new THREE.MeshLambertMaterial({ map: leafTexture('snake'), alphaTest: 0.5, side: THREE.DoubleSide }),
    blooms: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    flowerLeaf: new THREE.MeshLambertMaterial({ color: '#3f6b34', side: THREE.DoubleSide }),
    foliage: new THREE.MeshLambertMaterial({ color: '#2f4f27' }),
  };
  for (const m of Object.values(shared)) m.userData.shared = true; // kept when the gallery is rebuilt
  return shared;
}

const lathe = (points, segments = 32) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
function pedestal(height) {
  const h = height;
  return new THREE.Mesh(lathe([[0, 0], [0.32, 0], [0.32, 0.1], [0.26, 0.14], [0.21, 0.2], [0.21, h - 0.2], [0.26, h - 0.14], [0.32, h - 0.1], [0.32, h], [0, h]]), materials().marble);
}
function plinth() {
  const group = new THREE.Group(), m = materials().marble;
  const add = (w, h, d, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.y = y; group.add(b); };
  add(1.7, 0.12, 0.95, 0.06); add(1.5, 0.56, 0.75, 0.4); add(1.7, 0.1, 0.95, 0.73);
  return group;
}
function settee() {
  const group = new THREE.Group(), { velvet } = materials();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.1, 0.45, 40), velvet); seat.position.y = 0.225;
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.55, 32), velvet); back.position.y = 0.72;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.08, 40), new THREE.MeshLambertMaterial({ color: '#3b2a1f' })); base.position.y = 0.04;
  group.add(base, seat, back);
  return group;
}

// a pot with soil
function pot(rTop, rBottom, height, material) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(lathe([[0, 0], [rBottom, 0], [rTop, height * 0.88], [rTop + 0.03, height * 0.9], [rTop + 0.03, height], [rTop - 0.015, height], [rTop - 0.015, height * 0.94], [0, height * 0.94]]), material));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(rTop - 0.02, 24), materials().soil);
  soil.rotation.x = -Math.PI / 2; soil.position.y = height * 0.93;
  group.add(soil);
  return group;
}
// a leaf: a plane from its stem upwards, curving back a little
function leaf(width, length, bend) {
  const g = new THREE.PlaneGeometry(width, length, 1, 6);
  g.translate(0, length / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = p.getY(i) / length; p.setZ(i, bend * v * v); }
  g.computeVertexNormals();
  return g;
}
function plant(kind) {
  const random = seeded({ monstera: 21, bird: 22, snake: 23 }[kind]);
  const m = materials();
  const spec = {
    monstera: { pot: [0.3, 0.22, 0.45, m.terracotta], leaves: 8 },
    bird: { pot: [0.3, 0.24, 0.5, m.ceramic], leaves: 9 },
    snake: { pot: [0.2, 0.16, 0.36, m.ceramic], leaves: 13 },
  }[kind];
  const [rTop, rBottom, potH, potMaterial] = spec.pot;
  const group = pot(rTop, rBottom, potH, potMaterial);
  const leaves = [], stems = [], soil = potH * 0.93;
  for (let i = 0; i < spec.leaves; i++) {
    const yaw = (i / spec.leaves) * Math.PI * 2 + random() * 0.5;
    if (kind === 'snake') {
      const r = random() * rTop * 0.6;
      leaves.push(leaf(0.09, 0.6 + random() * 0.4, 0.05 + random() * 0.06).applyMatrix4(matrix({ x: Math.sin(yaw) * r, y: soil, z: Math.cos(yaw) * r, ry: yaw + random(), rx: 0.04 + random() * 0.16 })));
      continue;
    }
    const tilt = kind === 'bird' ? 0.12 + random() * 0.3 : 0.45 + random() * 0.45;
    const length = kind === 'bird' ? 0.65 + random() * 0.45 : 0.45 + random() * 0.35;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt));
    const base = new THREE.Vector3(Math.sin(yaw) * 0.05, soil, Math.cos(yaw) * 0.05);
    const mid = base.clone().addScaledVector(dir, length / 2), tip = base.clone().addScaledVector(dir, length);
    stems.push(new THREE.CylinderGeometry(0.012, 0.016, length, 6).applyMatrix4(matrix({ x: mid.x, y: mid.y, z: mid.z, ry: yaw, rx: tilt })));
    const blade = kind === 'bird' ? leaf(0.24, 0.62, -0.06) : leaf(0.5, 0.5, -0.12);
    leaves.push(blade.applyMatrix4(matrix({ x: tip.x, y: tip.y, z: tip.z, ry: yaw, rx: tilt + (kind === 'bird' ? 0.15 : 0.55), rz: (random() - 0.5) * 0.4 })));
  }
  group.add(new THREE.Mesh(mergeGeometries(leaves), m[kind]));
  if (stems.length) group.add(new THREE.Mesh(mergeGeometries(stems), m.stem));
  return group;
}

// a large arrangement of flowers in a stone urn on a pedestal, about as tall as a statue
function flowers() {
  const random = seeded(77), m = materials(), group = new THREE.Group();
  const pedestalH = 0.75, urnH = 0.62, rim = pedestalH + urnH;
  const base = new THREE.Mesh(lathe([[0, 0], [0.5, 0], [0.5, 0.12], [0.42, 0.18], [0.36, 0.24], [0.36, pedestalH - 0.12], [0.44, pedestalH - 0.06], [0.5, pedestalH - 0.04], [0.5, pedestalH], [0, pedestalH]], 40), m.marble);
  const urn = new THREE.Mesh(lathe([[0, 0], [0.26, 0], [0.26, 0.05], [0.12, 0.1], [0.1, 0.2], [0.3, 0.3], [0.46, 0.46], [0.5, 0.56], [0.54, 0.6], [0.54, 0.62], [0.47, 0.62], [0.45, 0.58], [0, 0.58]].map(([r, y]) => [r, y + pedestalH]), 40), m.marble);
  group.add(base, urn);
  // blooms: soft round roses and peonies, star-shaped lilies, and tall spires, with leaves
  const palette = ['#f2d3dc', '#e8a3b5', '#c93a52', '#f7f2ea', '#f3e1c0', '#d9677e', '#ffffff', '#b0233c'];
  const rose = new THREE.IcosahedronGeometry(0.075, 1).scale(1, 0.72, 1);
  const lily = (() => { const sh = new THREE.Shape(); for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 2, r = 0.03 + 0.07 * Math.abs(Math.cos(a * 3)) ** 2; i ? sh.lineTo(r * Math.cos(a), r * Math.sin(a)) : sh.moveTo(r * Math.cos(a), r * Math.sin(a)); } return new THREE.ShapeGeometry(sh).toNonIndexed(); })();
  const leafShape = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.07, 0.12, 0, 0.26); sh.quadraticCurveTo(-0.07, 0.12, 0, 0); return new THREE.ShapeGeometry(sh, 6); })();
  const coloured = (geometry, color, transform) => {
    const g = geometry.clone().applyMatrix4(transform), c = new THREE.Color(color);
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3));
    return g;
  };
  const parts = [], leaves = [];
  const radius = 0.78, tall = 0.62;
  for (let i = 0; i < 230; i++) { // points on a dome above the urn
    const a = random() * Math.PI * 2, h = Math.sqrt(random());
    const r = radius * Math.sqrt(1 - h * h) * (0.85 + random() * 0.2), y = rim + 0.05 + tall * h;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, color = palette[Math.floor(random() * palette.length)];
    const out = new THREE.Vector3(x, (y - rim) * 1.2, z).normalize();
    const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
    const s = 0.8 + random() * 0.5;
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), face, new THREE.Vector3(s, s, s));
    parts.push(coloured(random() < 0.78 ? rose : lily, color, transform));
  }
  for (let i = 0; i < 9; i++) { // spires of small blooms, delphinium-like, rising out of the top
    const a = (i / 9) * Math.PI * 2 + random(), r = 0.18 + random() * 0.3, color = random() < 0.5 ? '#7d8fd6' : '#f4f0f5';
    for (let k = 0; k < 9; k++) {
      const t = k / 8, y = rim + tall * 0.75 + t * 0.55, rr = r * (1 - t * 0.3), s = 0.45 * (1 - t * 0.5);
      parts.push(coloured(rose, color, new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr), new THREE.Quaternion(), new THREE.Vector3(s, s, s))));
    }
  }
  for (let i = 0; i < 70; i++) { // leaves around the edge and hanging over the rim
    const a = random() * Math.PI * 2, h = random() * 0.5, r = radius * (0.95 - h * 0.3), y = rim + 0.02 + h * tall * 0.8;
    const out = new THREE.Vector3(Math.cos(a), -0.2 + h, Math.sin(a)).normalize();
    const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
    const s = 1.0 + random() * 0.8;
    leaves.push(leafShape.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r * 0.8, y, Math.sin(a) * r * 0.8), face, new THREE.Vector3(s, s, s))));
  }
  const fill = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.92, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, tall / radius, 1), m.foliage);
  fill.position.y = rim + 0.02;
  group.add(fill);
  group.add(new THREE.Mesh(mergeGeometries(parts), m.blooms));
  group.add(new THREE.Mesh(mergeGeometries(leaves), m.flowerLeaf));
  return group;
}

// put every piece in its place; models appear as they finish loading
export function decorate(list, envMap) {
  const jobs = [];
  for (const { group, type, x, y, z, ry } of list) {
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.rotation.y = ry || 0;
    group.add(holder);
    if (type === 'monstera' || type === 'bird' || type === 'snake') { holder.add(plant(type)); continue; }
    if (type === 'settee') { holder.add(settee()); continue; }
    if (type === 'flowers') { holder.add(flowers()); continue; }
    let lift = 0;
    if (type === 'bust') { holder.add(pedestal(1.1)); lift = 1.1; }
    if (type === 'vase') { holder.add(pedestal(1.0)); lift = 1.0; }
    if (type === 'horse') { holder.add(plinth()); lift = 0.78; }
    jobs.push(model(type, envMap).then(object => { object.position.y = lift; holder.add(object); }).catch(error => console.warn(`Couldn't load the ${type}`, error)));
  }
  return Promise.all(jobs);
}
