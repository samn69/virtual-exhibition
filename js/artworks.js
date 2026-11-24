// The photos on the walls: frame, mount, picture light and plaque for each one.
// Photos are loaded only for the room you're in and the rooms next to it, and shrunk to a
// sensible size first, so 80+ photos don't run a phone out of memory. A close look loads the
// full-size copy of just that one photo.
import * as THREE from 'three';
import { canvasTexture, seeded } from './textures.js';
import { PHOTO_Y } from './constants.js';

const SERIF = 'Georgia, "Times New Roman", serif';
const isTouch = matchMedia('(pointer: coarse)').matches;
const MAX_SIDE = isTouch ? 1024 : 1600;
const FULL_SIDE = isTouch ? 2560 : 4096;
const CONCURRENT = 3;
const PLAQUE = { w: 0.42, h: 0.56 };

// downloaded photos, kept for a while so a gallery rebuilt after an edit doesn't fetch them again
const blobs = new Map();
async function download(url, backup) {
  if (blobs.has(url)) { const blob = blobs.get(url); blobs.delete(url); blobs.set(url, blob); return blob; }
  let response = await fetch(url, { mode: 'cors' }).catch(() => null);
  if (!response?.ok && backup) response = await fetch(backup, { mode: 'cors' });
  if (!response?.ok) throw new Error(`HTTP ${response?.status}`);
  if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('Not an image (Google may be blocking downloads)');
  const blob = await response.blob();
  blobs.set(url, blob);
  while (blobs.size > 48) blobs.delete(blobs.keys().next().value);
  return blob;
}

const frameMaterial = new THREE.MeshLambertMaterial({ color: '#4a2d1b', emissive: '#120905' }); // dark brown wood
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

