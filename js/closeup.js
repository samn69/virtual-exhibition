// A close look at one photo: the camera glides up to it so the frame, its light and the plaque
// fill the screen, as if standing in front of it. Tap the plaque (or "Label") to step closer and
// read it. Swipe or use the arrows to glide along to the next photo in the room; tap elsewhere,
// ✕ or Esc to step back to where you were.
import * as THREE from 'three';

const SECONDS = 0.9;
const smooth = t => t * t * (3 - 2 * t);

export class Closeup {
  constructor({ camera, walker, overlay, artworks, onChange }) {
    Object.assign(this, { camera, walker, overlay, artworks, onChange: onChange || (() => {}) });
    this.item = null;
    this.reading = false; // close to the plaque
    this.raycaster = new THREE.Raycaster();
    this.tween = null;
    this.home = null; // where the visitor was standing

    let start = null;
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) start = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    overlay.addEventListener('pointerup', e => {
      if (!start || e.target !== overlay) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) this.step(dx < 0 ? 1 : -1);
      else if (Math.hypot(dx, dy) < 10) {
        // a tap on the plaque reads it (or steps back from it); anywhere else steps back
        const rect = overlay.getBoundingClientRect();
        this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
        if (this.item?.plaque && this.raycaster.intersectObject(this.item.plaque, false).length) this.toggleLabel();
        else if (this.reading) this.toggleLabel();
        else this.close();
      }
      start = null;
    });
    addEventListener('keydown', e => {
      if (!this.item || e.target.closest?.('input,textarea,select,dialog[open]')) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowLeft') this.step(-1);
      else if (e.key === 'ArrowRight') this.step(1);
      else return;
      e.preventDefault();
    });
  }

  get open() { return !!this.item; }

  // where the camera stands to see this photo whole
  poseFor(item) {
    const { group, bounds } = item;
    group.updateWorldMatrix(true, false);
    const centre = new THREE.Vector3((bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2, 0).applyMatrix4(group.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(group.matrixWorld);
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2), tanH = tanV * this.camera.aspect;
    const distance = Math.min(7, Math.max((bounds.y1 - bounds.y0) / 2 / tanV, (bounds.x1 - bounds.x0) / 2 / tanH) * 1.12 + 0.08);
    const position = centre.clone().addScaledVector(normal, distance);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position, centre, new THREE.Vector3(0, 1, 0)));
    return { position, quaternion };
  }

  // close enough to read the plaque
  labelPose(item) {
    const plaque = item.plaque;
    plaque.updateWorldMatrix(true, false);
    const centre = new THREE.Vector3().setFromMatrixPosition(plaque.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(plaque.matrixWorld);
    const { width, height } = plaque.geometry.parameters;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2), tanH = tanV * this.camera.aspect;
    const distance = Math.max(height / 2 / tanV, width / 2 / tanH) * 1.25 + 0.05;
    const position = centre.clone().addScaledVector(normal, distance);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position, centre, new THREE.Vector3(0, 1, 0)));
    return { position, quaternion };
  }
  toggleLabel() {
    if (!this.item?.plaque) return;
    this.reading = !this.reading;
    this.glideTo(this.reading ? this.labelPose(this.item) : this.poseFor(this.item));
    this.onChange(this.item);
  }

  glideTo(pose, onDone) {
    this.tween = { from: { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone() }, to: pose, t: 0, onDone };
  }

  show(item, { jump = false } = {}) {
    if (!item?.group) return;
    if (!this.item) {
      const w = this.walker;
      this.home = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone() };
      w.enabled = false; w.target = null; w.keys.clear();
      this.overlay.hidden = false;
    } else if (this.item !== item) this.artworks().releaseFull(this.item);
    this.item = item;
    this.reading = false;
    const pose = this.poseFor(item);
    if (jump) { this.tween = null; this.camera.position.copy(pose.position); this.camera.quaternion.copy(pose.quaternion); }
    else this.glideTo(pose);
    this.artworks().loadFull(item);
    this.onChange(item);
  }

  step(direction) {
    if (!this.item) return;
    const list = this.artworks().inRoom(this.item.room).filter(item => item.group);
    if (list.length < 2) return;
    this.show(list[(list.indexOf(this.item) + direction + list.length) % list.length]);
  }

  close({ jump = false } = {}) {
    if (!this.item) return;
    this.artworks().releaseFull(this.item);
    this.item = null;
    this.reading = false;
    this.overlay.hidden = true;
    this.onChange(null);
    const finish = () => { this.walker.enabled = true; this.walker.apply(); };
    if (jump) { this.tween = null; finish(); return; }
    this.glideTo(this.home, finish);
  }

  update(dt) {
    const tw = this.tween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / SECONDS);
    const s = smooth(tw.t);
    this.camera.position.lerpVectors(tw.from.position, tw.to.position, s);
    this.camera.quaternion.slerpQuaternions(tw.from.quaternion, tw.to.quaternion, s);
    if (tw.t >= 1) { this.tween = null; tw.onDone?.(); }
  }
}
