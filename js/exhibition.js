// What's on show: the exhibition title, its rooms and the photos in each room.
// It comes from exhibition.json, or from photos picked on this device ("Your photos").
import { WALL_COLORS, ROOMS_PER_FLOOR } from './constants.js';

export const MAX_PER_ROOM = 8;    // what fits on a room's walls
const MAX_FLOORS = 8;
const PER_ROOM_FROM_FILES = 8;    // photos per room when they aren't sorted into folders

const text = value => (typeof value === 'string' ? value.trim() : '');
const color = value => (/^#[0-9a-f]{6}$/i.test(value || '') ? value : null);

export function normalizeExhibition(data) {
  const rooms = [];
  for (const room of Array.isArray(data?.rooms) ? data.rooms : []) {
    const photos = (Array.isArray(room?.photos) ? room.photos : [])
      .filter(photo => photo && typeof photo === 'object')
      .map(photo => ({
        src: text(photo.src), file: null,
        title: text(photo.title), date: text(photo.date), caption: text(photo.caption),
        aspect: Number(photo.aspect) > 0 ? Number(photo.aspect) : null,
      }));
    const name = text(room?.name) || `Room ${rooms.length + 1}`;
    const parts = Math.max(1, Math.ceil(photos.length / MAX_PER_ROOM)); // a full room continues in the next one
    for (let k = 0; k < parts; k++) {
      rooms.push({ name: k ? `${name} (${k + 1})` : name, color: color(room?.color), photos: photos.slice(k * MAX_PER_ROOM, (k + 1) * MAX_PER_ROOM) });
    }
  }
  return finish(text(data?.title) || 'My Exhibition', text(data?.subtitle), rooms, Number.parseInt(data?.floors, 10));
}

// Every floor has 8 rooms. "floors" asks for a number of floors; there are always enough for
// all the photos, and rooms without photos are left empty (named, ready to be filled).
function finish(title, subtitle, rooms, floorsWanted) {
  const needed = Math.ceil(rooms.length / ROOMS_PER_FLOOR) || 1;
  const floors = Math.min(MAX_FLOORS, Math.max(Number.isFinite(floorsWanted) && floorsWanted > 0 ? floorsWanted : 1, needed));
  rooms = rooms.slice(0, floors * ROOMS_PER_FLOOR);
  while (rooms.length < floors * ROOMS_PER_FLOOR) rooms.push({ name: `Room ${rooms.length + 1}`, color: null, photos: [] });
  rooms.forEach((room, i) => { room.color ||= WALL_COLORS[i % WALL_COLORS.length]; });
  return { title, subtitle, floors, rooms };
}

export async function loadExhibition(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Couldn't load ${url} (HTTP ${response.status})`);
  return normalizeExhibition(await response.json());
}

const niceName = name => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });

// Photos picked on this device. Picking a folder makes each subfolder a room;
// otherwise the photos go 8 to a room in the order they were taken (or saved).
// Floors are added as needed: 8 rooms each.
export function exhibitionFromFiles(fileList) {
  const files = [...fileList].filter(file => file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(file.name));
  if (!files.length) return null;
  const photo = file => ({ src: '', file, title: niceName(file.name), date: '', caption: '', aspect: null });
  const folderOf = file => {
    const parts = (file.webkitRelativePath || '').split('/');
    return parts.length > 2 ? parts.slice(1, -1).join(' / ') : '';
  };
  const rootFolder = (files[0].webkitRelativePath || '').split('/')[0];
  const rooms = [];
  if (files.some(folderOf)) {
    const folders = new Map();
    for (const file of files) {
      const name = folderOf(file) || rootFolder || 'Photos';
      if (!folders.has(name)) folders.set(name, []);
      folders.get(name).push(file);
    }
    for (const [name, list] of [...folders].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
      rooms.push({ name: niceName(name), photos: list.sort(byName).map(photo) });
    }
  } else {
    const sorted = files.sort((a, b) => a.lastModified - b.lastModified || byName(a, b));
    for (let i = 0; i < sorted.length; i += PER_ROOM_FROM_FILES) {
      rooms.push({ name: `Room ${rooms.length + 1}`, photos: sorted.slice(i, i + PER_ROOM_FROM_FILES).map(photo) });
    }
  }
  // a folder with more photos than fit on the walls continues in the next room
  const split = rooms.flatMap(room => Array.from({ length: Math.ceil(room.photos.length / MAX_PER_ROOM) }, (_, k) => ({
    name: k ? `${room.name} (${k + 1})` : room.name,
    photos: room.photos.slice(k * MAX_PER_ROOM, (k + 1) * MAX_PER_ROOM),
  })));
  return finish(rootFolder ? niceName(rootFolder) : 'My Photos', `${files.length} photo${files.length === 1 ? '' : 's'}`, split.map(room => ({ ...room, color: null })));
}
