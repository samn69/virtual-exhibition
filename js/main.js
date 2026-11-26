import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMuseum } from './building.js';
import { Artworks } from './artworks.js';
import { Walker } from './controls.js';
import { decorate } from './decor.js';
import { Sky } from './sky.js';
import { loadExhibition, normalizeExhibition } from './exhibition.js';
import { manifestId, readPublicManifest } from './drive.js';
import { Closeup } from './closeup.js';
import { Editor } from './editor.js';
import { Music } from './music.js';
import { welcome } from './visits.js';
import { Tour } from './tour.js';

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
const sky = new Sky(); // the sky, drawn by the roof glass
const walker = new Walker(camera, canvas, { onTap: tap, onMove: hideHint });
walker.attachJoystick($('joystick'));
if (isTouch) $('joystick').hidden = false;

let museum = null, artworks = null, exhibition = null, currentZone = null, shownFloors = '';

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
}

// build the gallery for an exhibition; keepPlace leaves the visitor where they are
function show(newExhibition, { keepPlace = false } = {}) {
  const place = keepPlace && museum ? { floor: walker.floor, x: walker.x, z: walker.z, yaw: walker.yaw, pitch: walker.pitch } : null;
  tour.interrupt();
  closeup.close({ jump: true });
  if (museum) disposeWorld();
  exhibition = newExhibition;
  // rooms without photos are roped off, except while the owner is editing (to add photos there)
  museum = buildMuseum(exhibition, renderer, { glass: sky.material, openAll: !!editor?.editing });
  scene.add(museum.root);
  decorate(museum.decor, reflections);
  hangPhotos();
  walker.museum = museum;
  walker.place(place || museum.start);
  if (place) { walker.pitch = place.pitch; walker.apply(); }
  currentZone = null; shownFloors = '';
  document.title = `${exhibition.title} · Virtual Exhibition`;
  fillRoomsMenu();
}
function hangPhotos() {
  artworks = new Artworks(museum, exhibition, { onBusy: count => { $('loading').hidden = count === 0; } });
}
// after an edit: only the photos changed (quick), or names too (the whole building is rebuilt)
function apply(newExhibition, { rebuild = 'photos' } = {}) {
  if (rebuild === 'all' || !museum) { show(newExhibition, { keepPlace: true }); return; }
  tour.interrupt();
  closeup.close({ jump: true });
  artworks.dispose();
  exhibition = newExhibition;
  hangPhotos();
  currentZone = null; // load the photos round the visitor again
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
      const button = entry(g + 1, { name: room.name, count: n ? `${n} photo${n === 1 ? '' : 's'}` : museum.closed.has(`r${g}`) ? 'coming soon' : 'empty' }, room.entrance);
      if (museum.closed.has(`r${g}`)) button.disabled = true; // its doors are closed
      items.push(button);
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
  editor.update();
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
  const path = museum.glidePath(walker.floor, dir);
  walker.glide(path, path.seconds || GLIDE_SECONDS, () => { currentZone = null; });
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
  if (kind === 'photo') { closeup.show(hit.object.userData.item); hideHint(); }
  else if (kind === 'stairs') climb(floor === walker.floor ? 1 : -1);
  else if (kind === 'floor' && floor === walker.floor) {
    walker.walkTo(hit.point.x, hit.point.z);
    marker.position.set(hit.point.x, hit.point.y + 0.01, hit.point.z);
    marker.material.opacity = 0.8;
    hideHint();
  }
}

// ── a close look at a photo, and edit mode ──
const music = new Music();
const closeup = new Closeup({ camera, walker, overlay: $('closeup'), artworks: () => artworks, onChange: item => {
  document.body.classList.toggle('closeup-open', !!item);
  if (!item) closeFull();
  $('closeupLabel').textContent = closeup.reading ? 'Photo' : 'Label';
  $('closeupLeft').disabled = !item || item.index === 0;
  $('closeupRight').disabled = !item || item.index === exhibition.rooms[item.room].photos.length - 1;
} });
$('closeupClose').onclick = () => closeup.close();
$('closeupLabel').onclick = () => closeup.toggleLabel();

