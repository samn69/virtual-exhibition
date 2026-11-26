// Edit mode, for the owner: sign in with Google, then add photos to the room you're standing in,
// change what their plaques say, move or remove them, and rename rooms and the exhibition.
// Every change is saved straight to the exhibition file in Google Drive.
import { Drive, SignInNeeded, loadGoogleSignIn, mockDrive } from './drive.js';
import { MAX_PER_ROOM, toManifest } from './exhibition.js';
import { openVisitors } from './visits.js';

const $ = id => document.getElementById(id);
const EXIF_LIBRARY = 'https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.esm.mjs';
const WALL_SIDE = 1600, FULL_SIDE = 4096;
const FIELDS = ['title', 'year', 'description', 'place', 'camera', 'lens', 'settings'];

const niceName = name => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

// ── reading a photo: its camera details, and two copies (for the wall, and full size) ──
// The copies are re-saved as JPEG, which also leaves out the location the camera stored in the
// file: the photos are public, so where they were taken stays private unless typed in.
function cameraDetails(tags) {
  if (!tags) return {};
  const make = (tags.Make || '').trim(), model = (tags.Model || '').trim();
  const camera = model ? (make && !model.toLowerCase().startsWith(make.toLowerCase().split(' ')[0]) ? `${make} ${model}` : model) : make;
  const settings = [];
  if (tags.FocalLength) settings.push(`${Math.round(tags.FocalLength * 10) / 10} mm`);
  if (tags.FNumber) settings.push(`f/${Math.round(tags.FNumber * 10) / 10}`);
  if (tags.ExposureTime) settings.push(tags.ExposureTime < 1 ? `1/${Math.round(1 / tags.ExposureTime)} s` : `${Math.round(tags.ExposureTime * 10) / 10} s`);
  const iso = Array.isArray(tags.ISO) ? tags.ISO[0] : tags.ISO;
  if (iso) settings.push(`ISO ${iso}`);
  const date = tags.DateTimeOriginal || tags.CreateDate;
  return {
    camera, lens: (tags.LensModel || '').trim(), settings: settings.join(' · '),
    year: date instanceof Date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : '',
  };
}

async function decode(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode(); // turned the right way up (the browser follows the camera's rotation)
    return image;
  } catch {
    throw new Error("This browser can't open that file. Please choose a JPEG, PNG or WebP photo (on an iPhone, photos are converted automatically).");
  } finally { URL.revokeObjectURL(url); }
}

function jpeg(image, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); // transparent PNGs on white
  g.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("Couldn't prepare the photo"))), 'image/jpeg', quality));
}

