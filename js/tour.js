// The guided tour: ▶ walks the visitor round the gallery by itself, photo by photo, in visiting
// order (room 1, 2, 3 … and up the stairs). At each photo it shows the photo on the wall, then
// its label, then the photo full screen, a few seconds each, then steps back and walks on.
// ⏸, or any touch on the gallery, stops it where it is. ▶ then carries on from that photo, or
// from the start of the room the visitor has walked into since. A fresh visit starts from the
// beginning (or from the room the visitor is standing in).
import { EYE, HALL_HALF } from './constants.js';

const $ = id => document.getElementById(id);
const SPEEDS = [{ name: 'Slow', seconds: 7 }, { name: 'Normal', seconds: 5 }, { name: 'Fast', seconds: 3 }];
const SPEED_KEY = 've-tour-speed';
const WALK = 1.5;        // metres per second
const ACCEL = 1.1;       // metres per second, per second
const TURN = 3.2;        // how quickly the view turns to where it's going
const LOOK_AHEAD = 1.4;  // metres: look this far along the way
const CELL = 0.25;       // the route-finding grid, in metres

const smooth = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.min(1, Math.max(0, t));
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const angleLerp = (a, b, t) => a + angleDiff(a, b) * t;
const hasLabel = photo => ['title', 'year', 'description', 'place', 'camera', 'lens', 'settings'].some(k => String(photo[k] || '').trim());

// ── finding the way: a grid of where a visitor can stand on each floor, kept a little further
// from walls, door frames and plants than walking by hand needs, so the tour walks through the
// middle of doorways ──
class Planner {
  constructor(museum) { this.museum = museum; this.grids = new Map(); }

