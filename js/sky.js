// The sky seen through the glass roofs. It is drawn by the roof glass itself (the glass shows
// the sky in the direction you look), so nothing behind the roof can show through. It follows the visitor's own clock:
// by day a blue sky with the sun and slowly drifting clouds; at dusk and dawn warm colours;
// at night stars, a faint Milky Way and the moon in its real phase for the date.
// The moon map is NASA's (CGI Moon Kit, public domain), in assets/sky.
import * as THREE from 'three';

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const fragment = /* glsl */ `
uniform vec3 uSun, uMoon;
uniform float uDay, uDusk, uTime, uPhase, uMoonRadius;
uniform sampler2D uMoonMap;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) { v += a * noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

// cloud cover at a point on the cloud layer: billowy, with wisps blown by the wind
float clouds(vec2 p) {
  vec2 wind = vec2(uTime * 0.006, uTime * 0.0025);
  vec2 q = vec2(fbm(p * 0.9 + wind), fbm(p * 0.9 + vec2(5.2, 1.3) - wind));
  float d = fbm(p * 1.3 + 1.6 * q + wind * 1.7);
  return smoothstep(0.48, 0.78, d);
}

vec3 stars(vec3 d) {
  vec3 col = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 160.0 : 380.0;
    vec3 p = d * scale, cell = floor(p);
    float h = hash3(cell);
    float threshold = layer == 0 ? 0.988 : 0.978;
    if (h > threshold) {
      vec3 star = cell + 0.25 + 0.5 * vec3(hash3(cell + 1.7), hash3(cell + 3.1), hash3(cell + 5.3));
      float dist = length(p - star), pixel = length(fwidth(p));
      float size = pixel * (layer == 0 ? 1.6 : 1.1); // about a pixel or two across, at any screen size
      float b = smoothstep(size, 0.0, dist) * (layer == 0 ? 2.4 : 1.0) * (0.25 + 0.75 * (h - threshold) / (1.0 - threshold));
      b *= 0.75 + 0.25 * sin(uTime * (1.5 + 3.0 * h) + h * 40.0); // twinkle
      float t = hash3(cell + 9.1); // a little colour: bluish-white to warm
      col += b * mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), t);
    }
  }
  // a faint Milky Way across the sky
  vec3 axis = normalize(vec3(0.35, 0.25, 0.9));
  float band = exp(-pow(dot(d, axis) / 0.22, 2.0));
  float dust = fbm(d.xz * 6.0 + d.y * 3.0);
  col += vec3(0.05, 0.055, 0.07) * band * smoothstep(0.35, 0.8, dust);
  return col;
}

vec3 moon(vec3 d) {
  float c = dot(d, uMoon), cr = cos(uMoonRadius);
  float fullness = 0.35 + 0.65 * (1.0 - abs(uPhase - 0.5) * 2.0); // fuller moon, brighter halo
  vec3 glow = (vec3(0.16, 0.17, 0.2) * pow(max(c, 0.0), 2500.0) + vec3(0.03, 0.035, 0.05) * pow(max(c, 0.0), 120.0)) * fullness;
  if (c < cr) return glow * 0.6;
  vec3 right = normalize(cross(vec3(0, 1, 0), uMoon)), up = cross(uMoon, right);
  vec2 xy = vec2(dot(d, right), dot(d, up)) / sin(uMoonRadius);
  float r2 = dot(xy, xy);
  vec3 n = vec3(xy, sqrt(max(0.0, 1.0 - r2)));       // the moon's surface, facing us
  float a = uPhase * 6.2831853;                         // 0 new, 0.5 full
  vec3 light = normalize(vec3(sin(a), 0.0, -cos(a)));
  float lit = smoothstep(-0.03, 0.08, dot(n, light));
  vec2 uv = vec2(0.5 + atan(n.x, n.z) / 6.2831853, 0.5 + asin(clamp(n.y, -1.0, 1.0)) / 3.1415927);
  vec3 surface = texture2D(uMoonMap, uv).rgb;
  float edge = smoothstep(1.0, 0.96, r2);
  return mix(glow, surface * vec3(1.0, 0.97, 0.9) * (lit * 2.3 + 0.05), edge);
}

void main() {
  vec3 d = normalize(vDir);
  float up = max(d.y, 0.0);
  float sunDot = max(dot(d, uSun), 0.0);

  // the sky's colour: deep blue overhead, paler towards the horizon; warm at dusk; dark at night
  vec3 dayZenith = vec3(0.16, 0.36, 0.74), dayHorizon = vec3(0.62, 0.76, 0.9);
  vec3 duskZenith = vec3(0.2, 0.22, 0.42), duskHorizon = vec3(0.98, 0.58, 0.34);
  vec3 nightZenith = vec3(0.012, 0.02, 0.045), nightHorizon = vec3(0.03, 0.045, 0.08);
  float toHorizon = pow(1.0 - up, 2.5);
  vec3 sky = mix(mix(nightZenith, nightHorizon, toHorizon), mix(dayZenith, dayHorizon, toHorizon), uDay);
  sky = mix(sky, mix(duskZenith, duskHorizon, toHorizon), uDusk);
  // light scattered round the sun, and the sun itself
  sky += vec3(1.0, 0.85, 0.6) * (pow(sunDot, 8.0) * 0.18 + pow(sunDot, 120.0) * 0.5) * max(uDay, uDusk);
  sky += vec3(1.0, 0.97, 0.9) * smoothstep(0.99955, 0.9998, sunDot) * 6.0 * uDay;

  float night = pow(1.0 - max(uDay, uDusk), 2.0);
  sky += (stars(d) + moon(d)) * night * smoothstep(-0.01, 0.05, d.y);

  // the cloud layer
  if (d.y > 0.01) {
    vec2 p = d.xz / (d.y + 0.08) * 1.6;
    float c = clouds(p);
    if (c > 0.001) {
      vec2 toSun = normalize(uSun.xz + 1e-4) * 0.18;
      float shade = clamp(1.0 - (clouds(p + toSun) - c) * 1.6, 0.0, 1.0); // self-shadowing: darker away from the sun
      float thick = smoothstep(0.0, 1.0, c);
      vec3 lit = mix(vec3(1.0), vec3(1.0, 0.66, 0.52), uDusk);
      vec3 shadow = mix(vec3(0.55, 0.6, 0.68), vec3(0.45, 0.32, 0.42), uDusk);
      vec3 cloud = mix(shadow, lit, shade * (1.0 - 0.45 * thick));
      cloud += vec3(1.0, 0.9, 0.75) * pow(sunDot, 12.0) * 0.6 * (1.0 - thick); // bright edges near the sun
      vec3 nightCloud = vec3(0.035, 0.04, 0.055) * (0.6 + 0.4 * shade) + vec3(0.05) * pow(max(dot(d, uMoon), 0.0), 30.0);
      cloud = mix(nightCloud, cloud, max(uDay, uDusk));
      float alpha = c * smoothstep(0.01, 0.2, d.y) * mix(0.55, 0.95, max(uDay, uDusk));
      sky = mix(sky, cloud, alpha);
    }
  }
  // below the horizon (seen through the glazed front doors): a paved square outside, hazy in the distance
  float daylight = max(uDay, uDusk * 0.6);
  vec3 ground = mix(vec3(0.025, 0.025, 0.03), mix(vec3(0.5, 0.47, 0.42), vec3(0.62, 0.5, 0.4), uDusk), daylight);
  ground *= 0.85 + 0.15 * noise(d.xz / min(-d.y, -0.02) * 3.0);
  sky = mix(sky, ground, smoothstep(0.0, -0.04, d.y));
  gl_FragColor = vec4(sky * 0.94 + vec3(0.015, 0.02, 0.025), 1.0); // seen through slightly tinted glass
}`;

