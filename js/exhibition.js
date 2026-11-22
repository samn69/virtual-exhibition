// What's on show: the exhibition title, its rooms and the photos in each room.
// It comes from exhibition.json, or from photos picked on this device ("Your photos").
import { WALL_COLORS } from './building.js';

export const MAX_PER_ROOM = 12;   // what fits on a room's walls
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
  if (!rooms.length) rooms.push({ name: 'Room 1', color: null, photos: [] });
  rooms.forEach((room, i) => { room.color ||= WALL_COLORS[i % WALL_COLORS.length]; });
  return { title: text(data?.title) || 'My Exhibition', subtitle: text(data?.subtitle), rooms };
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
  split.forEach((room, i) => { room.color = WALL_COLORS[i % WALL_COLORS.length]; });
  return {
    title: rootFolder ? niceName(rootFolder) : 'My Photos',
    subtitle: `${files.length} photo${files.length === 1 ? '' : 's'}`,
    rooms: split,
  };
}