  grid(f) {
    if (this.grids.has(f)) return this.grids.get(f);
    const x0 = -(HALL_HALF + 22), z0 = -25, nx = Math.ceil(-2 * x0 / CELL), nz = Math.ceil((22 - z0) / CELL);
    const raw = new Uint8Array(nx * nz), open = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) raw[j * nx + i] = this.museum.walkable(f, x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL) ? 1 : 0;
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      let all = 1;
      for (let dj = -1; dj <= 1 && all; dj++) for (let di = -1; di <= 1; di++) if (!raw[(j + dj) * nx + i + di]) { all = 0; break; }
      open[j * nx + i] = all;
    }
    const g = { f, x0, z0, nx, nz, raw, open };
    this.grids.set(f, g);
    return g;
  }

  cellOf(g, x, z) { return [Math.floor((x - g.x0) / CELL), Math.floor((z - g.z0) / CELL)]; }
  centre(g, i, j) { return [g.x0 + (i + 0.5) * CELL, g.z0 + (j + 0.5) * CELL]; }
  isOpen(g, x, z) {
    const [i, j] = this.cellOf(g, x, z);
    return i >= 0 && j >= 0 && i < g.nx && j < g.nz && !!g.open[j * g.nx + i];
  }
  // the open spot nearest to (x, z), searching outwards up to 3 metres
  nearest(g, x, z) {
    const [ci, cj] = this.cellOf(g, x, z);
    let best = null, bestD = Infinity;
    for (let r = 0; r <= 12; r++) {
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || i < 0 || j < 0 || i >= g.nx || j >= g.nz || !g.open[j * g.nx + i]) continue;
        const [px, pz] = this.centre(g, i, j), d = (px - x) ** 2 + (pz - z) ** 2;
        if (d < bestD) { bestD = d; best = [i, j]; }
      }
      if (best) return best;
    }
    return null;
  }
  // a straight line that stays on open ground (raw: on any walkable ground)
  clear(g, [ax, az], [bx, bz], raw = false) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL / 2));
    for (let k = 1; k < steps; k++) {
      const t = k / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (raw ? !this.museum.walkable(g.f, x, z) : !this.isOpen(g, x, z)) return false;
    }
    return true;
  }

  // the way from one spot to another on floor f, as a list of [x, z] points
  route(f, from, to) {
    const g = this.grid(f), s = this.nearest(g, ...from), t = this.nearest(g, ...to);
    if (!s || !t) return [from, to];
    const cells = this.astar(g, s, t);
    if (!cells) return [from, to];
    const points = [from, ...cells.slice(1, -1).map(([i, j]) => this.centre(g, i, j)), to];
    // pull the string tight: go straight wherever nothing is in the way
    const tight = [points[0]];
    for (let i = 0; i < points.length - 1;) {
      let j = i + 1;
      while (j + 1 < points.length && this.clear(g, points[i], points[j + 1])) j++;
      tight.push(points[j]);
      i = j;
    }
    return this.round(g, tight);
  }

  // round the corners so the walk curves through doorways instead of turning sharply
  round(g, points, radius = 0.9) {
    if (points.length < 3) return points;
    const out = [points[0]];
    for (let k = 1; k < points.length - 1; k++) {
      const [ax, az] = points[k - 1], [bx, bz] = points[k], [cx, cz] = points[k + 1];
      const l1 = Math.hypot(bx - ax, bz - az), l2 = Math.hypot(cx - bx, cz - bz);
      const d1 = Math.min(radius, l1 / 2), d2 = Math.min(radius, l2 / 2);
      const p = [bx - (bx - ax) / l1 * d1, bz - (bz - az) / l1 * d1], q = [bx + (cx - bx) / l2 * d2, bz + (cz - bz) / l2 * d2];
      const curve = [];
      for (let n = 0; n <= 6; n++) {
        const t = n / 6, u = 1 - t;
        curve.push([u * u * p[0] + 2 * u * t * bx + t * t * q[0], u * u * p[1] + 2 * u * t * bz + t * t * q[1]]);
      }
      const ok = curve.every((pt, n) => !n || this.clear(g, curve[n - 1], pt, true));
      out.push(...(ok ? curve : [points[k]]));
    }
    out.push(points.at(-1));
    return out;
  }

  astar(g, [si, sj], [ti, tj]) {
    const { nx, open } = g, start = sj * nx + si, goal = tj * nx + ti;
    const cost = new Float32Array(open.length).fill(Infinity), came = new Int32Array(open.length).fill(-1);
    const h = c => { const dx = Math.abs(c % nx - ti), dz = Math.abs(Math.floor(c / nx) - tj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const heap = []; // [priority, cell], smallest first
    const push = item => { heap.push(item); let n = heap.length - 1; while (n) { const p = (n - 1) >> 1; if (heap[p][0] <= heap[n][0]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let n = 0; ;) {
          const l = 2 * n + 1, r = l + 1;
          let m = n;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === n) break;
          [heap[m], heap[n]] = [heap[n], heap[m]]; n = m;
        }
      }
      return top;
    };
    cost[start] = 0; push([h(start), start]);
    while (heap.length) {
      const [, c] = pop();
      if (c === goal) {
        const cells = [];
        for (let n = c; n !== -1; n = came[n]) cells.push([n % nx, Math.floor(n / nx)]);
        return cells.reverse();
      }
      const ci = c % nx, cj = Math.floor(c / nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ci + di, j = cj + dj, n = j * nx + i;
        if (i < 0 || j < 0 || i >= nx || j >= g.nz || !open[n]) continue;
        if (di && dj && (!open[cj * nx + i] || !open[j * nx + ci])) continue; // no cutting corners
        const next = cost[c] + (di && dj ? 1.414 : 1);
        if (next < cost[n]) { cost[n] = next; came[n] = c; push([next + h(n), n]); }
      }
    }
    return null;
  }
}

