// Sculptures and plants for the halls and the entrance.
// The bust, horse, ficus, alocasia and vase are free (CC0) models from Poly Haven, in assets/models.
// The monstera, snake plant, bird of paradise, the flower urn and the bouquet in a glass vase are drawn here.
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
    glass: new THREE.MeshPhongMaterial({ color: '#e8f2ee', specular: '#ffffff', shininess: 120, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    bouquetFill: new THREE.MeshLambertMaterial({ color: '#6c5a86' }), // the shadowy depths among the flowers
    water: new THREE.MeshLambertMaterial({ color: '#cfe3dc', transparent: true, opacity: 0.25, depthWrite: false }),
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

// blooms, in meshes with vertex colours (shared by the arrangements below); ruffled petals are darker in their folds
const ruffled = (radius, detail, squash, roughness, seed) => {
  const g = new THREE.IcosahedronGeometry(radius, detail), p = g.attributes.position, shade = [];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i), n = v.clone().normalize();
    const h = Math.sin(n.x * 17.1 + seed) * Math.sin(n.y * 13.7) * Math.sin(n.z * 15.3 + seed * 2);
    const k = 1 + roughness * h; v.multiplyScalar(k); v.y *= squash; p.setXYZ(i, v.x, v.y, v.z); shade.push(0.78 + 0.22 * (h * 0.5 + 0.5));
  }
  g.computeVertexNormals(); g.userData.shade = shade; return g;
};
const floret = (() => { const sh = new THREE.Shape(); for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2, r = 0.012 + 0.022 * Math.abs(Math.cos(a * 2)); i ? sh.lineTo(r * Math.cos(a), r * Math.sin(a)) : sh.moveTo(r * Math.cos(a), r * Math.sin(a)); } return new THREE.ShapeGeometry(sh).toNonIndexed(); })();
const coloured = (geometry, color, transform) => {
  const g = geometry.clone().applyMatrix4(transform), c = new THREE.Color(color), shade = geometry.userData.shade, out = [];
  for (let i = 0; i < g.attributes.position.count; i++) { const k = shade ? shade[i] : 1; out.push(c.r * k, c.g * k, c.b * k); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(out, 3));
  return g;
};
const face = out => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
const leafShape = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.05, 0.08, 0, 0.17); sh.quadraticCurveTo(-0.05, 0.08, 0, 0); return new THREE.ShapeGeometry(sh, 6); })();

