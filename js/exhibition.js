// What's on show: the exhibition title, its rooms and the photos in each room.
// It comes from the exhibition file in Google Drive, or from exhibition.json in this repo.
import { ROOMS_PER_FLOOR } from './constants.js';
import { fileUrl, photoUrl } from './drive.js';

export const MAX_PER_ROOM = 16;   // a room holds 1 to 8 photos in one row, up to 16 in two rows
const MAX_FLOORS = 8;
const PLAQUE_FIELDS = ['title', 'year', 'description', 'place', 'camera', 'lens', 'settings'];

const text = value => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');

function normalizePhoto(photo) {
  const out = {
    wall: text(photo.wall), full: text(photo.full), // ids of the two copies in Drive: for the wall, and full size
    src: text(photo.src),
    aspect: Number(photo.aspect) > 0 ? Number(photo.aspect) : null,
  };
  for (const field of PLAQUE_FIELDS) out[field] = text(photo[field]);
  out.year ||= text(photo.date);            // older exhibition files
  out.description ||= text(photo.caption);
  // where to load it from
  out.url = out.wall ? photoUrl(out.wall) : out.src;
  out.fullUrl = out.full ? photoUrl(out.full) : out.url;
  out.backupUrls = { [out.url]: out.wall && fileUrl(out.wall), [out.fullUrl]: out.full && fileUrl(out.full) }; // the API, if the image server fails
  return out;
}

export function normalizeExhibition(data) {
  const rooms = [];
  for (const room of Array.isArray(data?.rooms) ? data.rooms : []) {
    const photos = (Array.isArray(room?.photos) ? room.photos : []).filter(photo => photo && typeof photo === 'object').map(normalizePhoto);
    const name = text(room?.name) || `Room ${rooms.length + 1}`;
    const parts = Math.max(1, Math.ceil(photos.length / MAX_PER_ROOM)); // a full room continues in the next one
    for (let k = 0; k < parts; k++) rooms.push({ name: k ? `${name} (${k + 1})` : name, photos: photos.slice(k * MAX_PER_ROOM, (k + 1) * MAX_PER_ROOM) });
  }
  return finish(text(data?.title) || 'My Exhibition', text(data?.subtitle), rooms, Number.parseInt(data?.floors, 10));
}

// Every floor has 8 rooms. "floors" asks for a number of floors; there are always enough for
// all the rooms, and rooms without photos are left empty (named, ready to be filled).
function finish(title, subtitle, rooms, floorsWanted) {
  const needed = Math.ceil(rooms.length / ROOMS_PER_FLOOR) || 1;
  const floors = Math.min(MAX_FLOORS, Math.max(Number.isFinite(floorsWanted) && floorsWanted > 0 ? floorsWanted : 1, needed));
  rooms = rooms.slice(0, floors * ROOMS_PER_FLOOR);
  while (rooms.length < floors * ROOMS_PER_FLOOR) rooms.push({ name: `Room ${rooms.length + 1}`, photos: [] });
  return { title, subtitle, floors, rooms };
}

// the exhibition as it's saved in Drive: only what's needed, no addresses (they're made from the ids).
// Sample photos (no file) are left out.
export function toManifest(exhibition) {
  return {
    version: 1,
    title: exhibition.title, subtitle: exhibition.subtitle, floors: exhibition.floors,
    rooms: exhibition.rooms.map(room => ({
      name: room.name,
      photos: room.photos.filter(photo => photo.wall || photo.src).map(photo => {
        const out = photo.wall ? { wall: photo.wall, full: photo.full } : { src: photo.src };
        if (photo.aspect) out.aspect = photo.aspect;
        for (const field of PLAQUE_FIELDS) if (photo[field]) out[field] = photo[field];
        return out;
      }),
    })),
  };
}

export async function loadExhibition(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Couldn't load ${url} (HTTP ${response.status})`);
  return normalizeExhibition(await response.json());
}
