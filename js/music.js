// Music in the gallery: quiet classical piano by default (free recordings kept with the site,
// see the README), or the owner's Spotify playlist. Browsers only allow sound after the
// visitor's first tap, click or key, so the music starts then. ♪ opens the controls.
const TRACKS = [
  { file: 'bach-goldberg-aria', title: 'Goldberg Variations: Aria', by: 'J. S. Bach · Kimiko Ishizaka' },
  { file: 'chopin-nocturne-op9-no2', title: 'Nocturne in E-flat, Op. 9 No. 2', by: 'Chopin · Frank Levy' },
  { file: 'bach-prelude-c-major', title: 'Prelude in C major, BWV 846', by: 'J. S. Bach · Kimiko Ishizaka' },
  { file: 'chopin-nocturne-op15-no2', title: 'Nocturne in F-sharp, Op. 15 No. 2', by: 'Chopin · Luke Faulkner' },
  { file: 'chopin-nocturne-op27-no2', title: 'Nocturne in D-flat, Op. 27 No. 2', by: 'Chopin · Frank Levy' },
];
const SPOTIFY = 'https://open.spotify.com/embed/playlist/3Y0kJ5Lujv3KMN2zJLOWKi?utm_source=generator&theme=0';
const VOLUME = 0.35;
const STORED = 've-music'; // 'off' once the visitor has paused it

const $ = id => document.getElementById(id);

const AUTO_CLOSE_MS = 6000; // the music panel closes this long after the last touch

export class Music {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'none';
    this.audio.volume = VOLUME;
    this.order = TRACKS.map((_, i) => i).sort(() => Math.random() - 0.5);
    this.at = 0;
    this.mode = 'classical'; // or 'spotify'
    this.wanted = localStorage.getItem(STORED) !== 'off';
    this.resumeOnShow = false;

    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('play', () => this.update());
    this.audio.addEventListener('pause', () => this.update());

    // the first tap, click or key anywhere lets the music start
    const begin = () => {
      removeEventListener('pointerdown', begin, true);
      removeEventListener('keydown', begin, true);
      if (this.wanted && this.mode === 'classical') this.play();
    };
    addEventListener('pointerdown', begin, true);
    addEventListener('keydown', begin, true);
    // quiet while the gallery's tab is in the background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.resumeOnShow = !this.audio.paused; this.audio.pause(); }
      else if (this.resumeOnShow) this.audio.play().catch(() => {});
    });

    $('musicButton').onclick = e => { e.stopPropagation(); this.togglePanel(); };
    $('musicClose').onclick = () => this.togglePanel(false);
    $('musicPlay').onclick = () => (this.audio.paused ? this.play() : this.pause());
    $('musicNext').onclick = () => this.next();
    $('musicSpotify').onclick = () => this.useSpotify();
    $('musicBack').onclick = () => this.useClassical();
    // the panel closes by itself a few seconds after the last touch, unless the visitor is using it
    const panel = $('musicPanel');
    this.closeTimer = null;
    this.hovered = false;
    panel.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { this.hovered = true; this.armClose(); } });
    panel.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { this.hovered = false; this.armClose(); } });
    for (const type of ['pointerdown', 'keydown', 'focusin', 'wheel']) panel.addEventListener(type, () => this.armClose(), { passive: true });
    this.update();
  }

  armClose() {
    clearTimeout(this.closeTimer);
    if (!$('musicPanel').classList.contains('open')) return;
    this.closeTimer = setTimeout(() => {
      // still in use: the mouse is over it, or the Spotify player has the focus (its taps don't reach this page)
      if (this.hovered || document.activeElement === $('spotifyFrame')) this.armClose();
      else this.togglePanel(false);
    }, AUTO_CLOSE_MS);
  }

  get track() { return TRACKS[this.order[this.at]]; }

  play() {
    const src = `assets/music/${this.track.file}.mp3`;
    if (!this.audio.src.endsWith(src)) this.audio.src = src;
    this.audio.play().catch(() => {});
    this.wanted = true;
    localStorage.removeItem(STORED);
  }
  pause() {
    this.audio.pause();
    this.wanted = false;
    localStorage.setItem(STORED, 'off');
  }
  next() {
    this.at = (this.at + 1) % this.order.length;
    this.audio.src = `assets/music/${this.track.file}.mp3`;
    if (this.wanted && this.mode === 'classical') this.audio.play().catch(() => {});
    this.update();
  }

  // the Spotify player stays loaded while its panel is closed, so it keeps playing
  useSpotify() {
    this.mode = 'spotify';
    this.audio.pause();
    if (!$('spotifyFrame').src) $('spotifyFrame').src = SPOTIFY;
    this.update();
  }
  useClassical() {
    this.mode = 'classical';
    $('spotifyFrame').removeAttribute('src'); // stops Spotify
    this.play();
    this.update();
  }

  togglePanel(open = !$('musicPanel').classList.contains('open')) {
    $('musicPanel').classList.toggle('open', open);
    $('musicPanel').setAttribute('aria-hidden', String(!open));
    this.armClose();
  }

  update() {
    const playing = this.mode === 'spotify' || !this.audio.paused;
    $('musicButton').classList.toggle('on', playing);
    $('musicButton').setAttribute('aria-label', playing ? 'Music (playing)' : 'Music (off)');
    $('musicClassical').hidden = this.mode !== 'classical';
    $('musicSpotifyBox').hidden = this.mode !== 'spotify';
    $('musicTitle').textContent = this.track.title;
    $('musicBy').textContent = this.track.by;
    $('musicPlay').textContent = this.audio.paused ? '▶ Play' : '❚❚ Pause';
  }
}