// the moon's phase for a date: 0 new, 0.5 full (from a known new moon and the synodic month)
export function moonPhase(date) {
  const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  return ((days / 29.530588853) % 1 + 1) % 1;
}

const direction = (azimuth, elevation) => new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation));

export class Sky {
  constructor() {
    const moonMap = new THREE.TextureLoader().load('assets/sky/moon.jpg');
    moonMap.colorSpace = THREE.SRGBColorSpace;
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, 1, 0) },
      uDay: { value: 1 }, uDusk: { value: 0 }, uTime: { value: 0 }, uPhase: { value: 0.5 },
      uMoonRadius: { value: THREE.MathUtils.degToRad(1.6) }, uMoonMap: { value: moonMap },
    };
    // the roof glass: shows the sky in the direction of view
    this.material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: this.uniforms, side: THREE.DoubleSide });
    this.material.userData.shared = true;
    const hour = Number(new URLSearchParams(location.search).get('time'));
    this.fixedHour = Number.isFinite(hour) && new URLSearchParams(location.search).has('time') ? hour : null;
    this.setTime(new Date());
  }

  // where the sun and moon are at this time of day (the sky turns with the visitor's clock)
  setTime(date) {
    const hour = this.fixedHour ?? date.getHours() + date.getMinutes() / 60;
    const rise = 6.5, set = 19.0;
    const t = (hour - rise) / (set - rise); // 0 at sunrise, 1 at sunset
    const elevation = Math.sin(Math.PI * t) * THREE.MathUtils.degToRad(58) - (t < 0 || t > 1 ? 0.3 : 0);
    const azimuth = Math.PI / 2 + Math.PI * THREE.MathUtils.clamp(t, -0.2, 1.2);
    this.uniforms.uSun.value.copy(direction(azimuth, elevation));
    const s = Math.sin(elevation);
    this.uniforms.uDay.value = THREE.MathUtils.smoothstep(s, -0.02, 0.22);
    this.uniforms.uDusk.value = Math.max(0, 1 - Math.abs(s - 0.02) / 0.16) * 0.85;
    // the moon crosses the night sky high up, so it shows through the glass roofs
    const night = ((hour - set + 24) % 24) / (24 - (set - rise)); // 0 at sunset, 1 at sunrise
    this.uniforms.uMoon.value.copy(direction(Math.PI * (0.8 + 0.4 * THREE.MathUtils.clamp(night, 0, 1)), THREE.MathUtils.degToRad(60)));
    let phase = moonPhase(date);
    if (Math.abs(phase - 0.5) > 0.38) phase = phase < 0.5 ? 0.12 : 0.88; // keep at least a thin crescent
    this.uniforms.uPhase.value = phase;
  }

  update(seconds) {
    this.uniforms.uTime.value = seconds;
    if (Math.floor(seconds) % 60 === 0 && Math.floor(seconds) !== this.lastMinute) { this.lastMinute = Math.floor(seconds); this.setTime(new Date()); }
  }
}
