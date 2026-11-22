// The museum: an entrance with oval steps up to a central hall, two wings of four rooms on
// each floor visited as a loop, and a round stairwell with a spiral staircase to the floors above.
// The number of floors comes from the exhibition; every floor has the same plan.
//
//            ┌─────┬─────┬──(stairs)─┬─────┬─────┐
//            │ L4  │ L3  │           │ R3  │ R4  │      z
//            │     ∩     ∩   HALL    ∩     ∩     │      ↑ north is -z
//            ├──∩──┼─────┤           ├─────┼──∩──┤      └→ x
//            │ L1  ∩ L2  ∩           ∩ R2  ∩ R1  │
//            └─────┴─────┴─────∩─────┴─────┴─────┘
//                          oval steps
//                         ┌─ENTRANCE─┐
import * as THREE from 'three';
import { Batch, matrix } from './batch.js';
import { canvasTexture, oakTexture, OAK_TILE, wallpaperTexture, WALLPAPER_TILE, marbleTexture } from './textures.js';
import { buildStairs, ovalStepsHeight } from './stairs.js';
import { H, T, BASE, PHOTO_Y, DOOR, ROOMS_PER_FLOOR, floorY } from './constants.js';
import { wallShape, archTrim } from './shapes.js';
export * from './constants.js';

const MARGIN = 0.45;           // how close a visitor gets to a wall

const HALL_COLOR = '#6a2626';


// the right wing in visiting order; the left wing is its mirror image. The first door is the way in.
const INNER = [6.4, 16.4], OUTER = [16.8, 26.8], SOUTH = [0.2, 9.2], NORTH = [-9.2, -0.2];
const WING = [
  { key: '2', x: INNER, z: SOUTH, doors: [['W', 'hall'], ['E', '1']] },
  { key: '1', x: OUTER, z: SOUTH, doors: [['W', '2'], ['N', '4']] },
  { key: '4', x: OUTER, z: NORTH, doors: [['S', '1'], ['W', '3']] },
  { key: '3', x: INNER, z: NORTH, doors: [['E', '4'], ['W', 'hall']] },
];
const ORDER = ['R2', 'R1', 'R4', 'R3', 'L2', 'L1', 'L4', 'L3'];
const MIRROR = { E: 'W', W: 'E', N: 'N', S: 'S' };

function planFloor(f) {
  const y = floorY(f), spaces = [];
  const id = key => key === 'hall' ? `h${f}` : `r${f * ROOMS_PER_FLOOR + ORDER.indexOf(key)}`;
  const hall = { id: `h${f}`, kind: 'hall', floor: f, x0: -6, x1: 6, z0: -9.2, z1: 9.2, y, doors: [
    { side: 'E', at: 4.7, to: id('R2') }, { side: 'E', at: -4.7, to: id('R3') },
    { side: 'W', at: 4.7, to: id('L2') }, { side: 'W', at: -4.7, to: id('L3') },
    { side: 'N', at: 0, to: `s${f}` },
  ] };
  if (f === 0) hall.doors.push({ side: 'S', at: 0, to: 'e' });
  spaces.push(hall);
  for (const wing of ['R', 'L']) {
    for (const room of WING) {
      const m = wing === 'L';
      const [a, b] = room.x, x0 = m ? -b : a, x1 = m ? -a : b, [z0, z1] = room.z;
      spaces.push({
        id: id(wing + room.key), kind: 'room', floor: f, index: f * ROOMS_PER_FLOOR + ORDER.indexOf(wing + room.key), x0, x1, z0, z1, y,
        doors: room.doors.map(([side, to]) => {
          const s = m ? MIRROR[side] : side;
          return { side: s, at: s === 'E' || s === 'W' ? (z0 + z1) / 2 : (x0 + x1) / 2, to: id(to === 'hall' ? 'hall' : wing + to) };
        }),
      });
    }
  }
  return spaces;
}

const ENTRANCE = { id: 'e', kind: 'entrance', floor: 0, x0: -7, x1: 7, z0: 9.6, z1: 21.6, y: 0, height: BASE + H, doors: [
  { side: 'N', at: 0, to: 'h0', bottom: BASE },
  { side: 'S', at: 0, to: null, width: 3.2, spring: 3.0, front: true },
] };

