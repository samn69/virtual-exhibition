// Surfaces drawn in code: the oak floor, the wallpapers, marble, and plant leaves.
import * as THREE from 'three';

// small seeded random generator, so the patterns look the same on every visit
export function seeded(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTexture(width, height, draw, { repeat = false, anisotropy = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ── light oak strip floor, like the photo: whitewashed oak, narrow planks of varying length ──
export const OAK_TILE = 2.16; // metres covered by one texture
export function oakTexture(anisotropy) {
  return canvasTexture(2048, 2048, (g, size) => {
    const random = seeded(31);
    const rows = 24, rowH = size / rows; // planks about 9 cm wide
    const px = size / OAK_TILE;           // pixels per metre
    for (let row = 0; row < rows; row++) {
      const y = row * rowH;
      // plank lengths 40–95 cm, filling the row exactly so the texture repeats seamlessly
      const lengths = [];
      let total = 0;
      while (total < size) { const l = (0.4 + random() * 0.55) * px; lengths.push(l); total += l; }
      lengths[lengths.length - 1] -= total - size;
      if (lengths[lengths.length - 1] < 0.3 * px) { const short = lengths.pop(); lengths[lengths.length - 1] += short; }
      let x = random() * size;
      for (const length of lengths) {
        for (const shift of [0, -size]) drawPlank(g, x + shift, y, length, rowH, random, size);
        x += length;
      }
    }
  }, { repeat: true, anisotropy });
}
function drawPlank(g, x, y, w, h, random, size) {
  if (x > size || x + w < 0) return;
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  const light = 78 + random() * 6, sat = 18 + random() * 10, hue = 30 + random() * 6;
  g.fillStyle = `hsl(${hue},${sat}%,${light}%)`;
  g.fillRect(x, y, w, h);
  // long grain lines
  const lines = 18 + Math.floor(random() * 16);
  for (let i = 0; i < lines; i++) {
    const gy = y + random() * h, amp = random() * 2.5, freq = 0.004 + random() * 0.01, phase = random() * 6;
    g.beginPath();
    for (let gx = x; gx <= x + w; gx += 12) g.lineTo(gx, gy + Math.sin(gx * freq + phase) * amp);
    g.strokeStyle = `hsla(${hue - 4},${sat + 25}%,${light - 28 - random() * 14}%,${0.12 + random() * 0.25})`;
    g.lineWidth = 0.6 + random() * 1.4;
    g.stroke();
  }
  // cathedral arches on some planks
  if (random() < 0.55) {
    const cx = x + w * (0.25 + random() * 0.5), cy = y + h * (0.3 + random() * 0.4), n = 3 + Math.floor(random() * 4);
    for (let i = 1; i <= n; i++) {
      const rx = w * (0.08 + i * 0.06), ry = h * (0.12 + i * 0.07);
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.55, Math.PI * 1.45, false);
      g.strokeStyle = `hsla(${hue - 6},${sat + 30}%,${light - 32}%,${0.18 + random() * 0.2})`;
      g.lineWidth = 0.8 + random() * 1.2;
      g.stroke();
    }
  }
  // pores
  for (let i = 0; i < w * h / 900; i++) {
    g.fillStyle = `hsla(${hue},40%,${light - 35}%,0.25)`;
    g.fillRect(x + random() * w, y + random() * h, 2 + random() * 6, 0.8);
  }
  // joints
  g.strokeStyle = 'rgba(95,75,55,0.45)'; g.lineWidth = 1.4;
  g.strokeRect(x + 0.7, y + 0.7, w - 1.4, h - 1.4);
  g.restore();
}

// ── wallpaper: small shapes, widely spaced, in a soft golden tone of the wall colour ──
export const WALLPAPER_TILE = 0.44; // metres; shapes 22 cm apart, about 4.5 cm tall
function fleur(g) {
  g.beginPath();
  g.moveTo(0, -0.5);
  g.bezierCurveTo(0.17, -0.3, 0.15, -0.08, 0.05, 0.08);
  g.lineTo(-0.05, 0.08);
  g.bezierCurveTo(-0.15, -0.08, -0.17, -0.3, 0, -0.5);
  for (const s of [1, -1]) {
    g.moveTo(0.06 * s, 0.06);
    g.bezierCurveTo(0.12 * s, -0.24, 0.46 * s, -0.3, 0.44 * s, -0.05);
    g.bezierCurveTo(0.43 * s, 0.08, 0.3 * s, 0.1, 0.29 * s, 0.0);
    g.bezierCurveTo(0.26 * s, 0.1, 0.16 * s, 0.12, 0.06 * s, 0.1);
    g.closePath();
  }
  g.rect(-0.22, 0.08, 0.44, 0.07);
  g.moveTo(-0.05, 0.15);
  g.bezierCurveTo(-0.07, 0.3, -0.16, 0.38, -0.2, 0.48);
  g.lineTo(0.2, 0.48);
  g.bezierCurveTo(0.16, 0.38, 0.07, 0.3, 0.05, 0.15);
  g.closePath();
  g.fill();
}
function diamond(g) { g.beginPath(); g.moveTo(0, -0.5); g.lineTo(0.3, 0); g.lineTo(0, 0.5); g.lineTo(-0.3, 0); g.closePath(); g.fill(); }
function dot(g) { g.beginPath(); g.arc(0, 0, 0.12, 0, Math.PI * 2); g.fill(); }
// the three patterns you picked: 1 fleur-de-lis, 2 small diamonds, 6 lily and dot
export const WALLPAPERS = [
  (g, odd) => fleur(g),
  (g, odd) => diamond(g),
  (g, odd) => (odd ? dot(g) : fleur(g)),
];
function patternInk(base) {
  const c = new THREE.Color(base), gold = new THREE.Color('#d6ba78');
  return '#' + c.clone().lerp(gold, 0.32).getHexString();
}
export function wallpaperTexture(base, pattern, anisotropy) {
  return canvasTexture(512, 512, (g, size) => {
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    // faint paper texture
    const random = seeded(base.length * 7 + pattern);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)';
      g.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3);
    }
    g.fillStyle = patternInk(base);
    const step = size / 2, motif = size * (0.045 / WALLPAPER_TILE);
    for (let row = -1; row <= 4; row++) {
      for (let col = -1; col <= 2; col++) {
        g.save();
        g.translate(col * step + (row % 2 ? step / 2 : 0) + step / 4, row * step / 2 + step / 4);
        g.scale(motif, motif);
        WALLPAPERS[pattern](g, Math.abs(row % 2) === 1);
        g.restore();
      }
    }
  }, { repeat: true, anisotropy });
}