async function photoCanvas(url, maxSide = MAX_SIDE, backup) {
  const image = await imageFromBlob(await download(url, backup));
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// the label beside a photo: number, title, year, description and place, then the camera details
function plaqueTexture(number, photo) {
  return canvasTexture(630, 840, (g, w, h) => {
    g.fillStyle = '#f2ecdf'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b9ab8e'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#2a241d'; g.textBaseline = 'top';
    const left = 40, width = w - 80;
    let y = 36;
    const wrap = (value, font, lineHeight, maxLines, color = '#2a241d') => {
      if (!value) return;
      g.font = font; g.fillStyle = color;
      const lines = [];
      let line = '';
      for (const word of value.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (g.measureText(test).width > width && line) { lines.push(line); line = word; } else line = test;
      }
      if (line) lines.push(line);
      if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s*\S*$/, '')}…`; }
      for (const l of lines) { if (y + lineHeight > h - 30) return; g.fillText(l, left, y); y += lineHeight; }
    };
    wrap(String(number), `30px ${SERIF}`, 50, 1, '#7a6c55');
    wrap(photo.title || 'Untitled', `bold 42px ${SERIF}`, 50, 3);
    wrap(photo.year, `italic 34px ${SERIF}`, 44, 1, '#4a4034');
    if (photo.description) { y += 12; wrap(photo.description, `31px ${SERIF}`, 39, 6); }
    if (photo.place) { y += 8; wrap(photo.place, `italic 29px ${SERIF}`, 37, 2, '#4a4034'); }
    const camera = [photo.camera, photo.lens, photo.settings].filter(Boolean);
    if (camera.length) {
      y += 18;
      g.fillStyle = '#b9ab8e'; g.fillRect(left, y, 90, 3); y += 20;
      wrap(photo.camera, `26px ${SERIF}`, 34, 2, '#5a4f40');
      wrap(photo.lens, `26px ${SERIF}`, 34, 2, '#5a4f40');
      wrap(photo.settings, `26px ${SERIF}`, 34, 2, '#5a4f40');
    }
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
      const photos = exhibition.rooms[r].photos, slots = room.slotsFor(photos.length);
      photos.forEach((photo, index) => {
        const slot = slots[index];
        if (slot) this.items.push({ photo, slot, room: r, floor: room.floor, index, number: index + 1, parent: room.group, state: 'idle', group: null, mesh: null, texture: null, canvas: null });
      });
    });
  }

  get meshes() { return this.items.filter(item => item.group && item.parent.visible).flatMap(item => item.hits); }
  inRoom(room) { return this.items.filter(item => item.room === room); }
  find(room, index) { return this.items.find(item => item.room === room && item.index === index); }

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
      canvas = item.photo.url ? await photoCanvas(item.photo.url, MAX_SIDE, item.photo.backupUrls?.[item.photo.url]) : placeholderCanvas(item.room * 20 + item.index, item.photo.aspect || [1.5, 0.75, 1.33, 1, 0.8][item.index % 5]);
    } catch (error) {
      console.warn('Could not load photo', item.photo.url, error);
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
    item.state = 'loaded';
    if (item.fullTexture) return; // a close look is already showing the full-size copy
    item.mesh.material.map = texture;
    item.mesh.material.color.set('#ffffff');
    item.mesh.material.needsUpdate = true;
  }

  unload(item) {
    this.releaseFull(item);
    item.texture?.dispose();
    item.texture = null; item.canvas = null;
    item.mesh.material.map = null;
    item.mesh.material.color.set('#d9d2c3');
    item.mesh.material.needsUpdate = true;
    item.state = 'idle';
  }

  // the full-size copy, for a close look at one photo
  async loadFull(item) {
    if (!item.photo.fullUrl || item.failed || item.fullTexture || item.fullLoading) return;
    item.fullLoading = true;
    try {
      const canvas = await photoCanvas(item.photo.fullUrl, FULL_SIDE, item.photo.backupUrls?.[item.photo.fullUrl]);
      if (this.disposed || !item.fullLoading || !item.group) return;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      item.fullTexture = texture;
      item.mesh.material.map = texture;
      item.mesh.material.color.set('#ffffff');
      item.mesh.material.needsUpdate = true;
    } catch (error) {
      console.warn('Could not load the full-size photo', error);
    } finally { item.fullLoading = false; }
  }
  releaseFull(item) {
    item.fullLoading = false;
    if (!item.fullTexture) return;
    item.fullTexture.dispose();
    item.fullTexture = null;
    if (item.mesh) { item.mesh.material.map = item.texture; item.mesh.material.needsUpdate = true; }
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
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(PLAQUE.w, PLAQUE.h), new THREE.MeshLambertMaterial({ map: plaqueTexture(item.number, item.photo) }));
    const outerW = w + 2 * (matte + border), outerH = h + 2 * (matte + border);
    const px = slot.plaqueSide * (outerW / 2 + 0.1 + PLAQUE.w / 2), py = slot.plaqueY ?? 1.38 - PHOTO_Y;
    plaque.position.set(px, py, 0.012);

    group.add(light, frame, mount, photo, plaque);
    if (slot.lamp !== false) group.add(lamp, arm); // not under another photo
    for (const mesh of [frame, mount, photo, plaque]) mesh.userData = { kind: 'photo', item };
    item.parent.add(group);
    // what a close look takes in: the frame, its light and the plaque (in the group's own frame)
    const bounds = {
      x0: Math.min(-outerW / 2, px - PLAQUE.w / 2), x1: Math.max(outerW / 2, px + PLAQUE.w / 2),
      y0: Math.min(-outerH / 2, py - PLAQUE.h / 2), y1: Math.max(outerH / 2, py + PLAQUE.h / 2) + 0.12,
    };
    Object.assign(item, { group, mesh: photo, plaque, hits: [frame, mount, photo, plaque], bounds });
  }

  // take every photo off the walls (when the gallery changes)
  dispose() {
    this.disposed = true;
    this.queue = [];
    for (const item of this.items) {
      item.texture?.dispose(); item.fullTexture?.dispose();
      if (!item.group) continue;
      item.group.removeFromParent();
      item.group.traverse(object => {
        object.geometry?.dispose();
        if (object.material && object.material !== frameMaterial && object.material !== mountMaterial && object.material !== brassMaterial) {
          if (object.material.map && object.material.map !== glowTexture) object.material.map.dispose();
          object.material.dispose();
        }
      });
    }
  }
}
