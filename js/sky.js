// The sky seen through the glass roofs. It is drawn by the roof glass itself (the glass shows
// the sky in the direction you look), so nothing behind the roof can show through. It follows the visitor's own clock:
// by day (from the real sunrise to sunset where the visitor is) a blue sky with the sun and slowly drifting clouds; at dusk and dawn warm colours;
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

// hashes without sin(): sin of large numbers loses precision on many GPUs and makes regular patterns
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float hash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
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
    float scale = layer == 0 ? 90.0 : 200.0;
    vec3 p = d * scale, cell = floor(p);
    float h = hash3(cell);
    float threshold = layer == 0 ? 0.985 : 0.988;
    if (h > threshold) {
      // the star sits on the sky sphere (not anywhere in its cell, which drew arcs and dashes)
      vec3 star = normalize(cell + 0.25 + 0.5 * vec3(hash3(cell + 1.7), hash3(cell + 3.1), hash3(cell + 5.3))) * scale;
      float dist = length(p - star), pixel = length(fwidth(p));
      float size = pixel * (layer == 0 ? 1.3 : 0.9); // about a pixel or two across, at any screen size
      float b = smoothstep(size, 0.0, dist) * (layer == 0 ? 1.6 : 0.7) * (0.3 + 0.7 * (h - threshold) / (1.0 - threshold));
      b *= 0.92 + 0.08 * sin(uTime * (0.4 + 0.8 * h) + h * 40.0); // a gentle, slow twinkle
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
const RAD = Math.PI / 180;

// Roughly where the visitor is, from the phone's time zone alone (no location permission):
// a city in that zone. Other zones use the middle of their hour, at a mid latitude.
const PLACES = {
  'Europe/Berlin': [52.5, 13.4], 'Europe/Vienna': [48.2, 16.4], 'Europe/Zurich': [47.4, 8.5], 'Europe/Paris': [48.9, 2.35],
  'Europe/London': [51.5, -0.1], 'Europe/Dublin': [53.3, -6.3], 'Europe/Madrid': [40.4, -3.7], 'Europe/Lisbon': [38.7, -9.1],
  'Europe/Rome': [41.9, 12.5], 'Europe/Amsterdam': [52.4, 4.9], 'Europe/Brussels': [50.8, 4.4], 'Europe/Copenhagen': [55.7, 12.6],
  'Europe/Stockholm': [59.3, 18.1], 'Europe/Oslo': [59.9, 10.8], 'Europe/Helsinki': [60.2, 24.9], 'Europe/Warsaw': [52.2, 21.0],
  'Europe/Prague': [50.1, 14.4], 'Europe/Budapest': [47.5, 19.0], 'Europe/Athens': [38.0, 23.7], 'Europe/Istanbul': [41.0, 29.0],
  'Europe/Moscow': [55.8, 37.6], 'Europe/Kiev': [50.5, 30.5], 'Europe/Kyiv': [50.5, 30.5],
  'Asia/Tehran': [35.7, 51.4], 'Asia/Dubai': [25.2, 55.3], 'Asia/Kolkata': [28.6, 77.2], 'Asia/Shanghai': [31.2, 121.5],
  'Asia/Tokyo': [35.7, 139.7], 'Asia/Seoul': [37.6, 127.0], 'Asia/Singapore': [1.3, 103.8], 'Asia/Hong_Kong': [22.3, 114.2],
  'Asia/Bangkok': [13.8, 100.5], 'Asia/Jakarta': [-6.2, 106.8], 'Asia/Karachi': [24.9, 67.0], 'Asia/Baghdad': [33.3, 44.4],
  'Asia/Riyadh': [24.7, 46.7], 'Asia/Jerusalem': [31.8, 35.2], 'Asia/Kabul': [34.5, 69.2], 'Asia/Baku': [40.4, 49.9],
  'Asia/Yerevan': [40.2, 44.5], 'Asia/Tbilisi': [41.7, 44.8],
  'America/New_York': [40.7, -74.0], 'America/Chicago': [41.9, -87.6], 'America/Denver': [39.7, -105.0],
  'America/Los_Angeles': [34.1, -118.2], 'America/Toronto': [43.7, -79.4], 'America/Vancouver': [49.3, -123.1],
  'America/Mexico_City': [19.4, -99.1], 'America/Sao_Paulo': [-23.5, -46.6], 'America/Argentina/Buenos_Aires': [-34.6, -58.4],
  'Africa/Cairo': [30.0, 31.2], 'Africa/Johannesburg': [-26.2, 28.0], 'Africa/Lagos': [6.5, 3.4], 'Africa/Nairobi': [-1.3, 36.8],
  'Australia/Sydney': [-33.9, 151.2], 'Australia/Melbourne': [-37.8, 145.0], 'Australia/Perth': [-31.95, 115.9],
  'Pacific/Auckland': [-36.8, 174.8],
};
const SOUTH = /^(Australia|Antarctica|Pacific\/(Auckland|Chatham|Fiji|Tongatapu)|America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima)|Africa\/(Johannesburg|Maputo|Harare|Windhoek|Lusaka))/;
function visitorPlace(date) {
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
  if (PLACES[zone]) return PLACES[zone];
  // the zone's standard time (the smaller of January's and July's offsets) gives the longitude
  const y = date.getFullYear(), standard = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
  return [SOUTH.test(zone) ? -30 : 45, -standard / 4];
}

