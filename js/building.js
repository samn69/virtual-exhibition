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
import { canvasTexture, parquetTexture, PARQUET_TILE, wallpaperTexture, WALLPAPER_TILE, marbleTexture } from './textures.js';
import { buildStairs, ovalStepsHeight } from './stairs.js';
import { H, T, BASE, PHOTO_Y, DOOR, ROOMS_PER_FLOOR, floorY, HALL_HALF, ENTRANCE_HALF, HALL_COLOR, WING_COLORS } from './constants.js';
import { ceiling, DOME } from './ceilings.js';
import { wallShape } from './shapes.js';
import { doorway, doorwayHalfWidth } from './doorways.js';
import { frontDoors } from './frontdoors.js';
import { chandelier, sconce, wainscot } from './fittings.js';
export * from './constants.js';

const MARGIN = 0.45;           // how close a visitor gets to a wall

// two ficus by the front doors
const entrancePlants = (x, z1) => [['ficus', -x, z1 - 1.0], ['ficus', x, z1 - 1.0]];

// the right wing in visiting order; the left wing is its mirror image. The first door is the way in.
const SOUTH = [0.2, 9.2], NORTH = [-9.2, -0.2];
const wingPlan = () => {
  const INNER = [HALL_HALF + 0.4, HALL_HALF + 10.4], OUTER = [HALL_HALF + 10.8, HALL_HALF + 20.8];
  return [
    { key: '2', x: INNER, z: SOUTH, doors: [['W', 'hall'], ['E', '1']] },
    { key: '1', x: OUTER, z: SOUTH, doors: [['W', '2'], ['N', '4']] },
    { key: '4', x: OUTER, z: NORTH, doors: [['S', '1'], ['W', '3']] },
    { key: '3', x: INNER, z: NORTH, doors: [['E', '4'], ['W', 'hall']] },
  ];
};
const ORDER = ['R2', 'R1', 'R4', 'R3', 'L2', 'L1', 'L4', 'L3'];
const MIRROR = { E: 'W', W: 'E', N: 'N', S: 'S' };

function planFloor(f) {
  const y = floorY(f), spaces = [];
  const id = key => key === 'hall' ? `h${f}` : `r${f * ROOMS_PER_FLOOR + ORDER.indexOf(key)}`;
  const hall = { id: `h${f}`, kind: 'hall', floor: f, x0: -HALL_HALF, x1: HALL_HALF, z0: -9.2, z1: 9.2, y, doors: [
    { side: 'E', at: 4.7, to: id('R2') }, { side: 'E', at: -4.7, to: id('R3') },
    { side: 'W', at: 4.7, to: id('L2') }, { side: 'W', at: -4.7, to: id('L3') },
    { side: 'N', at: 0, to: `s${f}` },
  ] };
  if (f === 0) hall.doors.push({ side: 'S', at: 0, to: 'e' });
  spaces.push(hall);
  for (const wing of ['R', 'L']) {
    wingPlan().forEach((room, order) => {
      const m = wing === 'L';
      const [a, b] = room.x, x0 = m ? -b : a, x1 = m ? -a : b, [z0, z1] = room.z;
      spaces.push({
        id: id(wing + room.key), kind: 'room', floor: f, wing, order, index: f * ROOMS_PER_FLOOR + ORDER.indexOf(wing + room.key), x0, x1, z0, z1, y,
        doors: room.doors.map(([side, to]) => {
          const s = m ? MIRROR[side] : side;
          return { side: s, at: s === 'E' || s === 'W' ? (z0 + z1) / 2 : (x0 + x1) / 2, to: id(to === 'hall' ? 'hall' : wing + to) };
        }),
      });
    });
  }
  return spaces;
}

const entrancePlan = () => ({ id: 'e', kind: 'entrance', floor: 0, x0: -ENTRANCE_HALF, x1: ENTRANCE_HALF, z0: 9.6, z1: 20.6, y: 0, height: BASE + H + 1.2, doors: [
  { side: 'N', at: 0, to: 'h0', bottom: BASE },
  { side: 'S', at: 0, to: null, width: 3.4, spring: 3.6, front: true },
] });

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