// ── the photo on its own, full screen (from a close look) ──
let fullBlobUrl = null; // the copy the close look already downloaded, so it isn't fetched twice
function openFull() {
  const item = closeup.item;
  if (!item) return;
  const image = $('fullImage');
  $('fullLoading').hidden = false;
  image.onload = image.onerror = () => { $('fullLoading').hidden = true; };
  if (fullBlobUrl) URL.revokeObjectURL(fullBlobUrl);
  fullBlobUrl = artworks.blobUrl(item.photo.fullUrl);
  image.src = fullBlobUrl || item.photo.fullUrl || item.canvas?.toDataURL('image/jpeg', 0.9) || '';
  image.alt = item.photo.title || 'Photo';
  $('fullTitle').textContent = [item.photo.title || 'Untitled', item.photo.year].filter(Boolean).join(', ');
  $('fullView').hidden = false;
  document.body.classList.add('full-open');
  closeup.blocked = true;
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
}
function closeFull() {
  if ($('fullView').hidden) return;
  $('fullView').hidden = true;
  document.body.classList.remove('full-open');
  $('fullImage').removeAttribute('src');
  if (fullBlobUrl) { URL.revokeObjectURL(fullBlobUrl); fullBlobUrl = null; }
  closeup.blocked = false;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
// next or previous from full screen: back to the wall and on to that photo there; Full screen opens it again
function stepFull(direction) { closeFull(); closeup.step(direction); }
$('closeupFull').onclick = openFull;
$('fullClose').onclick = closeFull;
$('fullPrev').onclick = () => stepFull(-1);
$('fullNext').onclick = () => stepFull(1);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) closeFull(); }); // Esc leaves full screen
addEventListener('keydown', e => {
  if ($('fullView').hidden) return;
  if (e.key === 'Escape') closeFull();
  else if (e.key === 'ArrowLeft') stepFull(-1);
  else if (e.key === 'ArrowRight') stepFull(1);
});
let fullSwipe = null; // swipe to go on to the next photo on the wall, tap to go back to the wall
$('fullView').addEventListener('pointerdown', e => { if (e.target.closest('button')) return; fullSwipe = { x: e.clientX, y: e.clientY }; });
$('fullView').addEventListener('pointerup', e => {
  if (!fullSwipe) return;
  const dx = e.clientX - fullSwipe.x, dy = e.clientY - fullSwipe.y;
  fullSwipe = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) stepFull(dx < 0 ? 1 : -1);
  else if (Math.hypot(dx, dy) < 10) closeFull();
});
$('closeupPrev').onclick = () => closeup.step(-1);
$('closeupNext').onclick = () => closeup.step(1);
// ── the guided tour ──
const tour = new Tour({
  camera, walker, closeup, museum: () => museum, artworks: () => artworks, openFull, closeFull,
  isFull: () => !$('fullView').hidden,
  banner: text => { const banner = $('roomBanner'); banner.textContent = text; banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show'); },
});
$('tourPlay').addEventListener('click', hideHint);

const editor = new Editor({
  exhibition: () => exhibition, zone: () => currentZone, floors: () => museum.floors,
  editingChanged: () => { if (exhibition.rooms.some(room => !room.photos.length)) show(exhibition, { keepPlace: true }); }, // open or rope off the empty rooms
  normalize: normalizeExhibition, apply, closeup, findPhoto: (room, index) => artworks.find(room, index),
});

// ── menus ──
$('roomsButton').onclick = () => $('roomsDialog').showModal();
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', e => { if (e.target === dialog && !dialog.classList.contains('form')) dialog.close(); }); // tap outside closes
  dialog.querySelectorAll('.close, .cancel').forEach(button => button.addEventListener('click', () => dialog.close()));
}

// ── first-visit hint ──
$('hint').textContent = isTouch
  ? 'Drag to look around · Tap the floor to walk there, or use the joystick · Tap a photo to see it'
  : 'Drag to look around · Click the floor or use the arrow keys to walk · Click a photo to see it';
let hintTimer = setTimeout(hideHint, 12000);
function hideHint() { clearTimeout(hintTimer); $('hint').classList.add('gone'); }

// ── start ──
welcome(); // the optional name card on a first visit, then the visit is counted
// the exhibition: from Google Drive once it's set up there, otherwise exhibition.json
const params = new URLSearchParams(location.search);
async function firstExhibition() {
  if (params.has('exhibition')) return loadExhibition(params.get('exhibition'));
  const id = manifestId();
  if (id) {
    try { return normalizeExhibition(await readPublicManifest(id)); } catch (error) {
      $('error').textContent = `${error.message}. Showing the sample gallery.`;
      $('error').hidden = false;
    }
  }
  return loadExhibition('exhibition.json');
}
try {
  show(await firstExhibition());
} catch (error) {
  $('error').textContent = `${error.message}. Showing an empty gallery.`;
  $('error').hidden = false;
  show(normalizeExhibition({}));
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  walker.update(dt);
  tour.update(dt);
  closeup.update(dt);
  sky.update(clock.elapsedTime);
  updateZone();
  museum.updateRoofs(camera.position.y);
  if (marker.material.opacity > 0) marker.material.opacity = walker.target ? 0.8 : Math.max(0, marker.material.opacity - dt * 2);
  renderer.render(scene, camera);
});

// for testing: ?debug gives the console access to the walker and the photos
if (new URLSearchParams(location.search).has('debug')) window.app = { scene, walker, get museum() { return museum; }, get artworks() { return artworks; }, show, apply, closeup, editor, climb, music, tour };