// where the sun is in the sky at a moment, seen from a place (NOAA's formulas, good to a minute or so)
export function sunPosition(date, [lat, lon]) {
  const days = date.getTime() / 86400000 - 10957.5; // since 2000-01-01 12:00 UTC
  const g = (357.529 + 0.98560028 * days) * RAD; // the sun's mean anomaly
  const q = 280.459 + 0.98564736 * days;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD; // its longitude on the ecliptic
  const e = (23.439 - 0.00000036 * days) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * days) % 24 + 24) % 24;
  const hourAngle = (gmst * 15 + lon) * RAD - ra;
  const phi = lat * RAD;
  const elevation = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle));
  const azimuth = Math.atan2(-Math.sin(hourAngle), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(hourAngle)); // from north, towards east
  return { elevation, azimuth };
}

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

  // where the sun and moon are now: the real sun for the date and the visitor's time zone, so it is
  // dark from about four in a German November and light until half past nine in June
  setTime(now) {
    let date = now;
    if (this.fixedHour !== null) { date = new Date(now); date.setHours(Math.floor(this.fixedHour), Math.round((this.fixedHour % 1) * 60), 0, 0); }
    const place = this.place ||= visitorPlace(date);
    const { elevation, azimuth } = sunPosition(date, place);
    this.uniforms.uSun.value.copy(direction(azimuth, elevation));
    const s = Math.sin(elevation);
    this.uniforms.uDay.value = THREE.MathUtils.smoothstep(s, -0.02, 0.22);
    this.uniforms.uDusk.value = Math.max(0, 1 - Math.abs(s - 0.02) / 0.16) * 0.85;
    // the moon crosses the night sky high up, opposite the sun, so it shows through the glass roofs
    this.uniforms.uMoon.value.copy(direction(azimuth + Math.PI, THREE.MathUtils.degToRad(60)));
    let phase = moonPhase(date);
    if (Math.abs(phase - 0.5) > 0.38) phase = phase < 0.5 ? 0.12 : 0.88; // keep at least a thin crescent
    this.uniforms.uPhase.value = phase;
  }

  update(seconds) {
    this.uniforms.uTime.value = seconds;
    if (Math.floor(seconds) % 60 === 0 && Math.floor(seconds) !== this.lastMinute) { this.lastMinute = Math.floor(seconds); this.setTime(new Date()); }
  }
}