// ── light marble for the steps and pedestals ──
export function marbleTexture(anisotropy) {
  return canvasTexture(512, 512, (g, size) => {
    const random = seeded(11);
    g.fillStyle = '#ebe5da'; g.fillRect(0, 0, size, size);
    for (let k = 0; k < 60; k++) {
      const x = random() * size, y = random() * size, r = 20 + random() * 80;
      const cloud = g.createRadialGradient(x, y, 0, x, y, r);
      cloud.addColorStop(0, 'rgba(160,148,130,0.06)'); cloud.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = cloud; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let k = 0; k < 10; k++) {
      let x = random() * size, y = random() * size;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 10; s++) { x += (random() - 0.3) * 60; y += (random() - 0.5) * 60; g.lineTo(x, y); }
      g.strokeStyle = `rgba(120,108,95,${0.08 + random() * 0.12})`; g.lineWidth = 0.6 + random() * 1.8; g.stroke();
    }
  }, { repeat: true, anisotropy });
}

// ── leaves, drawn with transparent edges and cut-outs ──
export function leafTexture(kind) {
  const random = seeded({ monstera: 3, bird: 5, snake: 9 }[kind]);
  return canvasTexture(256, 512, (g, w, h) => {
    if (kind === 'snake') {
      g.beginPath(); g.moveTo(w * 0.15, h); g.quadraticCurveTo(w * 0.05, h * 0.4, w / 2, 0); g.quadraticCurveTo(w * 0.95, h * 0.4, w * 0.85, h); g.closePath();
      g.save(); g.clip();
      g.fillStyle = '#d6c95e'; g.fillRect(0, 0, w, h); // yellow edge
      g.beginPath(); g.moveTo(w * 0.24, h); g.quadraticCurveTo(w * 0.16, h * 0.42, w / 2, h * 0.04); g.quadraticCurveTo(w * 0.84, h * 0.42, w * 0.76, h); g.closePath();
      g.fillStyle = '#2d5228'; g.fill();
      for (let y = 10; y < h; y += 14 + random() * 10) { // wavy bands
        g.beginPath();
        for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.08 + y) * 4);
        g.strokeStyle = 'rgba(140,175,110,0.45)'; g.lineWidth = 3 + random() * 3; g.stroke();
      }
      g.restore();
      return;
    }
    if (kind === 'bird') {
      g.beginPath(); g.ellipse(w / 2, h * 0.52, w * 0.44, h * 0.47, 0, 0, Math.PI * 2);
      g.fillStyle = '#3d6b3a'; g.fill();
      g.save(); g.clip();
      g.strokeStyle = '#a9c08a'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 0); g.stroke();
      g.strokeStyle = 'rgba(160,190,130,0.35)'; g.lineWidth = 1.4;
      for (let y = 20; y < h; y += 9) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + s * w * 0.5, y - 40); g.stroke(); }
      g.restore();
      g.globalCompositeOperation = 'destination-out'; // a few natural tears
      for (let i = 0; i < 4; i++) {
        const s = random() < 0.5 ? -1 : 1, y = h * (0.2 + random() * 0.6);
        g.beginPath(); g.moveTo(w / 2 + s * w * 0.5, y - 30); g.lineTo(w / 2 + s * w * 0.08, y); g.lineWidth = 2.5; g.stroke();
      }
      return;
    }
    // monstera: heart-shaped leaf with slits and holes
    g.beginPath();
    g.moveTo(w / 2, h * 0.98);
    g.bezierCurveTo(w * 0.05, h * 0.9, -w * 0.02, h * 0.35, w * 0.3, h * 0.12);
    g.bezierCurveTo(w * 0.42, h * 0.04, w * 0.48, h * 0.1, w / 2, h * 0.16);
    g.bezierCurveTo(w * 0.52, h * 0.1, w * 0.58, h * 0.04, w * 0.7, h * 0.12);
    g.bezierCurveTo(w * 1.02, h * 0.35, w * 0.95, h * 0.9, w / 2, h * 0.98);
    const leaf = g.createLinearGradient(0, 0, w, h);
    leaf.addColorStop(0, '#2f6a33'); leaf.addColorStop(1, '#1f4d26');
    g.fillStyle = leaf; g.fill();
    g.strokeStyle = 'rgba(150,190,120,0.55)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(w / 2, h * 0.98); g.lineTo(w / 2, h * 0.16); g.stroke();
    g.lineWidth = 1.6;
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
      const y = h * (0.28 + i * 0.1);
      g.beginPath(); g.moveTo(w / 2, y + 20); g.quadraticCurveTo(w / 2 + s * w * 0.2, y, w / 2 + s * w * 0.48, y - 30); g.stroke();
    }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { // slits from the edge
      const y = h * (0.3 + i * 0.1) + random() * 10;
      g.beginPath(); g.moveTo(w / 2 + s * w * 0.55, y - 34); g.quadraticCurveTo(w / 2 + s * w * 0.3, y - 10, w / 2 + s * w * (0.12 + random() * 0.06), y + 8);
      g.lineWidth = 7 + random() * 5; g.stroke();
    }
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { // holes near the middle
      g.beginPath(); g.ellipse(w / 2 + s * w * 0.11, h * (0.36 + i * 0.13), 5, 11, s * 0.5, 0, Math.PI * 2); g.fill();
    }
  });
}