// a large arrangement of flowers, as in a formal garden: a carved stone urn with handles on a
// square pedestal with carved panels, holding pink peonies, white and cream roses and white
// hydrangeas, with greenery trailing over the rim. About as tall as a statue.
function flowers() {
  const random = seeded(77), m = materials(), group = new THREE.Group();
  const stone = m.marble, pedH = 1.0, urnH = 0.82, rim = pedH + urnH;
  const peony = ruffled(0.12, 2, 0.78, 0.22, 1), rose = ruffled(0.08, 1, 0.8, 0.12, 4);
  const box = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone); b.position.set(x, y, z); group.add(b); };

  // the pedestal: plinth, a die with a carved panel and medallion on each face, and a capping
  box(0.92, 0.12, 0.92, 0, 0.06, 0); box(0.82, 0.08, 0.82, 0, 0.16, 0);
  box(0.7, 0.62, 0.7, 0, 0.51, 0);
  box(0.82, 0.07, 0.82, 0, 0.855, 0); box(0.9, 0.1, 0.9, 0, 0.94, 0);
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group(); face.rotation.y = (k * Math.PI) / 2; group.add(face);
    const add = (geometry, x, y, z, rx = 0) => { const p = new THREE.Mesh(geometry, stone); p.position.set(x, y, z); p.rotation.x = rx; face.add(p); };
    for (const y of [0.29, 0.73]) add(new THREE.BoxGeometry(0.5, 0.035, 0.03), 0, y, 0.36);
    for (const x of [-0.235, 0.235]) add(new THREE.BoxGeometry(0.035, 0.47, 0.03), x, 0.51, 0.36);
    add(new THREE.CylinderGeometry(0.11, 0.12, 0.03, 24), 0, 0.51, 0.36, Math.PI / 2);
    add(new THREE.TorusGeometry(0.11, 0.012, 6, 24), 0, 0.51, 0.375);
  }

  // the urn: a foot and baluster stem, a fluted (gadrooned) bowl and a flared, moulded rim
  const profile = [[0, 0], [0.24, 0], [0.24, 0.05], [0.18, 0.08], [0.11, 0.14], [0.1, 0.22], [0.14, 0.26], [0.1, 0.3],
    [0.16, 0.34], [0.3, 0.42], [0.37, 0.52], [0.36, 0.62], [0.31, 0.7], [0.33, 0.74], [0.42, 0.79], [0.44, 0.82], [0.38, 0.82], [0, 0.8]];
  const urn = lathe(profile, 72), pos = urn.attributes.position;
  for (let i = 0; i < pos.count; i++) { // flutes round the bowl
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y < 0.36 || y > 0.69) continue;
    const t = Math.sin(((y - 0.36) / 0.33) * Math.PI), k = 1 + 0.05 * t * Math.abs(Math.cos(Math.atan2(z, x) * 9));
    pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  urn.computeVertexNormals();
  const urnMesh = new THREE.Mesh(urn, stone); urnMesh.position.y = pedH; group.add(urnMesh);
  for (const s of [-1, 1]) { // scrolled handles
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 20, Math.PI * 1.3), stone);
    h.position.set(s * 0.38, pedH + 0.6, 0); h.rotation.set(0, 0, s > 0 ? -0.9 : Math.PI - 0.4); group.add(h);
  }

  // the bouquet is a tall rounded dome, wider than the urn, like the photo
  const cy = rim + 0.42, rx = 0.66, ry = 0.62;
  const onDome = (inset = 1) => {
    for (;;) {
      const a = random() * Math.PI * 2, u = random() * 1.15 - 0.15; // a little below the middle too
      const y = cy + ry * u * inset, r = rx * Math.sqrt(Math.max(0, 1 - u * u)) * inset;
      if (y < rim + 0.04) continue;
      return { p: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), out: new THREE.Vector3(Math.cos(a) * r / rx, (y - cy) / ry, Math.sin(a) * r / rx).normalize() };
    }
  };
  const parts = [], leaves = [];
  const pinks = ['#e2508f', '#d63f7f', '#ee74a6', '#c92f6c', '#f08cb5'];
  for (let i = 0; i < 70; i++) { const { p, out } = onDome(); const s = 0.85 + random() * 0.4;
    parts.push(coloured(peony, pinks[Math.floor(random() * pinks.length)], new THREE.Matrix4().compose(p, face(out), new THREE.Vector3(s, s, s)))); }
  for (let i = 0; i < 90; i++) { const { p, out } = onDome(0.99); const s = 0.8 + random() * 0.4;
    parts.push(coloured(rose, random() < 0.6 ? '#f7f4ee' : '#f1e6cc', new THREE.Matrix4().compose(p, face(out), new THREE.Vector3(s, s, s)))); }
  for (let i = 0; i < 26; i++) { // hydrangea heads: balls of small four-petalled florets
    const { p, out } = onDome(0.97), q = new THREE.Vector3();
    for (let k = 0; k < 22; k++) {
      q.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
      if (q.dot(out) < -0.2) q.negate();
      const at = p.clone().addScaledVector(q, 0.1), c = random() < 0.5 ? '#f4f6ea' : '#e6edd6';
      parts.push(coloured(floret, c, new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), q), new THREE.Vector3(1, 1, 1))));
    }
  }
  // leaves among the flowers, and strands of greenery trailing over the rim and down the urn
  const leafAt = (p, dir, s) => leaves.push(leafShape.clone().applyMatrix4(new THREE.Matrix4().compose(p, face(dir), new THREE.Vector3(s, s, s))));
  for (let i = 0; i < 120; i++) { const { p, out } = onDome(0.96); leafAt(p, out.clone().add(new THREE.Vector3(random() - 0.5, 0, random() - 0.5)).normalize(), 1 + random() * 0.6); }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + random() * 0.3, len = 0.5 + random() * 0.6, r0 = 0.42;
    for (let k = 0; k < 14; k++) {
      const t = k / 13, r = r0 + 0.12 * Math.sin(t * Math.PI * 0.7) + 0.03, y = rim + 0.04 - t * len;
      const p = new THREE.Vector3(Math.cos(a + t * 0.2) * r, y, Math.sin(a + t * 0.2) * r);
      const dir = new THREE.Vector3(Math.cos(a) * 0.6 + (random() - 0.5) * 0.8, -0.6 + random() * 0.4, Math.sin(a) * 0.6 + (random() - 0.5) * 0.8).normalize();
      leafAt(p, dir, 0.7 + random() * 0.4);
    }
  }
  const fill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), m.foliage);
  fill.scale.set(rx * 0.9, ry * 0.9, rx * 0.9); fill.position.y = cy;
  const fillBase = new THREE.Mesh(new THREE.CylinderGeometry(rx * 0.72, 0.4, cy - rim, 24, 1, true), m.foliage);
  fillBase.position.y = (cy + rim) / 2;
  group.add(fill, fillBase);
  group.add(new THREE.Mesh(mergeGeometries(parts), m.blooms));
  group.add(new THREE.Mesh(mergeGeometries(leaves), m.flowerLeaf));
  return group;
}

