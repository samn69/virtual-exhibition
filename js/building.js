// The museum itself: a row of classical rooms joined by arched doorways (an enfilade),
// with marble floors, skylights, mouldings and benches. Everything is drawn in code,
// so there are no model files to download.
import * as THREE from 'three';

export const ROOM = { width: 15.6, depth: 10, height: 5.5, wall: 0.4, doorWidth: 2.4, doorSpring: 2.6 };
export const SPACING = ROOM.width + ROOM.wall; // 16 m from one room's centre to the next
const MARGIN = 0.45; // how close a visitor can get to a wall
export const EYE_HEIGHT = 1.65;
export const PHOTO_CENTER_Y = 1.85;

// classic gallery wall colours: Pompeian red, green, blue, ochre, plum…
export const WALL_COLORS = ['#7a2a2c', '#35523f', '#2c3b57', '#8c6331', '#583049', '#6a3526', '#40525c', '#5e4a24', '#38483a', '#52283a'];

export const roomCenterX = i => i * SPACING;

// small seeded random generator, so the marble looks the same on every visit
export function seeded(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function marbleTexture(renderer) {
  const texture = canvasTexture(1024, 1024, (g, size) => {
    const tile = size / 2, random = seeded(7);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const light = (tx + ty) % 2 === 0;
      g.save();
      g.beginPath(); g.rect(tx * tile, ty * tile, tile, tile); g.clip();
      g.fillStyle = light ? '#e8e1d3' : '#8f887d';
      g.fillRect(tx * tile, ty * tile, tile, tile);
      for (let k = 0; k < 40; k++) { // soft clouds in the stone
        const x = tx * tile + random() * tile, y = ty * tile + random() * tile, r = 20 + random() * 90;
        const cloud = g.createRadialGradient(x, y, 0, x, y, r);
        cloud.addColorStop(0, light ? 'rgba(150,138,120,0.07)' : 'rgba(225,218,205,0.07)');
        cloud.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = cloud; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let k = 0; k < 8; k++) { // veins
        let x = tx * tile + random() * tile, y = ty * tile + random() * tile;
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 9; s++) { x += (random() - 0.3) * 70; y += (random() - 0.5) * 70; g.lineTo(x, y); }
        g.strokeStyle = light ? `rgba(105,95,82,${0.08 + random() * 0.14})` : `rgba(232,226,214,${0.08 + random() * 0.14})`;
        g.lineWidth = 0.6 + random() * 2.2; g.stroke();
      }
      g.restore();
    }
    g.strokeStyle = 'rgba(55,45,35,0.4)'; g.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * tile, 0); g.lineTo(i * tile, size); g.moveTo(0, i * tile); g.lineTo(size, i * tile); g.stroke();
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

// end wall of a room, seen from inside; with a door it has an arched opening in the middle
function endWallShape(door) {
  const { depth: D, height: H, doorWidth: dw, doorSpring: dh } = ROOM;
  const shape = new THREE.Shape();
  shape.moveTo(-D / 2, 0);
  if (door) {
    shape.lineTo(-dw / 2, 0);
    shape.lineTo(-dw / 2, dh);
    shape.absarc(0, dh, dw / 2, Math.PI, 0, true);
    shape.lineTo(dw / 2, 0);
  }
  shape.lineTo(D / 2, 0); shape.lineTo(D / 2, H); shape.lineTo(-D / 2, H); shape.closePath();
  return shape;
}
// the stone frame around a doorway
function archTrimShape() {
  const { doorWidth: dw, doorSpring: dh } = ROOM, outer = dw / 2 + 0.2, inner = dw / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-outer, 0); shape.lineTo(-outer, dh);
  shape.absarc(0, dh, outer, Math.PI, 0, true);
  shape.lineTo(outer, 0); shape.lineTo(inner, 0); shape.lineTo(inner, dh);
  shape.absarc(0, dh, inner, 0, Math.PI, false);
  shape.lineTo(-inner, 0); shape.closePath();
  return shape;
}

const SERIF = 'Georgia, "Times New Roman", serif';

function signTexture(label) {
  return canvasTexture(1024, 192, (g, w, h) => {
    g.fillStyle = '#1d1712'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8954a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#d9bb72'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 78; g.font = `${size}px ${SERIF}`;
    while (g.measureText(label).width > w - 80 && size > 30) { size -= 4; g.font = `${size}px ${SERIF}`; }
    g.fillText(label, w / 2, h / 2 + 4);
  });
}

function titleTexture(title, subtitle) {
  return canvasTexture(1600, 650, (g, w, h) => {
    g.fillStyle = '#1d1712'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8954a'; g.lineWidth = 10; g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 3; g.strokeRect(42, 42, w - 84, h - 84);
    g.fillStyle = '#e2c47c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 150; g.font = `${size}px ${SERIF}`;
    while (g.measureText(title).width > w - 160 && size > 50) { size -= 6; g.font = `${size}px ${SERIF}`; }
    g.fillText(title, w / 2, subtitle ? h * 0.42 : h / 2);
    if (subtitle) {
      g.fillStyle = '#cdb98c'; size = 60; g.font = `italic ${size}px ${SERIF}`;
      while (g.measureText(subtitle).width > w - 160 && size > 26) { size -= 4; g.font = `italic ${size}px ${SERIF}`; }
      g.fillText(subtitle, w / 2, h * 0.7);
    }
  });
}

