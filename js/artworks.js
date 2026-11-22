// The photos on the walls: frame, mount, picture light and plaque for each one.
// Photos are loaded only for the room you're in and the rooms next to it, and shrunk to a
// sensible size first, so 80+ photos don't run a phone out of memory.
import * as THREE from 'three';
import { canvasTexture, seeded } from './textures.js';
import { PHOTO_Y } from './constants.js';

const SERIF = 'Georgia, "Times New Roman", serif';
const isTouch = matchMedia('(pointer: coarse)').matches;
const MAX_SIDE = isTouch ? 1024 : 1600;
const CONCURRENT = 3;

const frameMaterial = new THREE.MeshLambertMaterial({ color: '#a8823a', emissive: '#2a1c06' });
const mountMaterial = new THREE.MeshLambertMaterial({ color: '#efe8d8' });
const brassMaterial = new THREE.MeshLambertMaterial({ color: '#8d6f35', emissive: '#1d1406' });
let glowTexture = null;
function glow() {
  glowTexture ??= canvasTexture(256, 256, (g, w) => {
    const light = g.createRadialGradient(w / 2, w * 0.38, 0, w / 2, w / 2, w / 2);
    light.addColorStop(0, 'rgba(255,236,200,0.9)');
    light.addColorStop(0.55, 'rgba(255,230,190,0.35)');
    light.addColorStop(1, 'rgba(255,230,190,0)');
    g.fillStyle = light; g.fillRect(0, 0, w, w);
  });
  return glowTexture;
}

// a stand-in picture for exhibitions that don't have photos yet
export function placeholderCanvas(index, aspect, label = 'Your photo here') {
  const random = seeded(index * 97 + 13);
  const w = aspect >= 1 ? 900 : Math.round(900 * aspect), h = aspect >= 1 ? Math.round(900 / aspect) : 900;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  const hue = Math.floor(random() * 360);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, `hsl(${hue},45%,72%)`); sky.addColorStop(1, `hsl(${(hue + 40) % 360},55%,86%)`);
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = `hsla(${(hue + 180) % 360},70%,92%,0.9)`;
  g.beginPath(); g.arc(w * (0.2 + random() * 0.6), h * (0.2 + random() * 0.2), Math.min(w, h) * 0.09, 0, Math.PI * 2); g.fill();
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = `hsl(${(hue + 200 + layer * 15) % 360},${30 + layer * 8}%,${48 - layer * 12}%)`;
    g.beginPath(); g.moveTo(0, h);
    const base = h * (0.55 + layer * 0.13);
    for (let x = 0; x <= w; x += w / 8) g.lineTo(x, base - random() * h * 0.18);
    g.lineTo(w, h); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `${Math.round(Math.min(w, h) * 0.06)}px ${SERIF}`;
  g.textAlign = 'center'; g.fillText(label, w / 2, h - Math.min(w, h) * 0.06);
  return canvas;
}

async function imageFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode(); // the browser applies the photo's rotation (EXIF) here
    return image;
  } finally { URL.revokeObjectURL(url); }
}

async function photoCanvas(photo) {
  let blob = photo.file;
  if (!blob) {
    const response = await fetch(photo.src, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    blob = await response.blob();
  }
  const image = await imageFromBlob(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function plaqueTexture(number, photo) {
  return canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = '#f2ecdf'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b9ab8e'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#2a241d'; g.textBaseline = 'top';
    g.font = `28px ${SERIF}`; g.fillText(String(number), 30, 28);
    let y = 74;
    const wrap = (text, font, lineHeight, maxLines) => {
      g.font = font;
      const words = text.split(/\s+/); let line = '', lines = 0;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (g.measureText(test).width > w - 60 && line) {
          g.fillText(line, 30, y); y += lineHeight; line = word;
          if (++lines >= maxLines - 1) { line = `${line}…`; break; }
        } else line = test;
      }
      if (line) { g.fillText(line, 30, y); y += lineHeight; }
    };
    wrap(photo.title || 'Untitled', `bold 34px ${SERIF}`, 42, 2);
    if (photo.date) wrap(photo.date, `italic 28px ${SERIF}`, 36, 1);
    if (photo.caption) { y += 6; wrap(photo.caption, `26px ${SERIF}`, 32, 3); }
  });
}

export class Artworks {
  constructor(museum, exhibition, { onBusy } = {}) {
    this.onBusy = onBusy || (() => {});
    this.items = [];
    this.queue = [];
    this.running = 0;
    this.disposed = false;
    museum.rooms.forEach((room, r) => {
      exhibition.rooms[r].photos.forEach((photo, index) => {
        const slot = room.slots[index];
        if (slot) this.items.push({ photo, slot, room: r, floor: room.floor, index, number: index + 1, parent: room.group, state: 'idle', group: null, mesh: null, texture: null, canvas: null });
      });
    });
  }