// a wall seen from inside a space: where its face is and which way it turns
function wallFrame(space, side) {
  const { x0, x1, z0, z1, y } = space, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  switch (side) {
    case 'N': return { m: matrix({ x: cx, y, z: z0, ry: Math.PI }), length: x1 - x0, u: at => cx - at, inward: [0, 1] };
    case 'S': return { m: matrix({ x: cx, y, z: z1 }), length: x1 - x0, u: at => at - cx, inward: [0, -1] };
    case 'E': return { m: matrix({ x: x1, y, z: cz, ry: Math.PI / 2 }), length: z1 - z0, u: at => cz - at, inward: [-1, 0] };
    case 'W': return { m: matrix({ x: x0, y, z: cz, ry: -Math.PI / 2 }), length: z1 - z0, u: at => at - cz, inward: [1, 0] };
  }
}
// in a wall's own frame: x along the wall, y up, z out of the room into the wall
const onWall = (frame, local) => frame.m.clone().multiply(matrix(local));

const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 });

// floor and ceiling pieces with texture coordinates in metres, so the planks run on seamlessly
function flat(x0, x1, z0, z1, tile, up = true) {
  const g = new THREE.BufferGeometry();
  const p = up ? [x0, 0, z1, x1, 0, z1, x1, 0, z0, x0, 0, z0] : [x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array(4).fill([0, up ? 1 : -1, 0]).flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 2, 3].flatMap(i => [p[i * 3] / tile, -p[i * 3 + 2] / tile]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

const SERIF = 'Georgia, "Times New Roman", serif';
function signTexture(label) {
  return canvasTexture(1024, 192, (g, w, h) => {
    g.fillStyle = '#1d1712'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8954a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#d9bb72'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 76; g.font = `${size}px ${SERIF}`;
    while (g.measureText(label).width > w - 80 && size > 30) { size -= 4; g.font = `${size}px ${SERIF}`; }
    g.fillText(label, w / 2, h / 2 + 4);
  });
}
function titleTexture(title, subtitle) {
  return canvasTexture(1600, 400, (g, w, h) => {
    g.fillStyle = '#1d1712'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8954a'; g.lineWidth = 10; g.strokeRect(16, 16, w - 32, h - 32);
    g.lineWidth = 3; g.strokeRect(36, 36, w - 72, h - 72);
    g.fillStyle = '#e2c47c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 120; g.font = `${size}px ${SERIF}`;
    while (g.measureText(title).width > w - 140 && size > 40) { size -= 6; g.font = `${size}px ${SERIF}`; }
    g.fillText(title, w / 2, subtitle ? h * 0.4 : h / 2);
    if (subtitle) {
      g.fillStyle = '#cdb98c'; size = 52; g.font = `italic ${size}px ${SERIF}`;
      while (g.measureText(subtitle).width > w - 140 && size > 24) { size -= 4; g.font = `italic ${size}px ${SERIF}`; }
      g.fillText(subtitle, w / 2, h * 0.74);
    }
  });
}

// where photos hang in a wing room: two per wall, clear of the doorways, with room for the plaque
function roomSlots(space, frames) {
  const plain = [], withDoor = [];
  for (const side of ['N', 'S', 'E', 'W']) {
    const frame = frames[side], L = frame.length, door = space.doors.some(d => d.side === side);
    const half = L / 2, positions = door ? [-1, 1].map(s => s * (1.77 + (half - 2.59) / 2)) : [-L / 4, L / 4];
    const maxW = door ? Math.min(2.4, half - 2.59) : Math.min(2.6, 2 * (half - 0.82 - L / 4));
    for (const u of positions) {
      const m = onWall(frame, { x: u, y: PHOTO_Y, z: 0 });
      const position = new THREE.Vector3().setFromMatrixPosition(m);
      (door ? withDoor : plain).push({ position, rotationY: frame.ry + Math.PI, maxW, maxH: 1.85, plaqueSide: -Math.sign(u) || 1 });
    }
  }
  return [...plain, ...withDoor];
}

export function buildMuseum(exhibition, renderer) {
  const floors = exhibition.floors;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const root = new THREE.Group();
  const floorGroups = [], raycastTargets = [], decor = [];
  const walk = Array.from({ length: floors }, () => ({ rects: [], circles: [], blocks: [] }));
  const zones = Array.from({ length: floors }, () => []);
  const rooms = [];
  const edges = [];

  // materials
  const oak = oakTexture(anisotropy);
  const marble = marbleTexture(anisotropy);
  marble.repeat.set(1 / 1.5, 1 / 1.5);
  const M = {
    floor: new THREE.MeshLambertMaterial({ map: oak }),
    ceiling: new THREE.MeshLambertMaterial({ color: '#efe8db', emissive: '#6e6658' }),
    stone: new THREE.MeshLambertMaterial({ color: '#e9e1d0' }),
    marble: new THREE.MeshLambertMaterial({ map: marble }),
    skirting: new THREE.MeshLambertMaterial({ color: '#3a2c22' }),
    laylight: new THREE.MeshBasicMaterial({ color: '#f3f6fa' }),
    lead: new THREE.MeshLambertMaterial({ color: '#8c867c', emissive: '#3a3630' }),
    wood: new THREE.MeshLambertMaterial({ color: '#3b2a1f' }),
    velvet: new THREE.MeshLambertMaterial({ color: '#6b1f24' }),
    door: new THREE.MeshLambertMaterial({ color: '#4a3020', emissive: '#120a05' }),
    glass: new THREE.MeshBasicMaterial({ color: '#f1e2c0' }),
    brass: new THREE.MeshLambertMaterial({ color: '#a8823a', emissive: '#2a1c06' }),
  };
  oak.anisotropy = anisotropy;
  const wallpapers = new Map();
  const wallpaper = (color, pattern) => {
    const key = color + pattern;
    if (!wallpapers.has(key)) {
      const texture = wallpaperTexture(color, pattern, anisotropy);
      texture.repeat.set(1 / WALLPAPER_TILE, 1 / WALLPAPER_TILE);
      wallpapers.set(key, new THREE.MeshLambertMaterial({ map: texture }));
    }
    return wallpapers.get(key);
  };

  const names = new Map([['e', 'Entrance']]);
  for (let f = 0; f < floors; f++) { names.set(`h${f}`, floors > 1 ? `Central Hall · Floor ${f + 1}` : 'Central Hall'); names.set(`s${f}`, 'Stairs'); }
  exhibition.rooms.forEach((room, g) => names.set(`r${g}`, room.name));
  const signLabel = to => to.startsWith('s') ? 'Stairs' : to.startsWith('h') ? 'Central Hall' : names.get(to);

  const spaces = [];
  for (let f = 0; f < floors; f++) spaces.push(...planFloor(f));
  spaces.push(ENTRANCE);

  for (let f = 0; f < floors; f++) { const group = new THREE.Group(); group.name = `floor ${f + 1}`; floorGroups.push(group); root.add(group); }
  const batches = floorGroups.map(() => new Batch());

  for (const space of spaces) {
    const f = space.floor, batch = batches[f], group = floorGroups[f];
    const { x0, x1, z0, z1, y } = space, height = space.height || H;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const room = space.kind === 'room' ? exhibition.rooms[space.index] : null;
    const paper = room
      ? wallpaper(room.color, space.index % 3)
      : wallpaper(HALL_COLOR, 2);

    // floor, ceiling and a laylight
    batch.add(flat(x0 - T / 2, x1 + T / 2, z0 - T / 2, z1 + T / 2, OAK_TILE), M.floor, matrix({ y }), { kind: 'floor', floor: f });
    batch.add(flat(x0 - T / 2, x1 + T / 2, z0 - T / 2, z1 + T / 2, 1, false), M.ceiling, matrix({ y: y + height }));
    const lw = (x1 - x0) * 0.5, ld = (z1 - z0) * 0.4;
    batch.add(flat(cx - lw / 2, cx + lw / 2, cz - ld / 2, cz + ld / 2, 1, false), M.laylight, matrix({ y: y + height - 0.02 }));
    for (let i = 1; i < 4; i++) batch.add(new THREE.BoxGeometry(0.05, 0.04, ld), M.lead, matrix({ x: cx - lw / 2 + (lw * i) / 4, y: y + height - 0.04, z: cz }));
    batch.add(new THREE.BoxGeometry(lw, 0.04, 0.05), M.lead, matrix({ x: cx, y: y + height - 0.04, z: cz }));
    for (const s of [-1, 1]) {
      batch.add(new THREE.BoxGeometry(lw + 0.4, 0.22, 0.2), M.stone, matrix({ x: cx, y: y + height - 0.11, z: cz + s * (ld / 2 + 0.1) }));
      batch.add(new THREE.BoxGeometry(0.2, 0.22, ld), M.stone, matrix({ x: cx + s * (lw / 2 + 0.1), y: y + height - 0.11, z: cz }));
    }

    const frames = {};
    for (const side of ['N', 'S', 'E', 'W']) {
      const frame = frames[side] = wallFrame(space, side);
      frame.ry = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 }[side];
      const ext = side === 'N' || side === 'S' ? T / 2 : 0; // north and south walls cover the corners
      const doors = space.doors.filter(d => d.side === side).map(d => ({ ...d, u: frame.u(d.at), width: d.width || DOOR.width, spring: d.spring || DOOR.spring, bottom: d.bottom || 0 }));
      batch.add(extrude(wallShape(frame.length / 2 + ext, height, doors), T / 2), [paper, M.stone], frame.m, { kind: 'wall', floor: f });

      // cornice and skirting
      batch.add(new THREE.BoxGeometry(frame.length, 0.28, 0.14), M.stone, onWall(frame, { y: height - 0.14, z: -0.07 }));
      const gaps = doors.filter(d => !d.bottom).map(d => [d.u - d.width / 2 - 0.2, d.u + d.width / 2 + 0.2]).sort((a, b) => a[0] - b[0]);
      let from = -frame.length / 2;
      for (const [a, b] of [...gaps, [frame.length / 2, frame.length / 2]]) {
        if (a - from > 0.05) batch.add(new THREE.BoxGeometry(a - from, 0.22, 0.05), M.skirting, onWall(frame, { x: (a + from) / 2, y: 0.11, z: -0.025 }));
        from = b;
      }

      for (const d of doors) {
        batch.add(archTrim(d.width, d.spring), M.stone, onWall(frame, { x: d.u, y: d.bottom, z: -0.05 }));
        if (d.front) { // the closed front doors: two wooden leaves and a glazed fanlight
          for (const s of [-1, 1]) {
            batch.add(new THREE.BoxGeometry(d.width / 2 - 0.02, d.spring, 0.08), M.door, onWall(frame, { x: d.u + s * d.width / 4, y: d.spring / 2, z: 0.1 }));
            for (const py of [0.8, 2.1]) batch.add(new THREE.BoxGeometry(d.width / 2 - 0.4, 0.9, 0.04), M.wood, onWall(frame, { x: d.u + s * d.width / 4, y: py, z: 0.05 }));
            batch.add(new THREE.CylinderGeometry(0.03, 0.03, 0.4), M.brass, onWall(frame, { x: d.u + s * 0.18, y: 1.2, z: 0.03 }));
          }
          const fan = new THREE.Shape(); fan.absarc(0, 0, d.width / 2, 0, Math.PI, false); fan.closePath();
          batch.add(new THREE.ShapeGeometry(fan, 20), M.glass, onWall(frame, { x: d.u, y: d.spring, z: 0.12, ry: Math.PI }));
          continue;
        }
        // a sign above the doorway saying where it leads (the entrance has the exhibition title there instead)
        if (space.kind !== 'entrance') {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.56), new THREE.MeshBasicMaterial({ map: signTexture(signLabel(d.to)), toneMapped: false }));
        sign.applyMatrix4(onWall(frame, { x: d.u, y: d.bottom + d.spring + d.width / 2 + 0.72, z: -0.02, ry: Math.PI }));
        group.add(sign);
        }
        if (d.to) edges.push([space.id, d.to]);
        // the opening is walkable
        const [ix, iz] = frame.inward, along = d.width / 2 - 0.35;
        const p = new THREE.Vector3().setFromMatrixPosition(onWall(frame, { x: d.u }));
        const depth = T + MARGIN + 0.1;
        walk[f].rects.push(ix ? [p.x - (ix > 0 ? depth : MARGIN + 0.1), p.x + (ix > 0 ? MARGIN + 0.1 : depth), p.z - along, p.z + along]
          : [p.x - along, p.x + along, p.z - (iz > 0 ? depth : MARGIN + 0.1), p.z + (iz > 0 ? MARGIN + 0.1 : depth)]);
      }
    }

    walk[f].rects.push([x0 + MARGIN, x1 - MARGIN, z0 + MARGIN, z1 - MARGIN]);
    zones[f].push({ id: space.id, rect: [x0 - T / 2, x1 + T / 2, z0 - T / 2, z1 + T / 2] });

    if (space.kind === 'room') {
      // a bench facing the first wall without a door, out of the way of the route
      const side = ['N', 'S', 'E', 'W'].find(s => !space.doors.some(d => d.side === s));
      const [ix, iz] = frames[side].inward;
      const bx = ix ? (ix > 0 ? x0 : x1) + ix * 2.7 : cx, bz = iz ? (iz > 0 ? z0 : z1) + iz * 2.7 : cz;
      const ry = ix ? Math.PI / 2 : 0;
      batch.add(new THREE.BoxGeometry(2.4, 0.38, 0.6), M.wood, matrix({ x: bx, y: y + 0.19, z: bz, ry }), { kind: 'bench', floor: f });
      batch.add(new THREE.BoxGeometry(2.3, 0.08, 0.54), M.velvet, matrix({ x: bx, y: y + 0.42, z: bz, ry }));
      walk[f].blocks.push(ix ? [bx - 0.6, bx + 0.6, bz - 1.5, bz + 1.5] : [bx - 1.5, bx + 1.5, bz - 0.6, bz + 0.6]);
      rooms[space.index] = {
        floor: f, group, slots: roomSlots(space, frames), name: room.name,
        entrance: (() => { // just inside the way in, looking into the room
          const d = space.doors[0], [ix2, iz2] = frames[d.side].inward;
          const px = ix2 ? (ix2 > 0 ? x0 : x1) + ix2 * 1.4 : d.at, pz = iz2 ? (iz2 > 0 ? z0 : z1) + iz2 * 1.4 : d.at;
          return { floor: f, x: px, z: pz, yaw: Math.atan2(-ix2, -iz2) };
        })(),
      };
    }
  }

  // ── the entrance hall: oval steps, title above the doorway, sculptures and plants ──
  const entrance = batches[0], g0 = floorGroups[0];
  const title = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: titleTexture(exhibition.title, exhibition.subtitle), toneMapped: false }));
  title.position.set(0, 6.4, ENTRANCE.z0 + 0.03);
  g0.add(title);
  walk[0].rects.push([ENTRANCE.x0 + MARGIN, ENTRANCE.x1 - MARGIN, ENTRANCE.z0 + MARGIN, ENTRANCE.z1 - MARGIN]);

  // ── decoration: sculptures and plants (placed later by decor.js; their spots block walking now) ──
  const place = (f, type, x, z, ry = 0, radius = 0.5) => {
    decor.push({ group: floorGroups[f], type, x, y: f < 0 ? 0 : floorY(f), z, ry });
    walk[Math.max(f, 0)].circles.push([x, z, radius]);
  };
  for (let f = 0; f < floors; f++) {
    const swap = f % 2 ? -1 : 1;
    place(f, 'bust', -2.8, -8.1, 0, 0.55); place(f, 'bust', 2.8, -8.1, 0, 0.55);
    place(f, 'ficus', -5.0, -8.2, 0, 0.75); place(f, 'ficus', 5.0, -8.2, 0, 0.75);
    place(f, 'ficus', -5.0, 8.2, 0, 0.75); place(f, 'ficus', 5.0, 8.2, 0, 0.75);
    place(f, swap > 0 ? 'monstera' : 'bird', 5.25, 0, 0, 0.7);
    place(f, swap > 0 ? 'bird' : 'monstera', -5.25, 0, 0, 0.7);
    place(f, 'snake', 2.9, 8.4, 0, 0.45); place(f, 'alocasia', -2.9, 8.4, 0, 0.55);
    if (f === 0) place(f, 'horse', 0, 0, Math.PI / 2, 1.2);
    else { place(f, 'settee', 0, 0, 0, 1.6); place(f, 'vase', 0, 8.4, 0, 0.5); }
  }
  // the entrance belongs to the ground floor's group, at street level
  const placeEntrance = (type, x, z, ry = 0, radius = 0.5) => { decor.push({ group: g0, type, x, y: 0, z, ry }); walk[0].circles.push([x, z, radius]); };
  placeEntrance('bust', -6.0, 12.6, Math.PI / 2, 0.55); placeEntrance('bust', 6.0, 12.6, -Math.PI / 2, 0.55);
  placeEntrance('ficus', -6.0, 20.6, 0, 0.75); placeEntrance('ficus', 6.0, 20.6, 0, 0.75);
  placeEntrance('monstera', 6.0, 16.8, 0, 0.7); placeEntrance('bird', -6.0, 16.8, 0, 0.7);

  for (let f = 0; f < floors; f++) batches[f].build(floorGroups[f], raycastTargets);

  // ── stairs: the oval entrance steps and the spiral stairwell ──
  const stairs = buildStairs({ floors, root, M, raycastTargets, entranceGroup: g0, decor });
  for (let f = 0; f < floors; f++) {
    edges.push([`h${f}`, `s${f}`]);
    if (f) edges.push([`s${f - 1}`, `s${f}`]);
  }
  edges.push(['e', 'h0']);

  // ── walking, heights and where you are ──
  const inRect = (r, x, z) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
  const walkable = (f, x, z) => {
    const w = walk[f];
    if (w.blocks.some(r => inRect(r, x, z)) || w.circles.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < (r + 0.3) ** 2)) return false;
    return w.rects.some(r => inRect(r, x, z)) || stairs.walkable(f, x, z);
  };
  const inEntrance = (f, x, z) => f === 0 && z > ENTRANCE.z0 - 0.2;
  const heightAt = (f, x, z) => inEntrance(f, x, z) ? ovalStepsHeight(x, z) : floorY(f);
  const zoneAt = (f, x, z) => {
    if (inEntrance(f, x, z)) return 'e';
    if (stairs.contains(x, z)) return `s${f}`;
    return zones[f].find(r => inRect(r.rect, x, z))?.id || `h${f}`;
  };

  // how many doorways apart two places are, for loading photos near the visitor
  const neighbours = new Map();
  for (const [a, b] of edges) {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    if (!neighbours.has(b)) neighbours.set(b, new Set());
    neighbours.get(a).add(b); neighbours.get(b).add(a);
  }
  const distancesFrom = start => {
    const dist = new Map([[start, 0]]), queue = [start];
    while (queue.length) {
      const node = queue.shift();
      for (const next of neighbours.get(node) || []) if (!dist.has(next)) { dist.set(next, dist.get(node) + 1); queue.push(next); }
    }
    return dist;
  };

  return {
    root, floorGroups, stairGroup: stairs.group, raycastTargets, rooms, decor, floors, names,
    walkable, heightAt, zoneAt, distancesFrom,
    onLanding: (f, x, z) => stairs.onLanding(f, x, z),
    glidePath: stairs.glidePath,
    start: { floor: 0, x: 0, z: 19.6, yaw: 0 },
    hallStart: f => ({ floor: f, x: 0, z: -6.6, yaw: Math.PI }),
    showFloors(list) { floorGroups.forEach((g, f) => { g.visible = list.includes(f); }); },
    dispose() {
      for (const texture of [oak, marble]) texture.dispose();
      for (const m of wallpapers.values()) { m.map.dispose(); m.dispose(); }
      for (const m of Object.values(M)) m.dispose();
    },
  };
}