/**
 * Builds every room of the exhibition.
 * Returns the scene root, the photo slots of each room, collision helpers and where to start.
 */
export function buildMuseum(exhibition, renderer) {
  const { width: W, depth: D, height: H, wall: T, doorWidth: dw } = ROOM;
  const root = new THREE.Group();
  const raycastTargets = [];
  const rooms = [];
  const walkRects = [], obstacles = [];
  const count = exhibition.rooms.length;

  const marble = marbleTexture(renderer);
  const floorMaterial = new THREE.MeshLambertMaterial({ map: marble });
  marble.repeat.set(SPACING / 2, (D + 2 * T) / 2);
  const ceilingMaterial = new THREE.MeshLambertMaterial({ color: '#efe8db', emissive: '#6e6658' });
  const stoneMaterial = new THREE.MeshLambertMaterial({ color: '#ebe3d2' });
  const baseMaterial = new THREE.MeshLambertMaterial({ color: '#3a322c' });
  const skyMaterial = new THREE.MeshBasicMaterial({ color: '#f3f6fa' });
  const leadMaterial = new THREE.MeshLambertMaterial({ color: '#8c867c', emissive: '#3a3630' });
  const woodMaterial = new THREE.MeshLambertMaterial({ color: '#3b2a1f' });
  const cushionMaterial = new THREE.MeshLambertMaterial({ color: '#6b1f24' });

  const floorGeometry = new THREE.PlaneGeometry(SPACING, D + 2 * T);
  const ceilingGeometry = new THREE.PlaneGeometry(SPACING, D + 2 * T);
  const longWallGeometry = new THREE.BoxGeometry(W + T, H, T);
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  const doorWallGeometry = extrude(endWallShape(true), T / 2);
  const plainWallGeometry = extrude(endWallShape(false), T / 2);
  const trimGeometry = extrude(archTrimShape(), 0.05);

  const add = (parent, geometry, material, x, y, z, target) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    if (target) { mesh.userData.kind = target; raycastTargets.push(mesh); }
    return mesh;
  };

  exhibition.rooms.forEach((room, i) => {
    const cx = roomCenterX(i), xw = cx - W / 2, xe = cx + W / 2;
    const group = new THREE.Group();
    root.add(group);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: room.color });
    const hasWest = i > 0, hasEast = i < count - 1;

    const floor = add(group, floorGeometry, floorMaterial, cx, 0, 0, 'floor');
    floor.rotation.x = -Math.PI / 2;
    const ceiling = add(group, ceilingGeometry, ceilingMaterial, cx, H, 0);
    ceiling.rotation.x = Math.PI / 2;

    // skylight with lead glazing bars
    const sky = add(group, new THREE.PlaneGeometry(7, 3.6), skyMaterial, cx, H - 0.02, 0);
    sky.rotation.x = Math.PI / 2;
    for (const x of [-1.75, 0, 1.75]) add(group, new THREE.BoxGeometry(0.06, 0.04, 3.6), leadMaterial, cx + x, H - 0.04, 0);
    add(group, new THREE.BoxGeometry(7, 0.04, 0.06), leadMaterial, cx, H - 0.04, 0);
    for (const z of [-1.9, 1.9]) add(group, new THREE.BoxGeometry(7.4, 0.25, 0.2), stoneMaterial, cx, H - 0.12, z);
    for (const x of [-3.6, 3.6]) add(group, new THREE.BoxGeometry(0.2, 0.25, 4), stoneMaterial, cx + x, H - 0.12, 0);

    // long walls (north and south) and end walls (west and east, arched when there is a next room)
    for (const z of [-(D / 2 + T / 2), D / 2 + T / 2]) add(group, longWallGeometry, wallMaterial, cx, H / 2, z, 'wall');
    const west = add(group, hasWest ? doorWallGeometry : plainWallGeometry, wallMaterial, xw, 0, 0, 'wall');
    west.rotation.y = -Math.PI / 2; // extrudes from xw towards -x
    west.position.x = xw;
    const east = add(group, hasEast ? doorWallGeometry : plainWallGeometry, wallMaterial, xe + T / 2, 0, 0, 'wall');
    east.rotation.y = -Math.PI / 2;
    if (hasWest) { const trim = add(group, trimGeometry, stoneMaterial, xw, 0, 0); trim.rotation.y = Math.PI / 2; }
    if (hasEast) { const trim = add(group, trimGeometry, stoneMaterial, xe, 0, 0); trim.rotation.y = -Math.PI / 2; }

    // cornice and skirting
    for (const z of [-D / 2 + 0.07, D / 2 - 0.07]) {
      add(group, new THREE.BoxGeometry(W, 0.28, 0.14), stoneMaterial, cx, H - 0.14, z);
      add(group, new THREE.BoxGeometry(W, 0.22, 0.05), baseMaterial, cx, 0.11, z);
    }
    for (const [x, door] of [[xw + 0.07, hasWest], [xe - 0.07, hasEast]]) {
      add(group, new THREE.BoxGeometry(0.14, 0.28, D), stoneMaterial, x, H - 0.14, 0);
      if (door) {
        const piece = (D - dw - 0.4) / 2;
        for (const s of [-1, 1]) add(group, new THREE.BoxGeometry(0.05, 0.22, piece), baseMaterial, x, 0.11, s * (D / 2 - piece / 2));
      } else add(group, new THREE.BoxGeometry(0.05, 0.22, D), baseMaterial, x, 0.11, 0);
    }

    // signs above the doorways: where the door leads
    const signY = ROOM.doorSpring + dw / 2 + 0.75;
    if (hasEast) {
      const sign = add(group, new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(`${exhibition.rooms[i + 1].name}  →`), toneMapped: false }), xe - 0.02, signY, 0);
      sign.rotation.y = -Math.PI / 2;
    }
    if (hasWest) {
      const sign = add(group, new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: signTexture(`←  ${exhibition.rooms[i - 1].name}`), toneMapped: false }), xw + 0.02, signY, 0);
      sign.rotation.y = Math.PI / 2;
    }
    if (i === 0) { // the exhibition title greets visitors on the first wall
      const title = add(group, new THREE.PlaneGeometry(6.4, 2.6), new THREE.MeshBasicMaterial({ map: titleTexture(exhibition.title, exhibition.subtitle), toneMapped: false }), xw + 0.03, 2.75, 0);
      title.rotation.y = Math.PI / 2;
    }

    // two benches facing the long walls, leaving the middle free to walk through
    for (const z of [-1.8, 1.8]) {
      add(group, new THREE.BoxGeometry(2.6, 0.38, 0.62), woodMaterial, cx, 0.19, z, 'bench');
      add(group, new THREE.BoxGeometry(2.5, 0.08, 0.56), cushionMaterial, cx, 0.42, z);
      obstacles.push([cx - 1.6, cx + 1.6, z - 0.61, z + 0.61]);
    }

    walkRects.push([xw + MARGIN, xe - MARGIN, -D / 2 + MARGIN, D / 2 - MARGIN]);
    if (hasEast) walkRects.push([xe - MARGIN - 0.05, xe + T + MARGIN + 0.05, -dw / 2 + 0.35, dw / 2 - 0.35]);

    // where photos hang: wall centre, facing direction and the positions along it
    const north = { origin: new THREE.Vector3(cx, 0, -D / 2), normal: new THREE.Vector3(0, 0, 1), us: [-5.7, -1.9, 1.9, 5.7], maxW: 2.6 };
    const south = { origin: new THREE.Vector3(cx, 0, D / 2), normal: new THREE.Vector3(0, 0, -1), us: [-5.7, -1.9, 1.9, 5.7], maxW: 2.6 };
    const eastWall = { origin: new THREE.Vector3(xe, 0, 0), normal: new THREE.Vector3(-1, 0, 0), us: hasEast ? [-3.1, 3.1] : [-2.4, 2.4], maxW: hasEast ? 2.0 : 2.4, door: hasEast };
    const westWall = { origin: new THREE.Vector3(xw, 0, 0), normal: new THREE.Vector3(1, 0, 0), us: i === 0 ? [] : hasWest ? [-3.1, 3.1] : [-2.4, 2.4], maxW: hasWest ? 2.0 : 2.4, door: hasWest };
    // the order photos fill a room in, so a few photos still look balanced
    const order = [[north, 1], [north, 2], [south, 1], [south, 2], [north, 0], [north, 3], [south, 0], [south, 3], [eastWall, 0], [eastWall, 1], [westWall, 0], [westWall, 1]];
    const slots = order.filter(([wall, k]) => k < wall.us.length).map(([wall, k]) => {
      const right = new THREE.Vector3().crossVectors(wall.normal.clone().negate(), new THREE.Vector3(0, 1, 0));
      const u = wall.us[k];
      return {
        position: wall.origin.clone().addScaledVector(right, u).setY(PHOTO_CENTER_Y),
        rotationY: Math.atan2(wall.normal.x, wall.normal.z),
        maxW: wall.maxW, maxH: 1.85,
        plaqueSide: wall.door ? Math.sign(u) : 1, // away from the doorway
      };
    });
    rooms.push({ name: room.name, group, slots, cx });
  });

  const inside = (r, x, z) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
  return {
    root, rooms, raycastTargets,
    walkable: (x, z) => walkRects.some(r => inside(r, x, z)) && !obstacles.some(r => inside(r, x, z)),
    roomAt: x => Math.max(0, Math.min(count - 1, Math.round(x / SPACING))),
    start: { x: roomCenterX(0) - W / 2 + 5, z: 0, yaw: Math.PI / 2 },
    entrance: i => ({ x: roomCenterX(i) - W / 2 + 1.6, z: 0, yaw: -Math.PI / 2 }),
    // only rooms near the visitor are drawn; through the doorways you can see about two rooms ahead
    showAround(index) { rooms.forEach((room, i) => { room.group.visible = Math.abs(i - index) <= 2; }); },
  };
}
