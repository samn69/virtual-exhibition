// The marble relief on the stair landing: the goddess Roma from the Vittoriano in Rome, with her
// spear and a little bronze Victory, cut out of a photo and raised from a depth map (rounded from
// her outline, with the folds of her robe from the photo's shading). It stands in an arched niche
// lined with gold mosaic, built in stairs.js.
// assets/relief/roma.png: the cut-out figure, transparent round it
// assets/relief/roma-depth.png: how far each point stands out (white = furthest)
import * as THREE from 'three';

async function pixels(url) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(bitmap, 0, 0);
  return { data: g.getImageData(0, 0, bitmap.width, bitmap.height).data, width: bitmap.width, height: bitmap.height };
}

// the figure stands on y = 0, centred on x = 0, its back on z = 0 and facing +z. It is kept
// shallow: a deeper relief stretches the side facing you, and from the stairs her head looked shrunken
export async function romaRelief({ height = 2.85, depth = 0.04 } = {}) {
  const [map, d] = await Promise.all([new THREE.TextureLoader().loadAsync('assets/relief/roma.png'), pixels('assets/relief/roma-depth.png')]);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const width = height * d.width / d.height;
  const g = new THREE.PlaneGeometry(width, height, Math.round(d.width / 3), Math.round(d.height / 3));
  const pos = g.attributes.position, uv = g.attributes.uv;
  const at = (x, y) => d.data[4 * (Math.min(d.height - 1, Math.max(0, y)) * d.width + Math.min(d.width - 1, Math.max(0, x)))] / 255;
  for (let i = 0; i < pos.count; i++) {
    const fx = uv.getX(i) * (d.width - 1), fy = (1 - uv.getY(i)) * (d.height - 1);
    const x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y;
    const v = (at(x, y) * (1 - tx) + at(x + 1, y) * tx) * (1 - ty) + (at(x, y + 1) * (1 - tx) + at(x + 1, y + 1) * tx) * ty;
    pos.setZ(i, v * depth);
  }
  g.translate(0, height / 2, 0);
  g.computeVertexNormals();
  // the photo already has the light and shade of the carving, so it is lit gently on top of that
  const material = new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: '#8a8276', alphaTest: 0.5 });
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'Roma relief';
  return mesh;
}