  get meshes() { return this.items.filter(item => item.group && item.parent.visible).flatMap(item => item.hits); }
  inRoom(room) { return this.items.filter(item => item.room === room); }

  // load the photos of rooms within `radius` doorways of the visitor; free the ones far away
  focus(distances, radius) {
    const distance = item => distances.get(`r${item.room}`) ?? Infinity;
    for (const item of this.items) {
      const d = distance(item);
      if (d <= radius && item.state === 'idle') { item.state = 'queued'; this.queue.push(item); }
      else if (d > radius + 1 && item.state === 'queued') item.state = 'idle';
      else if (d > radius + 1 && item.state === 'loaded') this.unload(item);
    }
    this.queue = this.queue.filter(item => item.state === 'queued');
    this.queue.sort((a, b) => distance(a) - distance(b) || a.room - b.room || a.index - b.index);
    this.pump();
  }

  pump() {
    while (this.running < CONCURRENT && this.queue.length) {
      const item = this.queue.shift();
      if (item.state !== 'queued') continue;
      this.running++;
      this.load(item).finally(() => { this.running--; this.report(); this.pump(); });
    }
    this.report();
  }
  report() { this.onBusy(this.running + this.queue.length); }

  async load(item) {
    item.state = 'loading';
    let canvas, failed = false;
    try {
      canvas = item.photo.src || item.photo.file ? await photoCanvas(item.photo) : placeholderCanvas(item.room * 20 + item.index, item.photo.aspect || [1.5, 0.75, 1.33, 1, 0.8][item.index % 5]);
    } catch (error) {
      console.warn('Could not load photo', item.photo.src || item.photo.file?.name, error);
      canvas = placeholderCanvas(item.index, 1.33, "Couldn't load this photo");
      failed = true;
    }
    if (this.disposed) return;
    item.canvas = canvas;
    item.failed = failed;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    if (!item.group) this.build(item, canvas.width / canvas.height);
    item.texture = texture;
    item.mesh.material.map = texture;
    item.mesh.material.color.set('#ffffff');
    item.mesh.material.needsUpdate = true;
    item.state = 'loaded';
  }

  unload(item) {
    item.texture?.dispose();
    item.texture = null; item.canvas = null;
    item.mesh.material.map = null;
    item.mesh.material.color.set('#d9d2c3');
    item.mesh.material.needsUpdate = true;
    item.state = 'idle';
  }

  build(item, aspect) {
    const { slot } = item;
    let w = slot.maxW, h = w / aspect;
    if (h > slot.maxH) { h = slot.maxH; w = h * aspect; }
    const group = new THREE.Group();
    group.position.copy(slot.position);
    group.rotation.y = slot.rotationY;

    const light = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.8, h + 1.8), new THREE.MeshBasicMaterial({ map: glow(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    light.position.set(0, 0.2, 0.006);
    const border = 0.12, matte = Math.min(0.1, Math.min(w, h) * 0.08);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * (matte + border), h + 2 * (matte + border), 0.07), frameMaterial);
    frame.position.z = 0.035;
    const mount = new THREE.Mesh(new THREE.PlaneGeometry(w + 2 * matte, h + 2 * matte), mountMaterial);
    mount.position.z = 0.072;
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#d9d2c3', toneMapped: false }));
    photo.position.z = 0.074;

    // brass picture light above the frame
    const top = h / 2 + matte + border;
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, Math.min(w * 0.55, 1.1), 12), brassMaterial);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(0, top + 0.2, 0.24);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.24), brassMaterial);
    arm.position.set(0, top + 0.2, 0.12);

    // plaque beside the frame, at reading height
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), new THREE.MeshLambertMaterial({ map: plaqueTexture(item.number, item.photo) }));
    plaque.position.set(slot.plaqueSide * (w / 2 + matte + border + 0.34), 1.38 - PHOTO_Y, 0.012);

    group.add(light, frame, mount, photo, lamp, arm, plaque);
    for (const mesh of [frame, mount, photo, plaque]) mesh.userData = { kind: 'photo', item };
    item.parent.add(group);
    Object.assign(item, { group, mesh: photo, hits: [frame, mount, photo, plaque] });
  }

  dispose() {
    this.disposed = true;
    this.queue = [];
    for (const item of this.items) item.texture?.dispose();
  }
}