// a path of points, walked by distance along it
class Path {
  constructor(points) {
    this.points = points;
    this.at0 = [0];
    for (let k = 1; k < points.length; k++) this.at0.push(this.at0[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
    this.length = this.at0.at(-1);
  }
  at(s) {
    const { points, at0 } = this;
    if (s <= 0) return points[0];
    if (s >= this.length) return points.at(-1);
    let k = 1;
    while (at0[k] < s) k++;
    const t = (s - at0[k - 1]) / (at0[k] - at0[k - 1] || 1), a = points[k - 1], b = points[k];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
}

export class Tour {
  constructor({ camera, walker, closeup, museum, artworks, openFull, closeFull, isFull, banner }) {
    Object.assign(this, { camera, walker, closeup, museum, artworks, openFull, closeFull, isFull, banner });
    this.playing = false;
    this.saved = null;     // { room, index } of the photo the tour is at, once it has started
    this.phase = 'leave';
    this.timer = 0;
    this.legs = [];
    this.planner = null;
    this.speed = Math.max(0, SPEEDS.findIndex(s => s.name === localStorage.getItem(SPEED_KEY)));
    if (!localStorage.getItem(SPEED_KEY)) this.speed = 1;

    $('tourPlay').onclick = () => this.play();
    $('tourPause').onclick = () => this.pause();
    $('tourPrev').onclick = () => this.skip(-1);
    $('tourNext').onclick = () => this.skip(1);
    $('tourSpeed').onclick = () => {
      this.speed = (this.speed + 1) % SPEEDS.length;
      localStorage.setItem(SPEED_KEY, SPEEDS[this.speed].name);
      this.ui();
    };
    // any touch on the gallery, or a walking key, pauses the tour (not the tour's own buttons or the music)
    const own = '#tourDock, #musicPanel, #musicButton';
    addEventListener('pointerdown', e => {
      if (!this.playing || e.target.closest?.(own)) return;
      this.pause();
      // a tap on the photo being shown only pauses: it doesn't also step back from the wall
      if (e.target.id === 'closeup' || (e.target.closest?.('#fullView') && !e.target.closest('button'))) e.stopPropagation();
    }, true);
    addEventListener('keydown', e => {
      if (!this.playing || e.target.closest?.('input,textarea,select')) return;
      if (/^(Arrow(Up|Down|Left|Right)|Key[WASD]|Escape)$/.test(e.code || e.key)) this.pause();
    }, true);
    this.ui();
  }

  get seconds() { return SPEEDS[this.speed].seconds; }
  list() { return this.artworks()?.items || []; } // in visiting order: room by room, photo by photo
  indexOf(key) {
    const list = this.list();
    if (!key) return -1;
    const at = list.findIndex(i => i.room === key.room && i.index === key.index);
    return at >= 0 ? at : list.findIndex(i => i.room > key.room || (i.room === key.room && i.index > key.index));
  }
  get item() { return this.list()[this.indexOf(this.saved)] || null; }

  play() {
    const list = this.list();
    if (this.playing || !list.length) return;
    const w = this.walker, museum = this.museum();
    const zone = museum.zoneAt(w.floor, w.x, w.z);
    const roomHere = zone.startsWith('r') ? Number(zone.slice(1)) : null;
    const firstIn = room => list.findIndex(i => i.room === room);
    let at = this.indexOf(this.saved);
    if (at < 0) {
      // a new tour: from the room the visitor is in, else from the first room of this floor
      if (roomHere !== null && firstIn(roomHere) >= 0) at = firstIn(roomHere);
      else at = Math.max(0, list.findIndex(i => i.floor >= w.floor));
      this.go(at);
    } else if (roomHere !== null && roomHere !== list[at].room && firstIn(roomHere) >= 0) {
      this.go(firstIn(roomHere)); // walked into another room since: carry on from there
    } else if (this.phase === 'back') { // it had finished with that photo: on to the next
      if (at + 1 >= list.length) { this.finish(); return; }
      this.go(at + 1);
    } else if (!this.canContinue(list[at])) this.go(at); // back to the same photo, and show it again
    this.playing = true;
    w.hold = false;
    if (!this.closeup.open) w.enabled = false;
    this.ui();
  }

  // after a pause, can it carry on right where it stopped?
  canContinue(item) {
    const c = this.closeup;
    switch (this.phase) {
      case 'approach': case 'wall': return c.item === item && !c.reading && !this.isFull();
      case 'label': return c.item === item && c.reading && !this.isFull();
      case 'full': return c.item === item && this.isFull();
      case 'move': return !c.open && !this.isFull() && (this.walker.gliding ? this.legs[0]?.kind === 'stairs' : this.legs[0]?.paused === this.where());
      default: return false;
    }
  }
  where() { const w = this.walker; return `${w.floor},${w.x.toFixed(3)},${w.z.toFixed(3)},${w.yaw.toFixed(3)}`; }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.walker.hold = true; // a glide on the stairs stops where it is
    if (!this.closeup.open) { this.walker.enabled = true; this.walker.apply(); }
    if (this.legs[0]?.kind === 'walk') this.legs[0].paused = this.where();
    this.ui();
  }

  // on to another photo: step back from this one and walk there
  go(at) {
    const list = this.list();
    this.saved = { room: list[at].room, index: list[at].index };
    this.phase = 'leave';
    this.legs = [];
  }
  skip(direction) {
    const list = this.list(), at = this.indexOf(this.saved) + direction;
    if (at >= list.length) { this.finish(); return; }
    this.go(Math.max(0, at));
    if (!this.playing) this.play(); else this.ui();
  }
  finish() {
    this.playing = false;
    this.saved = null;
    this.legs = [];
    this.walker.hold = false;
    if (!this.closeup.open) { this.walker.enabled = true; this.walker.apply(); }
    this.banner('End of the tour');
    this.ui();
  }
  // the gallery was rebuilt (an edit): stop, but remember the photo
  interrupt() {
    this.playing = false;
    this.planner = null;
    this.legs = [];
    this.phase = 'leave';
    this.walker.hold = false;
    this.ui();
  }

  ui() {
    const touring = this.playing;
    document.body.classList.toggle('touring', touring);
    document.body.classList.toggle('tour-on', touring || !!this.saved); // playing, or paused part-way
    $('tourPlay').hidden = touring;
    $('tourPlay').textContent = this.saved ? '▶ Resume tour' : '▶ Guided tour';
    $('tourControls').hidden = !touring;
    $('tourSpeed').textContent = SPEEDS[this.speed].name;
    const item = this.item;
    if (item) {
      const inRoom = this.list().filter(i => i.room === item.room);
      $('tourInfo').textContent = `${this.museum().rooms[item.room]?.name || `Room ${item.room + 1}`} · ${inRoom.indexOf(item) + 1} of ${inRoom.length}`;
    }
  }

  // where to stand to look at a photo, and which way to face
  standFor(item) {
    const { slot } = item, nx = Math.sin(slot.rotationY), nz = Math.cos(slot.rotationY);
    const tanV = Math.tan((this.camera.fov * Math.PI) / 360), tanH = tanV * this.camera.aspect;
    const d = Math.min(4.5, Math.max(1.8, Math.max(slot.maxH / 2 / tanV, (slot.maxW + 1) / 2 / tanH) * 1.1));
    return { x: slot.position.x + nx * d, z: slot.position.z + nz * d, yaw: Math.atan2(nx, nz) };
  }

  // the legs of the walk to the next photo: across this floor, up or down the stairs, and on
  plan(item) {
    const museum = this.museum(), w = this.walker;
    this.planner ??= new Planner(museum);
    const stand = this.standFor(item), g = this.planner.grid(item.floor);
    if (!this.planner.isOpen(g, stand.x, stand.z)) {
      const cell = this.planner.nearest(g, stand.x, stand.z);
      if (cell) [stand.x, stand.z] = this.planner.centre(g, ...cell);
    }
    const legs = [];
    let floor = w.floor, at = [w.x, w.z];
    while (floor !== item.floor) {
      const dir = item.floor > floor ? 1 : -1, glide = museum.glidePath(floor, dir);
      const start = glide.path(0), end = glide.path(1);
      legs.push({ kind: 'walk', path: new Path(this.planner.route(floor, at, [start.x, start.z])), s: 0, v: 0 });
      legs.push({ kind: 'stairs', dir });
      floor += dir; at = [end.x, end.z];
    }
    legs.push({ kind: 'walk', path: new Path(this.planner.route(floor, at, [stand.x, stand.z])), s: 0, v: 0, face: stand.yaw });
    this.legs = legs;
  }

  update(dt) {
    if (!this.playing) return;
    const c = this.closeup, item = this.item;
    if (!item) { this.finish(); return; }
    switch (this.phase) {
      case 'leave': // back to walking: out of full screen and away from the wall
        if (this.isFull()) this.closeFull();
        if (c.open) c.close();
        if (c.tween || this.walker.gliding) return;
        this.walker.enabled = false; this.walker.target = null; this.walker.keys.clear();
        this.plan(item);
        this.phase = 'move';
        this.ui();
        return;
      case 'move': {
        const leg = this.legs[0];
        if (!leg) { this.phase = 'arrive'; this.timer = 0; return; }
        if (leg.kind === 'stairs') {
          if (!leg.started) {
            const glide = this.museum().glidePath(this.walker.floor, leg.dir);
            this.walker.glide(glide, glide.seconds || 7);
            leg.started = true;
          } else if (!this.walker.gliding) this.legs.shift();
        } else if (this.walk(leg, dt)) this.legs.shift();
        return;
      }
      case 'arrive': // the photo may still be loading
        if (!item.group) {
          this.artworks().want(item);
          this.timer += dt;
          if (this.timer > 12) { this.timer = 0; this.skip(1); }
          return;
        }
        this.timer = 0;
        c.show(item);
        this.phase = 'approach';
        return;
      case 'approach':
        if (!c.tween) { this.phase = 'wall'; this.timer = this.seconds; }
        return;
      case 'wall':
        if ((this.timer -= dt) > 0) return;
        if (item.plaque && hasLabel(item.photo)) { c.toggleLabel(); this.phase = 'label'; this.timer = this.seconds + 0.9; return; }
        this.startFull(item);
        return;
      case 'label':
        if ((this.timer -= dt) > 0) return;
        this.startFull(item);
        return;
      case 'full':
        if ((this.timer -= dt) > 0) return;
        this.closeFull();
        c.close();
        this.phase = 'back';
        return;
      case 'back': {
        if (c.tween) return;
        const list = this.list(), at = this.indexOf(this.saved) + 1;
        if (at >= list.length) this.finish(); else { this.go(at); this.ui(); }
        return;
      }
    }
  }

  startFull(item) {
    this.openFull();
    this.phase = 'full';
    this.timer = this.seconds;
    // fetch the next photo's full-size copy now, so it's sharp as soon as the tour gets there
    const next = this.list()[this.indexOf(this.saved) + 1];
    if (next) this.artworks().prefetchFull(next);
  }

  // one step along a walking leg; true once there (and facing the photo)
  walk(leg, dt) {
    const w = this.walker, path = leg.path;
    const [ax, az] = path.at(Math.min(path.length, leg.s + LOOK_AHEAD)), [px, pz] = path.at(leg.s);
    let target = Math.hypot(ax - px, az - pz) > 0.05 ? Math.atan2(-(ax - px), -(az - pz)) : w.yaw;
    if (leg.face !== undefined) target = angleLerp(target, leg.face, smooth(clamp01(1 - (path.length - leg.s) / 1.5)));
    // facing the wrong way at the start: turn first
    const turnFirst = leg.s === 0 && path.length > 0.3 && Math.abs(angleDiff(w.yaw, target)) > 0.5;
    w.yaw = angleLerp(w.yaw, target, 1 - Math.exp(-dt * TURN));
    w.pitch *= Math.exp(-dt * 3);
    if (!turnFirst) {
      leg.v = Math.min(WALK, leg.v + ACCEL * dt, Math.sqrt(2 * ACCEL * Math.max(0, path.length - leg.s)) + 0.1);
      leg.s = Math.min(path.length, leg.s + leg.v * dt);
    }
    const [x, z] = path.at(leg.s);
    w.x = x; w.z = z;
    const eye = this.museum().heightAt(w.floor, x, z) + EYE;
    w.y += (eye - w.y) * Math.min(1, dt * 9);
    w.apply();
    if (leg.s < path.length) return false;
    if (leg.face === undefined) return true;
    leg.settle = (leg.settle || 0) + dt;
    return Math.abs(angleDiff(w.yaw, leg.face)) < 0.03 || leg.settle > 1.2;
  }
}
