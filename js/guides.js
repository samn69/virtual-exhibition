// The gallery guide: a framed board in the entrance, beside the archway up to the hall, listing
// every floor and its rooms so visitors know where the pictures are.
// Tapping it starts the guided tour.
// The text comes from the exhibition (room names, number of floors), so it stays right when
// rooms are renamed.
import * as THREE from 'three';
import { canvasTexture } from './textures.js';
import { ROOMS_PER_FLOOR } from './constants.js';

const SERIF = 'Georgia, "Times New Roman", serif';
const INK = '#d9bb72', SOFT = '#cdb98c', DIM = '#a8987a', BG = '#1d1712', LINE = '#b8954a';
const PX = 900; // canvas pixels per metre of sign

// visiting order: the right wing is rooms 1–4 of a floor, the left wing 5–8
const wing = (f, side) => { const a = f * ROOMS_PER_FLOOR + (side === 'R' ? 0 : 4); return [a, a + 3]; };
const roomRange = ([a, b]) => `Rooms ${a + 1}–${b + 1}`;
const shortName = name => String(name || '').replace(/^\s*room\s*\d+\s*[·:\-–—|]\s*/i, '').trim();

// fit text to a width by shrinking it
function fit(g, text, max, size, style = '') {
  g.font = `${style} ${size}px ${SERIF}`;
  while (g.measureText(text).width > max && size > 14) { size -= 2; g.font = `${style} ${size}px ${SERIF}`; }
  return size;
}
// wrap a list of words ("A · B · C") over lines no wider than max
function wrap(g, parts, max) {
  const lines = [];
  let line = '';
  for (const part of parts) {
    const next = line ? `${line} · ${part}` : part;
    if (line && g.measureText(next).width > max) { lines.push(line); line = part; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
function frame(g, w, h, double = true) {
  g.fillStyle = BG; g.fillRect(0, 0, w, h);
  g.strokeStyle = LINE; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24);
  if (double) { g.lineWidth = 2; g.strokeRect(28, 28, w - 56, h - 56); }
}
const signMaterial = map => new THREE.MeshBasicMaterial({ map, toneMapped: false });

// ── the entrance's gallery guide ──
function directoryTexture(exhibition, floors, width, height) {
  return canvasTexture(Math.round(width * PX), Math.round(height * PX), (g, W, H) => {
    // laid out for a board 1 m wide; a bigger board gets bigger lettering
    const k = W / PX, w = PX, h = H / k;
    g.scale(k, k);
    frame(g, w, h);
    const pad = 70, max = w - pad * 2;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    let y = 128;
    g.fillStyle = INK; fit(g, 'Gallery Guide', max, 78); g.fillText('Gallery Guide', w / 2, y);
    y += 52; g.fillStyle = SOFT; fit(g, 'Up the steps to the Central Hall', max, 34, 'italic'); g.fillText('Up the steps to the Central Hall', w / 2, y);
    y += 30; g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2 - 120, y); g.lineTo(w / 2 + 120, y); g.stroke();
    // shrink everything below if there are many floors
    const scale = Math.min(1.45, (h - y - 200) / (floors * 290));
    const names = range => exhibition.rooms.slice(range[0], range[1] + 1).map(r => shortName(r.name)).filter(Boolean);
    for (let f = 0; f < floors; f++) {
      y += 70 * scale;
      g.textAlign = 'left'; g.fillStyle = INK; g.font = `${Math.round(46 * scale)}px ${SERIF}`;
      g.fillText(`Floor ${f + 1}`, pad, y);
      const after = pad + g.measureText(`Floor ${f + 1}`).width;
      const where = f === 0 ? 'the Central Hall' : 'up the stairs behind the hall';
      g.fillStyle = DIM; g.font = `italic ${Math.round(28 * scale)}px ${SERIF}`;
      g.fillText(`  ·  ${where}`, after, y);
      for (const [side, label] of [['R', 'right'], ['L', 'left']]) {
        const range = wing(f, side);
        y += 52 * scale;
        g.fillStyle = SOFT; g.font = `${Math.round(34 * scale)}px ${SERIF}`;
        const arrow = side === 'R' ? '→' : '←';
        g.fillText(`${arrow}  ${roomRange(range)}  ·  ${label} wing`, pad + 20, y);
        g.fillStyle = DIM; g.font = `italic ${Math.round(26 * scale)}px ${SERIF}`;
        for (const line of wrap(g, names(range), max - 70)) { y += 36 * scale; g.fillText(line, pad + 70, y); }
      }
      y += 14 * scale;
    }
    g.textAlign = 'center'; g.fillStyle = INK; fit(g, '▶  Tap this board for a guided tour', max, 36);
    g.fillText('▶  Tap this board for a guided tour', w / 2, h - 122);
    g.fillStyle = DIM; fit(g, 'Tap the floor to walk  ·  Tap a photo to see it closer', max, 28, 'italic');
    g.fillText('Tap the floor to walk  ·  Tap a photo to see it closer', w / 2, h - 62);
  });
}

function wallBoard(group, M, { x, y, z, ry, width, height, map }) {
  const board = new THREE.Group();
  board.position.set(x, y, z); board.rotation.y = ry;
  board.add(new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, height + 0.14, 0.06), M.gilt).translateZ(0.03));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), signMaterial(map));
  face.position.z = 0.065;
  board.add(face);
  group.add(board);
  return face;
}

// next to the archway up to the Central Hall, the way every visitor goes
export function buildGuides({ exhibition, floors, floorGroups, entrance, M }) {
  const width = 1.5, height = floors > 2 ? 2.15 : 2.0;
  const map = directoryTexture(exhibition, floors, width, height);
  const face = wallBoard(floorGroups[0], M, { x: -2.8, y: 2.45, z: entrance.z0 + 0.005, ry: 0, width, height, map });
  face.userData = { kind: 'tour', floor: 0 }; // tapping the board starts the guided tour
  return [face];
}