// floor and ceiling pieces with texture coordinates in metres, so the parquet runs on seamlessly
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
export function signTexture(label, height = 192) {
  return canvasTexture(1024, height, (g, w, h) => {
    g.fillStyle = '#1d1712'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8954a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#d9bb72'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = Math.round(h * 0.4); g.font = `${size}px ${SERIF}`;
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

// the name over a doorway, on a sign above the keystone
export function nameplate(label, info, at) {
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.52), new THREE.MeshBasicMaterial({ map: signTexture(label), toneMapped: false }));
  sign.applyMatrix4(at.clone().multiply(matrix({ y: info.sign, z: -0.03, ry: Math.PI })));
  return sign;
}

// Where photos hang in a wing room, for however many it has (up to 16). The walls without a
// doorway come first: one large photo in the middle of each, then two per wall; then two beside
// each doorway; past 8, photos hang in two rows (a "salon" hang). They're numbered in the order a
// visitor coming in meets them: left wall, far wall, right wall.
const ROW = { y: PHOTO_Y, maxH: 1.85, plaqueY: 1.38 };
const LOWER = { y: 1.42, maxH: 0.95, plaqueY: 1.2 };
const UPPER = { y: 2.72, maxH: 1.05, plaqueY: 2.45 };
function roomSlots(space, frames, count) {
  const cx = (space.x0 + space.x1) / 2, cz = (space.z0 + space.z1) / 2;
  const way = space.doors[0], wayFrame = frames[way.side];
  const wayAt = new THREE.Vector3().setFromMatrixPosition(onWall(wayFrame, { x: wayFrame.u(way.at) }));
  const a0 = Math.atan2(wayAt.x - cx, wayAt.z - cz);
  const order = position => { const a = Math.atan2(position.x - cx, position.z - cz); return (((a0 - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); };

  const walls = ['N', 'S', 'E', 'W'].map(side => {
    const frame = frames[side], L = frame.length, half = L / 2, door = space.doors.some(d => d.side === side);
    const inner = doorwayHalfWidth(DOOR.width) + 0.2, outer = half - 0.35 - 0.6; // beside a doorway: clear of its frame and the corner
    const centre = new THREE.Vector3().setFromMatrixPosition(onWall(frame, {}));
    return {
      frame, door, order: order(centre),
      spots: door ? [-1, 1].map(s => ({ u: s * (inner + outer) / 2, maxW: Math.min(2.4, outer - inner - 0.44) }))
        : [-1, 1].map(s => ({ u: s * L / 4, maxW: Math.min(2.6, 2 * (half - 0.82 - L / 4)) })),
      single: door ? null : { u: 0, maxW: Math.min(3.6, L - 3.2), maxH: 1.85 }, // clear of the wood panelling
    };
  });
  const plain = walls.filter(w => !w.door).sort((a, b) => Math.abs(a.order - Math.PI) - Math.abs(b.order - Math.PI)); // the far wall first
  const doorWalls = walls.filter(w => w.door);
  const n = Math.min(count, 2 * 2 * walls.length);

  // how many photos each spot holds: 1, or 2 stacked
  const chosen = []; // { wall, spot, rows }
  if (n <= plain.length) plain.slice(0, n).forEach(wall => chosen.push({ wall, spot: wall.single, rows: [ROW], big: true }));
  else {
    const singles = [...plain.flatMap(wall => wall.spots.map(spot => ({ wall, spot }))), ...doorWalls.flatMap(wall => wall.spots.map(spot => ({ wall, spot })))];
    if (n <= singles.length) {
      // share them between the plain walls (one in the middle, or two), then beside the doorways
      const onPlain = Math.min(n, 2 * plain.length);
      plain.forEach((wall, k) => {
        const use = Math.floor(onPlain / plain.length) + (k < onPlain % plain.length ? 1 : 0);
        if (use === 1) chosen.push({ wall, spot: wall.single, rows: [ROW], big: true });
        else wall.spots.slice(0, use).forEach(spot => chosen.push({ wall, spot, rows: [ROW] }));
      });
      let left = n - onPlain;
      for (const wall of doorWalls) for (const spot of wall.spots) if (left-- > 0) chosen.push({ wall, spot, rows: [ROW] });
    } else {
      let extra = n - singles.length; // spots that take two photos, plain walls first
      for (const { wall, spot } of singles) chosen.push({ wall, spot, rows: extra-- > 0 ? [UPPER, LOWER] : [ROW] });
    }
  }

  const slots = [];
  for (const { wall, spot, rows, big } of chosen) {
    for (const row of rows) {
      const m = onWall(wall.frame, { x: spot.u, y: row.y, z: 0 });
      const position = new THREE.Vector3().setFromMatrixPosition(m);
      slots.push({
        position, rotationY: wall.frame.ry + Math.PI, maxW: spot.maxW, maxH: big ? spot.maxH : row.maxH,
        plaqueSide: -Math.sign(spot.u) || 1, plaqueY: row.plaqueY - row.y, order: order(position), row: row === UPPER ? 0 : 1, lamp: row !== LOWER,
      });
    }
  }
  // walking order round the room; in a two-row spot, the top photo first
  slots.sort((a, b) => a.order - b.order || a.row - b.row);
  return slots.slice(0, count);
}

// where the wall lights go: two on each wall of the halls, clear of the doorways (z on the east
// and west walls, x on the north and south); in the entrance, two on the left and right walls
function wallLights(space, side) {
  if (space.kind === 'hall') return side === 'E' || side === 'W' ? [-2.35, 2.35] : [-3.4, 3.4];
  if (space.kind === 'entrance' && (side === 'E' || side === 'W')) return [14.2, 17.6];
  return [];
}
// put a fitting built in a wall's frame at a place along the wall and a height above the floor
const onThisAt = (add, build, M, u, height) => build((geometry, material, local) => add(geometry, material, matrix({ x: u, y: height }).multiply(local)), M);

export function buildMuseum(exhibition, renderer, { glass } = {}) {
  const floors = exhibition.floors;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const root = new THREE.Group();
  const floorGroups = [], raycastTargets = [], decor = [];
  const walk = Array.from({ length: floors }, () => ({ rects: [], circles: [], blocks: [] }));
  const zones = Array.from({ length: floors }, () => []);
  const rooms = [];
  const edges = [];

  // materials
  const parquet = parquetTexture(anisotropy);
  const marble = marbleTexture(anisotropy);
  marble.repeat.set(1 / 1.5, 1 / 1.5);
  const M = {
    floor: new THREE.MeshPhongMaterial({ map: parquet, specular: '#3a2818', shininess: 60 }), // polished
    ceiling: new THREE.MeshLambertMaterial({ color: '#efe8db', emissive: '#6e6658' }),
    plaster: new THREE.MeshLambertMaterial({ color: '#efe8db', emissive: '#6e6658', side: THREE.DoubleSide }),
    dome: new THREE.MeshLambertMaterial({ color: '#f7eedc', emissive: '#8c7c5e', side: THREE.DoubleSide }), // lit from the hidden light round it
    cove: new THREE.MeshBasicMaterial({ color: '#ffe7b8' }),
    lunette: new THREE.MeshLambertMaterial({ color: '#ebe3d4', emissive: '#5a5448' }),
    carpet: new THREE.MeshLambertMaterial({ color: '#1d2847', emissive: '#04060d' }), // deep navy, to stand out from the red walls
    stone: new THREE.MeshLambertMaterial({ color: '#e9e1d0' }),
    marble: new THREE.MeshLambertMaterial({ map: marble }),
    skirting: new THREE.MeshLambertMaterial({ color: '#3a2c22' }),
    laylight: glass || new THREE.MeshBasicMaterial({ color: '#dfe8ee', side: THREE.DoubleSide }), // roof glass, showing the sky
    glazing: new THREE.MeshLambertMaterial({ color: '#f1ede4', emissive: '#5a564e' }), // the white-painted bars of the court roofs
    lead: new THREE.MeshLambertMaterial({ color: '#8c867c', emissive: '#3a3630' }),
    wood: new THREE.MeshLambertMaterial({ color: '#3b2a1f' }),
    velvet: new THREE.MeshLambertMaterial({ color: '#6b1f24' }),
    door: new THREE.MeshLambertMaterial({ color: '#4a3020', emissive: '#120a05' }),
    gilt: new THREE.MeshLambertMaterial({ color: '#c49a48', emissive: '#3a2808' }),
    glass: new THREE.MeshBasicMaterial({ color: '#f1e2c0' }),
    brass: new THREE.MeshLambertMaterial({ color: '#a8823a', emissive: '#2a1c06' }),
  };
  parquet.anisotropy = anisotropy;
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

  const ENTRANCE = entrancePlan();
  let entranceDoorTop = BASE + 4.5;
  const spaces = [];
  for (let f = 0; f < floors; f++) spaces.push(...planFloor(f));
  spaces.push(ENTRANCE);

  for (let f = 0; f < floors; f++) { const group = new THREE.Group(); group.name = `floor ${f + 1}`; floorGroups.push(group); root.add(group); }
  const batches = floorGroups.map(() => new Batch());
  // the glass vaults of the halls below the top floor rise into the floor above: kept apart, and
  // drawn only while the visitor is below that floor
  const roofs = floorGroups.map(() => new Batch()), roofGroups = [];

  for (const space of spaces) {
    const f = space.floor, batch = batches[f], group = floorGroups[f];
    const { x0, x1, z0, z1, y } = space, height = space.height || H;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const room = space.kind === 'room' ? exhibition.rooms[space.index] : null;
    // blue rooms on the right, green on the left, each with one of the three patterns; red halls
    const paper = room ? wallpaper(WING_COLORS[space.wing], space.order % 3) : wallpaper(HALL_COLOR, 2);

    // floor, and a ceiling: all glass in the halls and the entrance (the vault running towards the stairs), a moulded one in the rooms
    batch.add(flat(x0 - T / 2, x1 + T / 2, z0 - T / 2, z1 + T / 2, PARQUET_TILE), M.floor, matrix({ y }), { kind: 'floor', floor: f });
    // a hall with another floor above it has a plaster groin vault, a coffered dome at the top of each bay, and a large chandelier hanging from each dome; only
    // the top floor's hall (and the entrance, with nothing above it) is roofed in glass
    const glassRoof = space.kind === 'entrance' || (space.kind === 'hall' && f === floors - 1);
    const plasterVault = space.kind === 'hall' && !glassRoof;
    const bayCentres = ceiling(batch, M, { x0, x1, z0, z1, y, height, skylight: glassRoof, arched: plasterVault, roof: batch, alongZ: glassRoof || plasterVault ? true : undefined });

    if (space.kind === 'room') chandelier((geometry, material, local) => batch.add(geometry, material, matrix({ x: cx, y: y + height, z: cz }).multiply(local)), M);
    if (plasterVault) for (const c of bayCentres) { // half as big again, on a short chain, at the crown of each bay
      chandelier((geometry, material, local) => batch.add(geometry, material, matrix({ x: c.x, y: c.y, z: c.z, sx: 1.6, sy: 1.6, sz: 1.6 }).multiply(local)), M, { chain: 0.8 + DOME.rise / 1.6 });
    }
    const frames = {};
    for (const side of ['N', 'S', 'E', 'W']) {
      const frame = frames[side] = wallFrame(space, side);
      frame.ry = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 }[side];
      const ext = side === 'N' || side === 'S' ? T / 2 : 0; // north and south walls cover the corners
      const doors = space.doors.filter(d => d.side === side).map(d => ({ ...d, u: frame.u(d.at), width: d.width || DOOR.width, spring: d.spring || DOOR.spring, bottom: d.bottom || 0 }));
      batch.add(extrude(wallShape(frame.length / 2 + ext, height, doors), T / 2), [paper, M.stone], frame.m, { kind: 'wall', floor: f });

      // cornice and skirting
      if (!plasterVault) batch.add(new THREE.BoxGeometry(frame.length, 0.28, 0.14), M.stone, onWall(frame, { y: height - 0.14, z: -0.07 }));
      const gaps = doors.filter(d => !d.bottom).map(d => [d.u - d.width / 2 - 0.2, d.u + d.width / 2 + 0.2]).sort((a, b) => a[0] - b[0]);
      let from = -frame.length / 2;
      for (const [a, b] of [...gaps, [frame.length / 2, frame.length / 2]]) {
        if (a - from > 0.05) batch.add(new THREE.BoxGeometry(a - from, 0.22, 0.05), M.skirting, onWall(frame, { x: (a + from) / 2, y: 0.11, z: -0.025 }));
        from = b;
      }
      const onThis = (geometry, material, local) => batch.add(geometry, material, onWall(frame, {}).multiply(local));
      // rooms: dark wood panelling below the photos
      if (space.kind === 'room') wainscot(onThis, frame.length, doors.map(d => [d.u - doorwayHalfWidth(d.width) - 0.08, d.u + doorwayHalfWidth(d.width) + 0.08]));
      // the halls and the entrance: brass wall lights, between the doorways
      for (const at of wallLights(space, side)) onThisAt(onThis, sconce, M, frame.u(at), 2.6);

      for (const d of doors) {
        // a classical stone frame round the doorway, and the name of where it leads
        const at = onWall(frame, { x: d.u, y: d.bottom });
        const add = (geometry, material, local) => batch.add(geometry, material, at.clone().multiply(local));
        if (d.front) { frontDoors(add, M, d.width, d.spring); continue; }
        const frameInfo = doorway(add, M, d.width, d.spring);
        if (space.kind === 'entrance') entranceDoorTop = d.bottom + frameInfo.top; // the exhibition title goes above
        else group.add(nameplate(signLabel(d.to), frameInfo, at));
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
        floor: f, group, slotsFor: count => roomSlots(space, frames, count), name: room.name,
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
  title.position.set(0, entranceDoorTop + 0.75, ENTRANCE.z0 + 0.03);
  g0.add(title);
  walk[0].rects.push([ENTRANCE.x0 + MARGIN, ENTRANCE.x1 - MARGIN, ENTRANCE.z0 + MARGIN, ENTRANCE.z1 - MARGIN]);

  // ── decoration: sculptures and plants (placed later by decor.js; their spots block walking now) ──
  const place = (f, type, x, z, ry = 0, radius = 0.5) => {
    decor.push({ group: floorGroups[f], type, x, y: f < 0 ? 0 : floorY(f), z, ry });
    walk[Math.max(f, 0)].circles.push([x, z, radius]);
  };
  // the halls: a plant in each corner and a large flower arrangement in the middle
  for (let f = 0; f < floors; f++) {
    const cx = HALL_HALF - 1.0;
    for (const [x, z] of [[-cx, -8.2], [cx, -8.2], [-cx, 8.2], [cx, 8.2]]) place(f, 'ficus', x, z, 0, 0.75);
    place(f, f === 1 ? 'bouquet' : 'flowers', 0, 0, 0, 1.0); // floor 2 has a bouquet in a glass vase
  }
  // the entrance belongs to the ground floor's group, at street level: busts beside the steps,
  // and plants by the front doors
  const placeEntrance = (type, x, z, ry = 0, radius = 0.5) => { decor.push({ group: g0, type, x, y: 0, z, ry }); walk[0].circles.push([x, z, radius]); };
  const ex = ENTRANCE_HALF - 1.0;
  placeEntrance('bust', -ex, 12.4, Math.PI / 2, 0.55); placeEntrance('bust', ex, 12.4, -Math.PI / 2, 0.55);
  for (const [type, x, z] of entrancePlants(ex, ENTRANCE.z1)) placeEntrance(type, x, z, 0, 0.75);

  for (let f = 0; f < floors; f++) {
    batches[f].build(floorGroups[f], raycastTargets);
    const roof = new THREE.Group(); roof.name = `hall roof ${f + 1}`;
    roofs[f].build(roof, null); floorGroups[f].add(roof); roofGroups.push(roof);
  }

  // ── stairs: the oval entrance steps and the spiral stairwell ──
  const stairs = buildStairs({ floors, root, M, raycastTargets, entranceGroup: g0, decor, paper: wallpaper(HALL_COLOR, 2), entrance: ENTRANCE });
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
    start: { floor: 0, x: 0, z: ENTRANCE.z1 - 1.6, yaw: 0 },
    hallStart: f => ({ floor: f, x: 0, z: -6.6, yaw: Math.PI }),
    showFloors(list) { floorGroups.forEach((g, f) => { g.visible = list.includes(f); }); },
    updateRoofs(eyeY) { roofGroups.forEach((g, f) => { g.visible = f === floors - 1 || eyeY < floorY(f + 1); }); },
    dispose() {
      for (const texture of [parquet, marble]) texture.dispose();
      for (const m of wallpapers.values()) { m.map.dispose(); m.dispose(); }
      for (const m of Object.values(M)) if (!m.userData.shared) m.dispose();
    },
  };
}
