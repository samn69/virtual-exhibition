// Wall outlines with arched doorways, and the stone frame around a doorway.
import * as THREE from 'three';

export function wallShape(halfLength, height, doors) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfLength, 0);
  for (const d of doors.filter(d => !d.bottom).sort((a, b) => a.u - b.u)) {
    shape.lineTo(d.u - d.width / 2, 0);
    shape.lineTo(d.u - d.width / 2, d.spring);
    shape.absarc(d.u, d.spring, d.width / 2, Math.PI, 0, true);
    shape.lineTo(d.u + d.width / 2, 0);
  }
  shape.lineTo(halfLength, 0); shape.lineTo(halfLength, height); shape.lineTo(-halfLength, height); shape.closePath();
  for (const d of doors.filter(d => d.bottom)) { // a door that starts above the floor is a hole
    const hole = new THREE.Path();
    hole.moveTo(d.u - d.width / 2, d.bottom);
    hole.lineTo(d.u + d.width / 2, d.bottom);
    hole.lineTo(d.u + d.width / 2, d.bottom + d.spring);
    hole.absarc(d.u, d.bottom + d.spring, d.width / 2, 0, Math.PI, false);
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}
export function archTrim(width, spring) {
  const outer = width / 2 + 0.2, inner = width / 2, shape = new THREE.Shape();
  shape.moveTo(-outer, 0); shape.lineTo(-outer, spring);
  shape.absarc(0, spring, outer, Math.PI, 0, true);
  shape.lineTo(outer, 0); shape.lineTo(inner, 0); shape.lineTo(inner, spring);
  shape.absarc(0, spring, inner, 0, Math.PI, false);
  shape.lineTo(-inner, 0); shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 20 });
}
