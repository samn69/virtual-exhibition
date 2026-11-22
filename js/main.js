import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMuseum } from './building.js';
import { Artworks, placeholderCanvas } from './artworks.js';
import { Walker } from './controls.js';
import { decorate } from './decor.js';
import { loadExhibition, exhibitionFromFiles, normalizeExhibition } from './exhibition.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const isTouch = matchMedia('(pointer: coarse)').matches;
const GLIDE_SECONDS = 7;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (error) {
  $('error').textContent = "This browser can't show 3D graphics (WebGL), so the gallery can't open here.";
  $('error').hidden = false;
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.NoToneMapping; // keep wall colours as chosen

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1512');
scene.add(new THREE.HemisphereLight('#fff6ea', '#9a8a74', 3.1));
const sun = new THREE.DirectionalLight('#fff6e8', 0.6); // light through the skylights
sun.position.set(3, 10, 4);
scene.add(sun);
// soft reflections for the sculpture and plant models only (on the walls and floor it washes everything out)
const reflections = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
const walker = new Walker(camera, canvas, { onTap: tap, onMove: hideHint });
walker.attachJoystick($('joystick'));
if (isTouch) $('joystick').hidden = false;

let museum = null, artworks = null, exhibition = null, currentZone = null, shownFloors = '';
const localUrls = [];

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 80 : 70; // a bit wider on a phone held upright
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function disposeWorld() {
  artworks?.dispose();
  museum.root.traverse(object => {
    object.geometry?.dispose();
    for (const material of [].concat(object.material || [])) { if (!material.userData.shared) { material.map?.dispose(); material.dispose(); } }
  });
  museum.dispose();
  scene.remove(museum.root);
  localUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
}

function show(newExhibition) {
  if (museum) disposeWorld();
  exhibition = newExhibition;
  museum = buildMuseum(exhibition, renderer);
  scene.add(museum.root);
  decorate(museum.decor, reflections);
  artworks = new Artworks(museum, exhibition, { onBusy: count => { $('loading').hidden = count === 0; } });
  walker.museum = museum;
  walker.place(museum.start);
  currentZone = null; shownFloors = '';
  document.title = `${exhibition.title} · Virtual Exhibition`;
  fillRoomsMenu();
}

function fillRoomsMenu() {
  const items = [];
  const entry = (label, detail, place) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = '<span class="num"></span><span class="name"></span><span class="count"></span>';
    button.querySelector('.num').textContent = label;
    button.querySelector('.name').textContent = detail.name;
    button.querySelector('.count').textContent = detail.count || '';
    button.onclick = () => { walker.place(place); $('roomsDialog').close(); };
    return button;
  };
  items.push(entry('⌂', { name: 'Entrance' }, museum.start));
  for (let f = 0; f < museum.floors; f++) {
    if (museum.floors > 1) {
      const heading = document.createElement('h3');
      heading.textContent = `Floor ${f + 1}`;
      items.push(heading);
    }
    items.push(entry('◆', { name: 'Central Hall' }, museum.hallStart(f)));
    museum.rooms.forEach((room, g) => {
      if (room.floor !== f) return;
      const n = exhibition.rooms[g].photos.length;
      items.push(entry(g + 1, { name: room.name, count: n ? `${n} photo${n === 1 ? '' : 's'}` : 'empty' }, room.entrance));
    });
  }
  $('roomsList').replaceChildren(...items);
}

// where the visitor is: name on screen, which floors to draw, which photos to load
function updateZone() {
  const zone = museum.zoneAt(walker.floor, walker.x, walker.z);
  const floors = walker.gliding ? [walker.floor, walker.gliding.to] : [walker.floor];
  const key = floors.join(',');
  if (key !== shownFloors) { museum.showFloors(floors); shownFloors = key; }
  if (zone === currentZone) return;
  currentZone = zone;
  const name = museum.names.get(zone) || '';
  $('roomName').textContent = museum.floors > 1 && zone.startsWith('r') ? `${name} · Floor ${walker.floor + 1}` : name;
  if (zone.startsWith('r') || zone === 'e') {
    const banner = $('roomBanner');
    banner.textContent = name;
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
  }
  // rooms you can walk to through one doorway; from the entrance and stairs, two
  artworks.focus(museum.distancesFrom(zone), zone.startsWith('r') || zone.startsWith('h') ? 1 : 2);
  updateStairButtons();
}

// ── the spiral stairs ──
function updateStairButtons() {
  const onStairs = !walker.gliding && currentZone?.startsWith('s');
  $('stairUp').hidden = !onStairs || walker.floor >= museum.floors - 1;
  $('stairDown').hidden = !onStairs || walker.floor <= 0;
  $('stairUp').textContent = `↑ Floor ${walker.floor + 2}`;
  $('stairDown').textContent = `↓ Floor ${walker.floor}`;
  $('stairs').hidden = $('stairUp').hidden && $('stairDown').hidden;
}
function climb(dir) {
  const to = walker.floor + dir;
  if (walker.gliding || to < 0 || to >= museum.floors) return;
  hideHint();
  walker.glide(museum.glidePath(walker.floor, dir), GLIDE_SECONDS, () => { currentZone = null; });
  $('stairs').hidden = true;
}
$('stairUp').onclick = () => climb(1);
$('stairDown').onclick = () => climb(-1);

