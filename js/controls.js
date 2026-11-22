// Walking around: drag to look, tap the floor to walk there, the joystick on phones,
// and arrow keys / WASD on a computer. Walls and benches stop you.
import * as THREE from 'three';
import { EYE_HEIGHT } from './building.js';

const SPEED = 2.2;       // metres per second
const TURN_SPEED = 1.8;  // radians per second for keys and joystick
const LOOK = 0.0045;     // radians per pixel dragged
const TAP_MOVE = 8, TAP_TIME = 450;

export class Walker {
  constructor(camera, canvas, { onTap, onMove } = {}) {
    this.camera = camera;
    camera.rotation.order = 'YXZ';
    this.canvas = canvas;
    this.onTap = onTap || (() => {});
    this.onMove = onMove || (() => {});
    this.yaw = 0; this.pitch = 0;
    this.x = 0; this.z = 0;
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.target = null;
    this.pointers = new Map();
    this.walkable = () => true;
    this.enabled = true;

    canvas.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false });
    });
    canvas.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > TAP_MOVE) p.moved = true;
      if (p.moved && this.pointers.keys().next().value === e.pointerId) { // only the first finger looks around
        this.yaw += dx * LOOK; // "grab" the view, like Street View
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * LOOK, -1.1, 1.1);
        this.onMove();
      }
    });
    const end = e => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (p && e.type === 'pointerup' && !p.moved && performance.now() - p.t < TAP_TIME) this.onTap(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    const keyName = e => e.code || e.key;
    addEventListener('keydown', e => {
      if (!this.enabled || e.target.closest?.('input,textarea,select,dialog[open]')) return;
      if (/^(Arrow(Up|Down|Left|Right)|Key[WASD])$/.test(keyName(e))) { this.keys.add(keyName(e)); e.preventDefault(); this.onMove(); }
    });
    addEventListener('keyup', e => this.keys.delete(keyName(e)));
    addEventListener('blur', () => this.keys.clear());
  }

  attachJoystick(element) {
    const knob = element.querySelector('.knob');
    let id = null, rect = null;
    const set = e => {
      const radius = rect.width / 2;
      let x = (e.clientX - rect.left - radius) / radius, y = (e.clientY - rect.top - radius) / radius;
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      this.stick = { x, y };
      knob.style.transform = `translate(${x * radius * 0.6}px, ${y * radius * 0.6}px)`;
      this.onMove();
    };
    element.addEventListener('pointerdown', e => { id = e.pointerId; rect = element.getBoundingClientRect(); element.setPointerCapture(id); set(e); e.preventDefault(); });
    element.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
    const release = e => { if (e.pointerId !== id) return; id = null; this.stick = { x: 0, y: 0 }; knob.style.transform = ''; };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
  }

  place({ x, z, yaw }) {
    this.x = x; this.z = z; this.yaw = yaw; this.pitch = 0; this.target = null;
    this.apply();
  }
  walkTo(x, z) { this.target = { x, z, since: performance.now() }; this.detour = 0; }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    let forward = 0, strafe = 0, turn = 0;
    if (k.has('ArrowUp') || k.has('KeyW')) forward += 1;
    if (k.has('ArrowDown') || k.has('KeyS')) forward -= 1;
    if (k.has('KeyA')) strafe -= 1;
    if (k.has('KeyD')) strafe += 1;
    if (k.has('ArrowLeft')) turn += 1;
    if (k.has('ArrowRight')) turn -= 1;
    // joystick: up and down walk, left and right turn
    if (Math.abs(this.stick.y) > 0.15) forward -= this.stick.y;
    if (Math.abs(this.stick.x) > 0.15) turn -= this.stick.x;
    this.yaw += turn * TURN_SPEED * dt;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let dx = -sin * forward + cos * strafe, dz = -cos * forward - sin * strafe;
    if (forward || strafe) this.target = null;
    else if (this.target) {
      dx = this.target.x - this.x; dz = this.target.z - this.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.08) { this.target = null; dx = dz = 0; }
      else {
        const ease = Math.min(1, distance / 0.6); // slow down when arriving
        dx = dx / distance * Math.max(ease, 0.25); dz = dz / distance * Math.max(ease, 0.25);
      }
    }
    const length = Math.hypot(dx, dz);
    if (length > 1) { dx /= length; dz /= length; }
    if (dx || dz) {
      const step = SPEED * Math.min(dt, 0.1); // a slow frame still walks at full speed, in steps short enough for collisions
      if (!this.target) this.tryMove(dx * step, dz * step);
      // walking to a tapped spot goes around benches; give up if it can't get there
      else if (!this.steer(dx * step, dz * step) || performance.now() - this.target.since > 15000) this.target = null;
    }
    this.apply();
  }

  // try the direct way, then turn further and further to one side until there's room;
  // keep to the same side so it doesn't wobble at a corner
  steer(dx, dz) {
    if (this.walkable(this.x + dx, this.z + dz)) { this.x += dx; this.z += dz; this.detour = 0; return true; }
    for (const angle of [Math.PI / 6, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3]) {
      for (const side of this.detour ? [this.detour] : [1, -1]) {
        const c = Math.cos(angle * side), s = Math.sin(angle * side);
        const rx = dx * c - dz * s, rz = dx * s + dz * c;
        if (this.walkable(this.x + rx, this.z + rz)) { this.x += rx; this.z += rz; this.detour = side; return true; }
      }
    }
    return false;
  }

  // slide along walls instead of stopping dead
  tryMove(dx, dz) {
    if (this.walkable(this.x + dx, this.z + dz)) { this.x += dx; this.z += dz; return true; }
    if (dx && this.walkable(this.x + dx, this.z)) { this.x += dx; return true; }
    if (dz && this.walkable(this.x, this.z + dz)) { this.z += dz; return true; }
    return false;
  }

  apply() {
    this.camera.position.set(this.x, EYE_HEIGHT, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