// a bouquet in a glass bubble vase on a marble column, like the photo: white hydrangeas round the
// rim, lavender carnations, white and blush roses and sprigs of purple statice above, the stems
// showing through the glass and the water. About as tall as the urn on the other floors.
function bouquet() {
  const random = seeded(78), m = materials(), group = new THREE.Group();
  const pedH = 1.0, vaseH = 0.78, rim = pedH + vaseH;
  group.add(pedestal(pedH));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 40), m.marble); top.position.y = pedH + 0.03; group.add(top);
  const base = pedH + 0.06;

  // the vase, the water and the stems inside
  const vase = new THREE.Mesh(lathe([[0, 0], [0.13, 0], [0.22, 0.04], [0.31, 0.16], [0.35, 0.31], [0.33, 0.46], [0.25, 0.6], [0.18, 0.68], [0.19, 0.74], [0.22, 0.78 - 0.06]], 48), m.glass);
  vase.position.y = base; vase.renderOrder = 2;
  const water = new THREE.Mesh(lathe([[0, 0], [0.12, 0], [0.21, 0.04], [0.3, 0.16], [0.335, 0.31], [0.32, 0.44], [0, 0.44]], 40), m.water);
  water.position.y = base + 0.01; water.renderOrder = 1;
  const stems = [];
  for (let i = 0; i < 34; i++) {
    const a = random() * Math.PI * 2, r0 = random() * 0.12, r1 = 0.1 + random() * 0.08;
    const from = new THREE.Vector3(Math.cos(a) * r0, base + 0.03, Math.sin(a) * r0), to = new THREE.Vector3(Math.cos(a) * r1 * 1.6, rim + 0.1, Math.sin(a) * r1 * 1.6);
    const mid = from.clone().add(to).multiplyScalar(0.5), len = from.distanceTo(to);
    const stem = new THREE.CylinderGeometry(0.008, 0.01, len, 5);
    stem.applyMatrix4(new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()), new THREE.Vector3(1, 1, 1)));
    stems.push(stem);
  }
  group.add(new THREE.Mesh(mergeGeometries(stems), m.stem), water, vase);

  // the flowers on a rounded dome over the rim
  const cy = rim + 0.36, rx = 0.62, ry = 0.55;
  const onDome = (u0, u1, inset = 1) => {
    const a = random() * Math.PI * 2, u = u0 + random() * (u1 - u0);
    const y = cy + ry * u * inset, r = rx * Math.sqrt(Math.max(0, 1 - u * u)) * inset;
    return { p: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), out: new THREE.Vector3(Math.cos(a) * r / rx, (y - cy) / ry, Math.sin(a) * r / rx).normalize() };
  };
  const carnation = ruffled(0.085, 2, 0.7, 0.3, 7), head = ruffled(0.12, 2, 0.9, 0.12, 5), rose = ruffled(0.09, 1, 0.85, 0.1, 4), bud = ruffled(0.022, 0, 1.3, 0.25, 3);
  const parts = [], leaves = [];
  const put = (geometry, color, p, out, s) => parts.push(coloured(geometry, color, new THREE.Matrix4().compose(p, face(out), new THREE.Vector3(s, s, s))));
  for (let i = 0; i < 34; i++) { // white hydrangea heads round the lower half, over the rim
    const { p, out } = onDome(-0.6, 0.3, 1.02), q = new THREE.Vector3();
    put(head, random() < 0.5 ? '#eef0e6' : '#e4eadb', p, out, 1); // the head itself, covered in florets
    for (let k = 0; k < 34; k++) {
      q.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
      if (q.dot(out) < -0.2) q.negate();
      const at = p.clone().addScaledVector(q, 0.12);
      parts.push(coloured(floret, random() < 0.6 ? '#f7f8f2' : '#eaefe2', new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), q), new THREE.Vector3(1.1, 1.1, 1.1))));
    }
  }
  const lavender = ['#9b6fd9', '#a882e6', '#8a5cc9', '#b493ec'];
  for (let i = 0; i < 130; i++) { const { p, out } = onDome(-0.05, 1, 1.03); put(carnation, lavender[Math.floor(random() * lavender.length)], p, out, 0.9 + random() * 0.35); }
  for (let i = 0; i < 16; i++) { const { p, out } = onDome(0.1, 0.85, 1.07); put(rose, random() < 0.5 ? '#f8f4ec' : '#f3dcda', p, out, 1.1 + random() * 0.3); }
  for (let i = 0; i < 16; i++) { // statice: sprigs of small dark purple buds sticking out
    const { p, out } = onDome(0, 0.9, 1.05);
    for (let k = 0; k < 9; k++) {
      const at = p.clone().addScaledVector(out, 0.03 + k * 0.03).add(new THREE.Vector3((random() - 0.5) * 0.06, (random() - 0.5) * 0.05, (random() - 0.5) * 0.06));
      put(bud, random() < 0.5 ? '#5b2d92' : '#6e3aa8', at, out, 1);
    }
  }
  for (let i = 0; i < 70; i++) { const { p, out } = onDome(-0.4, 0.9, 0.97); leaves.push(leafShape.clone().applyMatrix4(new THREE.Matrix4().compose(p, face(out.clone().add(new THREE.Vector3(random() - 0.5, 0, random() - 0.5)).normalize()), new THREE.Vector3(0.9, 0.9, 0.9)))); }
  const fill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), m.foliage);
  fill.scale.set(rx * 0.8, ry * 0.8, rx * 0.8); fill.position.y = cy;
  fill.material = m.bouquetFill;
  group.add(fill, new THREE.Mesh(mergeGeometries(parts), m.blooms), new THREE.Mesh(mergeGeometries(leaves), m.flowerLeaf));
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
    if (type === 'bouquet') { holder.add(bouquet()); continue; }
    let lift = 0;
    if (type === 'bust') { holder.add(pedestal(1.1)); lift = 1.1; }
    if (type === 'vase') { holder.add(pedestal(1.0)); lift = 1.0; }
    if (type === 'horse') { holder.add(plinth()); lift = 0.78; }
    jobs.push(model(type, envMap).then(object => { object.position.y = lift; holder.add(object); }).catch(error => console.warn(`Couldn't load the ${type}`, error)));
  }
  return Promise.all(jobs);
}