// ── tapping: a photo opens it, the floor walks there, the spiral stairs glide ──
const raycaster = new THREE.Raycaster();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
marker.rotation.x = -Math.PI / 2;
scene.add(marker);
const visible = object => { for (let o = object; o; o = o.parent) if (!o.visible) return false; return true; };
function tap(x, y) {
  if (walker.gliding) return;
  const rect = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera);
  const targets = [...museum.raycastTargets.filter(visible), ...artworks.meshes];
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (!hit) return;
  const { kind, floor } = hit.object.userData;
  if (kind === 'photo') openViewer(hit.object.userData.item);
  else if (kind === 'stairs') climb(floor === walker.floor ? 1 : -1);
  else if (kind === 'floor' && floor === walker.floor) {
    walker.walkTo(hit.point.x, hit.point.z);
    marker.position.set(hit.point.x, hit.point.y + 0.01, hit.point.z);
    marker.material.opacity = 0.8;
    hideHint();
  }
}

// ── full-screen photo viewer ──
let viewing = null;
function photoUrl(item) {
  if (item.photo.file) { const url = URL.createObjectURL(item.photo.file); localUrls.push(url); return url; }
  if (item.photo.src && !item.failed) return item.photo.src;
  return (item.canvas || placeholderCanvas(item.room * 20 + item.index, item.photo.aspect || 1.33)).toDataURL('image/jpeg', 0.9);
}
function openViewer(item) {
  viewing = item;
  const list = artworks.inRoom(item.room);
  $('viewerImage').src = photoUrl(item);
  $('viewerImage').alt = item.photo.title || 'Photo';
  $('viewerTitle').textContent = item.photo.title || 'Untitled';
  $('viewerDate').textContent = item.photo.date;
  $('viewerCaption').textContent = item.photo.caption;
  $('viewerPlace').textContent = `${exhibition.rooms[item.room].name} · ${list.indexOf(item) + 1} of ${list.length}`;
  $('viewer').hidden = false;
  walker.enabled = false;
}
function stepViewer(step) {
  const list = artworks.inRoom(viewing.room);
  openViewer(list[(list.indexOf(viewing) + step + list.length) % list.length]);
}
function closeViewer() { $('viewer').hidden = true; $('viewerImage').removeAttribute('src'); viewing = null; walker.enabled = true; }
$('viewerClose').onclick = closeViewer;
$('viewerPrev').onclick = () => stepViewer(-1);
$('viewerNext').onclick = () => stepViewer(1);
$('viewer').addEventListener('click', e => { if (e.target === $('viewer')) closeViewer(); });
addEventListener('keydown', e => {
  if (!viewing) return;
  if (e.key === 'Escape') closeViewer();
  else if (e.key === 'ArrowLeft') stepViewer(-1);
  else if (e.key === 'ArrowRight') stepViewer(1);
});
// swipe left or right in the viewer for the next photo
let swipeStart = null;
$('viewer').addEventListener('pointerdown', e => { swipeStart = e.clientX; });
$('viewer').addEventListener('pointerup', e => {
  if (swipeStart !== null && Math.abs(e.clientX - swipeStart) > 60) stepViewer(e.clientX < swipeStart ? 1 : -1);
  swipeStart = null;
});

// ── menus ──
$('roomsButton').onclick = () => $('roomsDialog').showModal();
$('photosButton').onclick = () => $('photosDialog').showModal();
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); // tap outside closes
  dialog.querySelector('.close')?.addEventListener('click', () => dialog.close());
}
for (const input of [$('pickPhotos'), $('pickFolder')]) {
  input.addEventListener('change', () => {
    const picked = exhibitionFromFiles(input.files);
    input.value = '';
    if (!picked) { $('photosError').textContent = 'No photos found there. Pick JPEG, PNG or WebP pictures.'; $('photosError').hidden = false; return; }
    $('photosError').hidden = true;
    $('photosDialog').close();
    $('backToSample').hidden = false;
    show(picked);
  });
}
if (!('webkitdirectory' in document.createElement('input')) || isTouch) $('pickFolderRow').hidden = true;
$('backToSample').onclick = async () => { $('photosDialog').close(); $('backToSample').hidden = true; show(await loadExhibition(source)); };

// ── first-visit hint ──
$('hint').textContent = isTouch
  ? 'Drag to look around · Tap the floor to walk there, or use the joystick · Tap a photo to see it'
  : 'Drag to look around · Click the floor or use the arrow keys to walk · Click a photo to see it';
let hintTimer = setTimeout(hideHint, 12000);
function hideHint() { clearTimeout(hintTimer); $('hint').classList.add('gone'); }

// ── start ──
const source = new URLSearchParams(location.search).get('exhibition') || 'exhibition.json';
try {
  show(await loadExhibition(source));
} catch (error) {
  $('error').textContent = `${error.message}. Showing an empty gallery.`;
  $('error').hidden = false;
  show(normalizeExhibition({}));
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  walker.update(dt);
  updateZone();
  if (marker.material.opacity > 0) marker.material.opacity = walker.target ? 0.8 : Math.max(0, marker.material.opacity - dt * 2);
  renderer.render(scene, camera);
});

// for testing: ?debug gives the console access to the walker and the photos
if (new URLSearchParams(location.search).has('debug')) window.app = { scene, walker, get museum() { return museum; }, get artworks() { return artworks; }, show, openViewer, climb };
