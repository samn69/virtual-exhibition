import * as THREE from 'three';
import { buildMuseum } from './building.js';
import { Artworks, placeholderCanvas } from './artworks.js';
import { Walker } from './controls.js';
import { loadExhibition, exhibitionFromFiles } from './exhibition.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const isTouch = matchMedia('(pointer: coarse)').matches;

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

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
const walker = new Walker(camera, canvas, { onTap: tap, onMove: hideHint });
walker.attachJoystick($('joystick'));
if (isTouch) $('joystick').hidden = false;

let museum = null, artworks = null, exhibition = null, currentRoom = -1;
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
    for (const material of [].concat(object.material || [])) { material.map?.dispose(); material.dispose(); }
  });
  scene.remove(museum.root);
  localUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
}

function show(newExhibition) {
  if (museum) disposeWorld();
  exhibition = newExhibition;
  museum = buildMuseum(exhibition, renderer);
  scene.add(museum.root);
  artworks = new Artworks(museum, exhibition, { onBusy: count => { $('loading').hidden = count === 0; } });
  walker.walkable = museum.walkable;
  walker.place(museum.start);
  currentRoom = -1;
  document.title = `${exhibition.title} · Virtual Exhibition`;
  $('roomsList').replaceChildren(...exhibition.rooms.map((room, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = '<span class="num"></span><span class="name"></span><span class="count"></span>';
    button.querySelector('.num').textContent = i + 1;
    button.querySelector('.name').textContent = room.name;
    button.querySelector('.count').textContent = room.photos.length ? `${room.photos.length} photo${room.photos.length === 1 ? '' : 's'}` : '';
    button.onclick = () => { walker.place(i === 0 ? museum.start : museum.entrance(i)); $('roomsDialog').close(); };
    return button;
  }));
}

function enterRoom(index) {
  currentRoom = index;
  museum.showAround(index);
  artworks.focus(index);
  const name = exhibition.rooms[index].name;
  $('roomName').textContent = name;
  const banner = $('roomBanner');
  banner.textContent = name;
  banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
}

// ── tapping: a photo opens it, the floor walks there ──
const raycaster = new THREE.Raycaster();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
marker.rotation.x = -Math.PI / 2;
scene.add(marker);
function tap(x, y) {
  const rect = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera);
  const targets = [...museum.raycastTargets.filter(mesh => mesh.parent.visible), ...artworks.meshes];
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (!hit) return;
  if (hit.object.userData.kind === 'photo') openViewer(hit.object.userData.item);
  else if (hit.object.userData.kind === 'floor') {
    walker.walkTo(hit.point.x, hit.point.z);
    marker.position.set(hit.point.x, 0.01, hit.point.z);
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
  const position = list.indexOf(item);
  $('viewerImage').src = photoUrl(item);
  $('viewerImage').alt = item.photo.title || 'Photo';
  $('viewerTitle').textContent = item.photo.title || 'Untitled';
  $('viewerDate').textContent = item.photo.date;
  $('viewerCaption').textContent = item.photo.caption;
  $('viewerPlace').textContent = `${exhibition.rooms[item.room].name} · ${position + 1} of ${list.length}`;
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
  show((await import('./exhibition.js')).normalizeExhibition({}));
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  walker.update(dt);
  const room = museum.roomAt(walker.x);
  if (room !== currentRoom) enterRoom(room);
  if (marker.material.opacity > 0) marker.material.opacity = walker.target ? 0.8 : Math.max(0, marker.material.opacity - dt * 2);
  renderer.render(scene, camera);
});

// for testing: ?debug gives the console access to the walker and the photos
if (new URLSearchParams(location.search).has('debug')) window.app = { walker, get museum() { return museum; }, get artworks() { return artworks; }, show, openViewer };