async function preparePhoto(file) {
  const [tags, image] = await Promise.all([
    import(EXIF_LIBRARY).then(m => m.default.parse(file, { pick: ['Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'DateTimeOriginal', 'CreateDate'] })).catch(() => null),
    decode(file),
  ]);
  const [wall, full] = await Promise.all([jpeg(image, WALL_SIDE, 0.86), jpeg(image, FULL_SIDE, 0.92)]);
  return { details: { title: niceName(file.name), ...cameraDetails(tags) }, wall, full, aspect: Math.round((image.naturalWidth / image.naturalHeight) * 1000) / 1000 };
}

export class Editor {
  // app: { exhibition(), zone(), apply(exhibition, { rebuild }), closeup }
  constructor(app) {
    this.app = app;
    this.drive = new Drive();
    this.editing = false;
    this.ready = false; // signed in, and the exhibition file found or made
    this.pending = null; // what to do after signing in again

    const owner = new URLSearchParams(location.search).has('edit') || localStorage.getItem('ve-owner') === '1';
    $('editButton').hidden = !owner;
    $('editButton').onclick = () => (this.editing ? this.stop() : this.start());
    $('signInButton').onclick = () => this.signIn();
    $('addPhotoButton').onclick = () => $('addPhotoInput').click();
    $('addPhotoInput').onchange = () => { const file = $('addPhotoInput').files[0]; $('addPhotoInput').value = ''; if (file) this.addPhoto(file); };
    $('renameButton').onclick = () => this.renameHere();
    $('editTitleButton').onclick = () => this.editTitle();
    $('visitorsButton').onclick = () => openVisitors(this.drive.token);
    $('closeupEdit').onclick = () => this.editPhoto(this.app.closeup.item);
    $('closeupLeft').onclick = () => this.movePhoto(this.app.closeup.item, -1);
    $('closeupRight').onclick = () => this.movePhoto(this.app.closeup.item, 1);
    $('closeupRemove').onclick = () => this.removePhoto(this.app.closeup.item);
  }

  // ── switching edit mode on and off ──
  start() {
    if (this.ready && this.drive.signedIn) { this.setEditing(true); return; }
    $('signInError').hidden = true;
    $('signInButton').disabled = true;
    $('signInDialog').showModal();
    loadGoogleSignIn().then(() => { $('signInButton').disabled = false; }, error => this.signInFailed(error));
  }
  stop() { this.setEditing(false); }
  setEditing(on) {
    const changed = this.editing !== on;
    this.editing = on;
    document.body.classList.toggle('editing', on);
    $('editButton').textContent = on ? 'Done' : 'Edit';
    this.update();
    if (changed) this.app.editingChanged?.();
  }
  signInFailed(error) { $('signInError').textContent = error.message; $('signInError').hidden = false; $('signInButton').disabled = false; }

  // straight from the button's click: Google's sign-in window
  async signIn() {
    $('signInButton').disabled = true;
    try {
      await this.drive.signIn();
    } catch (error) { this.signInFailed(error); return; }
    $('signInDialog').close();
    localStorage.setItem('ve-owner', '1');
    if (!this.ready) {
      try {
        this.busy('Opening your gallery in Google Drive…');
        const { id, created } = await this.drive.setUp(toManifest(this.app.exhibition()));
        this.ready = true;
        this.app.apply(this.fromDrive(await this.drive.readManifest()), { rebuild: 'all' });
        if (created && !mockDrive) this.notice('Your gallery is ready', `Your photos will be kept in a folder called “Virtual Exhibition” in your Google Drive. One more step for visitors to see them: send Claude this code, so it can be added to the website.`, id);
      } catch (error) { this.failed(error); return; } finally { this.busy(false); }
    }
    this.setEditing(true);
    const next = this.pending; this.pending = null;
    next?.();
  }

  fromDrive(data) { return this.app.normalize(data); }

  // which buttons fit where the visitor is
  update() {
    const zone = this.app.zone() || '', inRoom = zone.startsWith('r');
    const room = inRoom ? this.app.exhibition().rooms[Number(zone.slice(1))] : null;
    $('editBar').hidden = !this.editing;
    $('addPhotoButton').hidden = !inRoom;
    $('renameButton').hidden = !inRoom;
    $('editTitleButton').hidden = inRoom;
    $('editBarNote').textContent = inRoom
      ? `${room.photos.length} of ${MAX_PER_ROOM} photos in this room`
      : 'Walk into a room to add photos to it';
    $('closeupTools').hidden = !this.editing;
  }

  // ── saving: read the latest exhibition file, change it, save it, show it ──
  async change(label, mutate, { rebuild = 'photos', after } = {}) {
    try {
      this.busy(label);
      const data = await this.drive.readManifest();
      const result = mutate(data);
      if (result === false) return;
      await this.drive.saveManifest(data);
      this.app.apply(this.fromDrive(data), { rebuild });
      after?.(data);
    } catch (error) {
      if (error instanceof SignInNeeded) { this.pending = () => this.change(label, mutate, { rebuild, after }); this.start(); }
      else this.failed(error);
    } finally { this.busy(false); }
  }

  // ── adding a photo to the room you're in ──
  async addPhoto(file) {
    const zone = this.app.zone();
    if (!zone?.startsWith('r')) return;
    let prepared;
    try {
      this.busy('Reading the photo…');
      prepared = await preparePhoto(file);
    } catch (error) { this.failed(error); return; } finally { this.busy(false); }
    const preview = URL.createObjectURL(prepared.wall);
    const answer = await this.photoForm({ heading: 'Add a photo', preview, values: prepared.details, room: Number(zone.slice(1)), save: 'Add to the wall' });
    URL.revokeObjectURL(preview);
    if (!answer) return;
    const uploaded = [];
    try {
      this.busy('Uploading the photo…');
      const name = (answer.values.title || 'Photo').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80);
      uploaded.push(await this.drive.upload(prepared.full, `${name}.jpg`));
      uploaded.push(await this.drive.upload(prepared.wall, `${name} (wall).jpg`));
    } catch (error) {
      this.busy(false);
      for (const id of uploaded) this.drive.trash(id).catch(() => {});
      if (error instanceof SignInNeeded) { this.pending = () => this.addPhoto(file); this.start(); } else this.failed(error);
      return;
    }
    const [full, wall] = uploaded;
    await this.change('Hanging it on the wall…', data => {
      const photos = data.rooms[answer.room].photos ||= [];
      if (photos.length >= MAX_PER_ROOM) { this.failed(new Error('That room is full (16 photos). Choose another room.')); return false; }
      photos.push({ wall, full, aspect: prepared.aspect, ...answer.values });
    }, { after: () => this.lookAt(answer.room, this.app.exhibition().rooms[answer.room].photos.length - 1) });
  }

  // ── changing a photo's details, or its room ──
  async editPhoto(item) {
    if (!item) return;
    const room = item.room, index = item.index, photo = item.photo;
    const values = Object.fromEntries(FIELDS.map(field => [field, photo[field] || '']));
    const answer = await this.photoForm({ heading: 'Photo details', preview: photo.url || null, values, room, save: 'Save' });
    if (!answer) return;
    await this.change('Saving…', data => {
      const from = data.rooms[room].photos;
      const saved = from[index];
      if (!saved) return false;
      for (const field of FIELDS) { if (answer.values[field]) saved[field] = answer.values[field]; else delete saved[field]; }
      if (answer.room !== room) {
        const to = data.rooms[answer.room].photos ||= [];
        if (to.length >= MAX_PER_ROOM) { this.failed(new Error('That room is full (16 photos). Choose another room.')); return false; }
        from.splice(index, 1); to.push(saved);
      }
    }, { after: () => (answer.room === room ? this.lookAt(room, index) : this.app.closeup.close({ jump: true })) });
  }

  // ── moving a photo one place along the walls ──
  async movePhoto(item, step) {
    if (!item) return;
    const room = item.room, index = item.index, to = index + step;
    if (to < 0 || to >= this.app.exhibition().rooms[room].photos.length) return;
    await this.change('Moving…', data => {
      const photos = data.rooms[room].photos;
      [photos[index], photos[to]] = [photos[to], photos[index]];
    }, { after: () => this.lookAt(room, to) });
  }

  // ── taking a photo down ──
  async removePhoto(item) {
    if (!item) return;
    const { room, index, photo } = item;
    if (!confirm(`Remove “${photo.title || 'Untitled'}” from the gallery?\n\nIt goes to the bin in your Google Drive, where it's kept for 30 days.`)) return;
    this.app.closeup.close({ jump: true });
    await this.change('Removing…', data => {
      const [removed] = data.rooms[room].photos.splice(index, 1);
      if (!removed) return false;
      Promise.all([this.drive.trash(removed.wall), this.drive.trash(removed.full)]).catch(error => console.warn('Could not move the files to the bin', error));
    });
  }

  // ── names ──
  async renameHere() {
    const zone = this.app.zone();
    if (!zone?.startsWith('r')) return;
    const room = Number(zone.slice(1));
    const answer = await this.textForm({ heading: 'Room name', fields: [{ name: 'name', label: 'Name', value: this.app.exhibition().rooms[room].name, required: true }] });
    if (!answer) return;
    await this.change('Saving…', data => { data.rooms[room].name = answer.name; }, { rebuild: 'all' });
  }
  async editTitle() {
    const ex = this.app.exhibition();
    const answer = await this.textForm({ heading: 'Exhibition title', fields: [
      { name: 'title', label: 'Title', value: ex.title, required: true },
      { name: 'subtitle', label: 'Subtitle', value: ex.subtitle },
    ] });
    if (!answer) return;
    await this.change('Saving…', data => { data.title = answer.title; data.subtitle = answer.subtitle; }, { rebuild: 'all' });
  }

  // show a photo close up once it's on the wall (its frame is made when the photo has loaded)
  async lookAt(room, index) {
    const jump = this.app.closeup.open;
    for (let tries = 0; tries < 60; tries++) {
      const item = this.app.findPhoto(room, index);
      if (item?.group) { this.app.closeup.show(item, { jump }); return; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  // ── the forms ──
  photoForm({ heading, preview, values, room, save }) {
    const dialog = $('photoDialog'), form = $('photoForm');
    $('photoHeading').textContent = heading;
    $('photoPreview').hidden = !preview;
    if (preview) $('photoPreview').src = preview;
    for (const field of FIELDS) form.elements[field].value = values[field] || '';
    const select = form.elements.room;
    select.replaceChildren(...this.app.exhibition().rooms.map((r, k) => {
      const option = document.createElement('option');
      option.value = k;
      option.textContent = `${r.name}${this.app.floors() > 1 ? ` · Floor ${Math.floor(k / 8) + 1}` : ''} (${r.photos.length})`;
      return option;
    }));
    select.value = room;
    $('photoSave').textContent = save;
    dialog.showModal();
    return new Promise(resolve => {
      const done = answer => { form.onsubmit = null; dialog.onclose = null; if (dialog.open) dialog.close(); resolve(answer); };
      form.onsubmit = e => {
        e.preventDefault();
        done({ values: Object.fromEntries(FIELDS.map(field => [field, form.elements[field].value.trim()])), room: Number(select.value) });
      };
      dialog.onclose = () => done(null);
    });
  }

  textForm({ heading, fields }) {
    const dialog = $('textDialog'), form = $('textForm');
    $('textHeading').textContent = heading;
    $('textFields').replaceChildren(...fields.map(field => {
      const label = document.createElement('label');
      label.textContent = field.label;
      const input = document.createElement('input');
      Object.assign(input, { name: field.name, value: field.value || '', required: !!field.required, maxLength: 80, autocomplete: 'off' });
      label.append(input);
      return label;
    }));
    dialog.showModal();
    return new Promise(resolve => {
      const done = answer => { form.onsubmit = null; dialog.onclose = null; if (dialog.open) dialog.close(); resolve(answer); };
      form.onsubmit = e => { e.preventDefault(); done(Object.fromEntries(fields.map(field => [field.name, form.elements[field.name].value.trim()]))); };
      dialog.onclose = () => done(null);
    });
  }

  busy(message) {
    $('busy').hidden = !message;
    if (message) $('busyText').textContent = message;
  }
  failed(error) {
    console.error(error);
    this.notice('Something went wrong', error.message || String(error));
  }
  notice(heading, text, code = '') {
    $('noticeHeading').textContent = heading;
    $('noticeText').textContent = text;
    $('noticeCode').hidden = !code;
    $('noticeCode').textContent = code;
    $('noticeDialog').showModal();
  }
}
