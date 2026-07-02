'use strict';

/* =========================================================
   DATA
   ========================================================= */
const CHARACTERS = [
  { id: 'luffy',   name: 'LUFFY',   power: 'Gomu Gomu No Mi',        standing: 'Standing_luffy.png' },
  { id: 'zoro',    name: 'ZORO',    power: 'Three Sword Style',      standing: 'standing_zoro.png' },
  { id: 'nami',    name: 'NAMI',    power: 'Weatheria',              standing: 'nami_standing.png' },
  { id: 'sanji',   name: 'SANJI',   power: 'Black Leg Style',        standing: 'sanji_standing.png' },
  { id: 'ussop',   name: 'USSOP',   power: 'Skilled Sniper',         standing: 'ussop_standing.png' },
  { id: 'robin',   name: 'ROBIN',   power: 'Sprout Duplicate Body',  standing: 'robin_standing.png' },
  { id: 'chopper', name: 'CHOPPER', power: 'Kung Fu Point',          standing: 'chopper_standing.png' },
  { id: 'franky',  name: 'FRANKY',  power: 'Missile Launchers',      standing: 'franky_standing.png' },
  { id: 'brook',   name: 'BROOK',   power: 'Requiem La Vande Roll',  standing: 'brook_standing.png' },
  { id: 'jinbe',   name: 'JINBE',   power: 'Fish-Man Karate',        standing: 'jinbe_standing.png' },
];

const HORIZONS = [
  { id: 'ISLAND', label: 'ISLAND', img: 'island.png', desc: 'Run & jump over barrels, logs, stones and spikes.' },
  { id: 'OCEAN',  label: 'OCEAN',  img: 'ocean.png',  desc: 'Steer your ship across 3 lanes, dodge the sea.' },
  { id: 'SKY',    label: 'SKY',    img: 'sky.png',    desc: 'Flap your balloon through the pirate pipes.' },
];

const A = 'assets/';
const CHAR_DIR = id => `${A}characters/character_${id}/`;

/* =========================================================
   STATE
   ========================================================= */
const state = {
  character: 'luffy',
  horizon: 'ISLAND',
  musicVol: 0.7,
  sfxVol: 0.8,
  muted: false,
  highScores: { ISLAND: 0, OCEAN: 0, SKY: 0 },
};

function loadState() {
  try {
    const raw = localStorage.getItem('pirateOdysseyState');
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch (e) {}
}
function saveState() {
  try { localStorage.setItem('pirateOdysseyState', JSON.stringify(state)); } catch (e) {}
}

/* =========================================================
   ASSET MANAGER
   ========================================================= */
const images = {};
const audioBuffers = {};
let audioCtx = null;

function loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { images[key] = img; resolve(); };
    img.onerror = () => { resolve(); }; // don't block game if one asset is missing
    img.src = src;
  });
}

function buildAssetList() {
  const list = [];
  // Backgrounds
  list.push(['bg_gamestart', `${A}backgrounds/gamestart.png`]);
  list.push(['bg_island', `${A}backgrounds/island.png`]);
  list.push(['bg_ocean', `${A}backgrounds/ocean.png`]);
  list.push(['bg_sky', `${A}backgrounds/sky.png`]);

  CHARACTERS.forEach(c => {
    const dir = CHAR_DIR(c.id);
    list.push([`${c.id}_standing`, dir + c.standing]);
    list.push([`${c.id}_gameover`, dir + 'gameover.png']);
    list.push([`${c.id}_ship`, dir + `ship/${c.id}_ship.png`]);
    list.push([`${c.id}_balloon`, dir + `balloon/${c.id}_balloon.png`]);
    for (let i = 0; i < 5; i++) {
      list.push([`${c.id}_run_${i}`, dir + `running/${c.id}_running(${i}).png`]);
    }
    for (let i = 0; i < 5; i++) {
      list.push([`${c.id}_jump_${i}`, dir + `jumping/${c.id}_jump(${i}).png`]);
    }
  });
  return list;
}

const SOUND_FILES = {
  click: 'click.wav',
  jump: 'jump_sound.wav',
  balloon: 'balloon_sound.wav',
  ship: 'ship_sound.wav',
  gameover: 'gameover_sound.wav',
  bg1: 'bg1.wav',
  bg2: 'bg2.wav',
};
CHARACTERS.forEach(c => { SOUND_FILES[c.id] = `${c.id}_sound.wav`; });

async function loadAudioBuffer(key, path) {
  try {
    const res = await fetch(path);
    const arr = await res.arrayBuffer();
    const buf = await audioCtx.decodeAudioData(arr);
    audioBuffers[key] = buf;
  } catch (e) { /* ignore missing/failed audio */ }
}

async function preloadAll(onProgress) {
  const imgList = buildAssetList();
  let done = 0;
  const total = imgList.length;
  await Promise.all(imgList.map(([key, src]) =>
    loadImage(key, src).then(() => { done++; onProgress(done / total); })
  ));
}

/* =========================================================
   AUDIO MANAGER (WebAudio, mobile-safe: unlocked on first gesture)
   ========================================================= */
const Audio_ = {
  musicSource: null,
  musicGain: null,
  currentMusicKey: null,

  init() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  },

  async unlock() {
    this.init();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    // lazy-load sound effects & music in background after unlock
    if (!this._loading) {
      this._loading = true;
      Object.entries(SOUND_FILES).forEach(([key, file]) => {
        loadAudioBuffer(key, `${A}sounds/${file}`);
      });
    }
  },

  playSfx(key) {
    if (state.muted || !audioCtx || !audioBuffers[key]) return;
    try {
      const src = audioCtx.createBufferSource();
      src.buffer = audioBuffers[key];
      const gain = audioCtx.createGain();
      gain.gain.value = state.sfxVol;
      src.connect(gain).connect(audioCtx.destination);
      src.start(0);
    } catch (e) {}
  },

  playMusic(key) {
    if (this.currentMusicKey === key && this.musicSource) return;
    this.stopMusic();
    if (state.muted || !audioCtx || !audioBuffers[key]) { this.currentMusicKey = key; return; }
    try {
      const src = audioCtx.createBufferSource();
      src.buffer = audioBuffers[key];
      src.loop = true;
      const gain = audioCtx.createGain();
      gain.gain.value = state.musicVol;
      src.connect(gain).connect(audioCtx.destination);
      src.start(0);
      this.musicSource = src;
      this.musicGain = gain;
      this.currentMusicKey = key;
    } catch (e) {}
  },

  stopMusic() {
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch (e) {}
      this.musicSource = null;
    }
    this.currentMusicKey = null;
  },

  setMusicVol(v) {
    state.musicVol = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  },

  setMuted(m) {
    state.muted = m;
    if (m) this.stopMusic();
    else this.playMusic(this._lastKeyWanted || 'bg1');
  },
};

/* =========================================================
   SCREEN NAVIGATION
   ========================================================= */
const screens = {};
['loading','intro','menu','characters','horizon','settings','game'].forEach(id => {
  screens[id] = document.getElementById('screen-' + id);
});

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

/* =========================================================
   UI BUILDERS
   ========================================================= */
function charImgSrc(id, kind) {
  return images[`${id}_${kind}`] ? images[`${id}_${kind}`].src : '';
}

function refreshMenuScreen() {
  const c = CHARACTERS.find(c => c.id === state.character);
  document.getElementById('menu-char-img').src = charImgSrc(c.id, 'standing');
  document.getElementById('menu-char-name').textContent = c.name;
  document.getElementById('menu-char-power').textContent = c.power;

  const h = HORIZONS.find(h => h.id === state.horizon);
  document.getElementById('menu-horizon-img').src = images['bg_' + h.id.toLowerCase()] ? images['bg_' + h.id.toLowerCase()].src : '';
  document.getElementById('menu-horizon-name').textContent = h.label;

  document.getElementById('menu-bg').style.backgroundImage = `url(${images.bg_gamestart.src})`;
  document.getElementById('menu-best').textContent = 'Best (' + h.label + '): ' + state.highScores[h.id];
}

function buildCharacterScreen() {
  document.getElementById('char-bg').style.backgroundImage = `url(${images.bg_gamestart.src})`;
  const scroll = document.getElementById('char-scroll');
  scroll.innerHTML = '';
  CHARACTERS.forEach(c => {
    const card = document.createElement('div');
    card.className = 'char-card' + (c.id === state.character ? ' selected' : '');
    card.dataset.id = c.id;
    card.innerHTML = `
      <div class="char-card-name">${c.name}</div>
      <img class="char-card-img" src="${charImgSrc(c.id, 'standing')}" alt="${c.name}">
      <div class="char-card-power">${c.power}</div>
    `;
    card.addEventListener('click', () => {
      state.character = c.id;
      Audio_.playSfx(c.id);
      [...scroll.children].forEach(ch => ch.classList.remove('selected'));
      card.classList.add('selected');
      card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
    scroll.appendChild(card);
  });
  const sel = scroll.querySelector('.selected');
  if (sel) setTimeout(() => sel.scrollIntoView({ inline: 'center', block: 'nearest' }), 50);
}

function buildHorizonScreen() {
  document.getElementById('horizon-bg').style.backgroundImage = `url(${images.bg_gamestart.src})`;
  const grid = document.getElementById('horizon-grid');
  grid.innerHTML = '';
  HORIZONS.forEach(h => {
    const card = document.createElement('div');
    card.className = 'horizon-card' + (h.id === state.horizon ? ' selected' : '');
    card.innerHTML = `
      <img src="${images['bg_' + h.id.toLowerCase()].src}" alt="${h.label}">
      <div class="h-name">${h.label}</div>
      <div class="h-desc">${h.desc}</div>
    `;
    card.addEventListener('click', () => {
      state.horizon = h.id;
      Audio_.playSfx('click');
      [...grid.children].forEach(ch => ch.classList.remove('selected'));
      card.classList.add('selected');
    });
    grid.appendChild(card);
  });
}

function refreshSettingsScreen() {
  document.getElementById('settings-bg').style.backgroundImage = `url(${images.bg_gamestart.src})`;
  document.getElementById('slider-music').value = Math.round(state.musicVol * 100);
  document.getElementById('slider-sfx').value = Math.round(state.sfxVol * 100);
  const list = document.getElementById('highscore-list');
  list.innerHTML = HORIZONS.map(h => `<div>${h.label}: ${state.highScores[h.id]}</div>`).join('');
}

/* =========================================================
   GAME ENGINE
   ========================================================= */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const OBSTACLE_TYPES = {
  BARREL: { color: '#8b4513', wr: 0.072, hr: 0.10 },
  LOG:    { color: '#cd853f', wr: 0.11,  hr: 0.075 },
  STONE:  { color: '#808080', wr: 0.095, hr: 0.09 },
  SPIKE:  { color: '#4b4b4b', wr: 0.058, hr: 0.11 },
  ROCK:      { color: '#64646e', wr: 0.075, hr: 0.10 },
  CRATE:     { color: '#b47838', wr: 0.065, hr: 0.10 },
  ANCHOR:    { color: '#46464f', wr: 0.05,  hr: 0.10 },
  WHIRLPOOL: { color: '#1e50a0', wr: 0.085, hr: 0.09 },
  ICEBERG:   { color: '#b4dcff', wr: 0.068, hr: 0.10 },
};
const ISLAND_TYPE_KEYS = ['BARREL', 'LOG', 'STONE', 'SPIKE'];
const OCEAN_TYPE_KEYS = ['ROCK', 'CRATE', 'ANCHOR', 'WHIRLPOOL', 'ICEBERG'];

class Engine {
  constructor() {
    this.mode = 'ISLAND';
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.started = false;
    this.reset();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = w; this.H = h;
  }

  reset() {
    const H = this.H || canvas.clientHeight || 600;
    this.score = 0;
    this.scoreAcc = 0;
    this.obstacles = [];
    this.spawnTimer = 0;
    this.elapsed = 0;
    this.speed = 0;
    this.gameOver = false;
    this.started = false;
    this.paused = false;

    // island / sky physics
    this.charX = 0; // set on start relative to W
    this.charY = 0;
    this.vy = 0;
    this.jumping = false;
    this.runFrame = 0;
    this.jumpFrame = 0;
    this.frameTimer = 0;

    // ocean lanes
    this.laneY = [0, 0, 0];
    this.laneCur = 1;
    this.laneTarget = 1;
    this.shipY = 0;
    this.laneCooldown = 0;
    this.laneDanger = [0, 0, 0];
  }

  setupForMode(mode) {
    this.mode = mode;
    this.reset();
    const W = this.W, H = this.H;
    this.charX = W * 0.14;
    this.groundY = H * 0.74;
    this.charY = (mode === 'SKY') ? H * 0.4 : this.groundY;
    this.speedStart = W * (mode === 'SKY' ? 0.30 : 0.32);
    this.speedMax = W * (mode === 'SKY' ? 0.55 : 0.72);
    this.speed = this.speedStart;
    if (mode === 'OCEAN') {
      this.computeLanes();
      this.shipY = this.laneY[1];
    }
  }

  computeLanes() {
    const H = this.H;
    this.laneY[0] = H * 0.34;
    this.laneY[1] = H * 0.54;
    this.laneY[2] = H * 0.74;
  }

  start() {
    this.started = true;
    this.gameOver = false;
    this.paused = false;
    this.inputLockUntil = performance.now() + 250;
    if (this.mode === 'OCEAN') {
      this.laneCur = 1; this.laneTarget = 1;
      this.computeLanes();
      this.shipY = this.laneY[1];
    }
    setOverlay('ready', false);
    setOverlay('gameover', false);
    setOverlay('pause', false);
    document.getElementById('lane-controls').classList.toggle('hidden', this.mode !== 'OCEAN');
    const hint = document.getElementById('touch-hint');
    if (this.mode === 'OCEAN') hint.textContent = 'Swipe or tap ◀ ▶ to change lanes';
    else if (this.mode === 'SKY') hint.textContent = 'Tap / Space to flap';
    else hint.textContent = 'Tap / Space to jump';
    setTimeout(() => { hint.style.transition = 'opacity 1s'; hint.style.opacity = '0'; }, 2500);
  }

  jumpOrFlap() {
    if (!this.started || this.gameOver || this.paused) return;
    if (performance.now() < this.inputLockUntil) return;
    const H = this.H;
    if (this.mode === 'SKY') {
      this.vy = -H * 0.85;
      Audio_.playSfx('balloon');
    } else if (this.mode === 'ISLAND' && !this.jumping) {
      this.jumping = true;
      this.vy = -H * 1.05;
      Audio_.playSfx('jump');
    }
  }

  switchLane(dir) {
    if (!this.started || this.gameOver || this.paused || this.mode !== 'OCEAN') return;
    if (performance.now() < this.inputLockUntil) return;
    if (this.laneCooldown > 0) return;
    const t = this.laneTarget + dir;
    if (t < 0 || t > 2) return;
    this.laneTarget = t;
    this.laneCooldown = 0.2;
    Audio_.playSfx('ship');
  }

  spawnObstacle() {
    const W = this.W, H = this.H;
    if (this.mode === 'ISLAND') {
      const key = ISLAND_TYPE_KEYS[Math.floor(Math.random() * ISLAND_TYPE_KEYS.length)];
      const t = OBSTACLE_TYPES[key];
      const w = H * t.wr, h = H * t.hr;
      this.obstacles.push({ x: W + 40, y: this.groundY - h, w, h, key, scored: false });
    } else if (this.mode === 'SKY') {
      const gap = H * 0.34;
      const pipeW = W * 0.05;
      const minH = H * 0.08;
      const topH = minH + Math.random() * (H - gap - minH * 2);
      this.obstacles.push({ x: W + 40, y: 0, w: pipeW, h: topH, key: 'PIPE', part: 'top', scored: true });
      this.obstacles.push({ x: W + 40, y: topH + gap, w: pipeW, h: H - topH - gap, key: 'PIPE', part: 'bottom', scored: false });
    } else if (this.mode === 'OCEAN') {
      const keys = OCEAN_TYPE_KEYS;
      const key = keys[Math.floor(Math.random() * keys.length)];
      const t = OBSTACLE_TYPES[key];
      const w = H * t.wr, h = Math.min(H * t.hr, H * 0.11);
      const blockTwo = this.speed > this.speedMax * 0.7 && Math.random() < 0.3;
      const laneCount = blockTwo ? 2 : 1;
      const startLane = Math.floor(Math.random() * (3 - laneCount + 1));
      for (let i = 0; i < laneCount; i++) {
        const lane = startLane + i;
        const laneY = this.laneY[lane];
        this.obstacles.push({ x: W + 40, y: laneY - h / 2, w, h, key, lane, scored: false });
      }
    }
  }

  update(dt) {
    if (!this.started || this.gameOver || this.paused) return;
    this.elapsed += dt;
    const W = this.W, H = this.H;
    const progress = Math.min(1, this.elapsed / 120);
    this.speed = this.speedStart + (this.speedMax - this.speedStart) * progress;

    // spawn timing
    let spawnMin, spawnMax;
    if (this.mode === 'ISLAND') { spawnMin = 0.5; spawnMax = 1.5; }
    else if (this.mode === 'SKY') { spawnMin = 1.15; spawnMax = 2.0; }
    else { spawnMin = 0.6; spawnMax = 1.7; }
    const interval = spawnMax - (spawnMax - spawnMin) * progress;

    this.spawnTimer += dt;
    if (this.spawnTimer >= interval) {
      this.spawnTimer = 0;
      this.spawnObstacle();
    }

    // move obstacles + scoring for sky/ocean
    for (const o of this.obstacles) {
      o.x -= this.speed * dt;
      if (!o.scored && o.x + o.w < this.charX && this.mode !== 'ISLAND') {
        o.scored = true;
        this.score += 1;
      }
    }
    this.obstacles = this.obstacles.filter(o => o.x + o.w > -40);

    // island scoring: continuous, distance based
    if (this.mode === 'ISLAND') {
      this.scoreAcc += (this.speed / this.speedStart) * dt * 12;
      if (this.scoreAcc >= 1) {
        const inc = Math.floor(this.scoreAcc);
        this.score += inc;
        this.scoreAcc -= inc;
      }
    }

    // physics
    if (this.mode === 'SKY') {
      this.vy += H * 1.55 * dt;
      this.charY += this.vy * dt;
      if (this.charY > H - H * 0.12 || this.charY < -H * 0.1) return this.die();
      this.runFrame = this.vy < 0 ? 1 : 0;
    } else if (this.mode === 'ISLAND') {
      if (this.jumping) {
        this.charY += this.vy * dt;
        this.vy += H * 2.4 * dt;
        if (this.charY >= this.groundY) {
          this.charY = this.groundY;
          this.jumping = false;
          this.vy = 0;
        }
      }
      this.frameTimer += dt;
      if (!this.jumping && this.frameTimer > 0.09) {
        this.frameTimer = 0;
        this.runFrame = (this.runFrame + 1) % 5;
      }
      if (this.jumping) {
        const v = this.vy / H;
        if (v < -0.9) this.jumpFrame = 0;
        else if (v < -0.25) this.jumpFrame = 1;
        else if (v < 0.25) this.jumpFrame = 2;
        else if (v < 0.9) this.jumpFrame = 3;
        else this.jumpFrame = 4;
      }
    } else if (this.mode === 'OCEAN') {
      this.computeLanes();
      if (this.laneCooldown > 0) this.laneCooldown -= dt;
      const targetY = this.laneY[this.laneTarget];
      this.shipY += (targetY - this.shipY) * Math.min(1, dt * 9);
      if (Math.abs(this.shipY - targetY) < 1) { this.shipY = targetY; this.laneCur = this.laneTarget; }
      this.frameTimer += dt;
      if (this.frameTimer > 0.09) { this.frameTimer = 0; this.runFrame = (this.runFrame + 1) % 5; }

      for (let l = 0; l < 3; l++) this.laneDanger[l] = Math.max(0, this.laneDanger[l] - dt);
      for (const o of this.obstacles) {
        if (o.lane != null && o.x > this.charX && o.x - this.charX < W * 0.22) this.laneDanger[o.lane] = 0.35;
      }

      const shipH = H * 0.20, shipW = shipH * 1.5;
      const padX = shipW * 0.14, padY = shipH * 0.16;
      const hb = { x: this.charX + padX, y: this.shipY - shipH / 2 + padY, w: shipW - 2 * padX, h: shipH - 2 * padY };
      for (const o of this.obstacles) {
        if (o.lane == null) continue;
        if (rectsIntersect(hb, o)) return this.die();
      }
      return; // ocean collision handled above; skip generic collision below
    }

    // generic collision (island / sky)
    if (this.mode === 'ISLAND') {
      const h = H * 0.34, w = h * 0.6;
      const padX = w * 0.34, padY = h * 0.18;
      const hb = { x: this.charX + padX, y: this.charY - h + padY, w: w - 2 * padX, h: h - padY - h * 0.05 };
      for (const o of this.obstacles) {
        if (rectsIntersect(hb, { x: o.x, y: o.y, w: o.w, h: o.h })) return this.die();
      }
    } else if (this.mode === 'SKY') {
      const size = H * 0.11;
      const hb = { x: this.charX + size * 0.15, y: this.charY - size / 2, w: size * 0.7, h: size * 0.7 };
      for (const o of this.obstacles) {
        if (rectsIntersect(hb, { x: o.x, y: o.y, w: o.w, h: o.h })) return this.die();
      }
    }
  }

  die() {
    if (this.gameOver) return;
    this.gameOver = true;
    Audio_.playSfx('gameover');
    if (this.score > state.highScores[this.mode]) {
      state.highScores[this.mode] = Math.floor(this.score);
      saveState();
    }
    document.getElementById('gameover-score').textContent = 'YOUR SCORE: ' + Math.floor(this.score);
    setOverlay('gameover', true);
    updateHud();
  }

  draw() {
    const { W, H } = this;
    ctx.clearRect(0, 0, W, H);
    const bgKey = 'bg_' + this.mode.toLowerCase();
    if (images[bgKey]) ctx.drawImage(images[bgKey], 0, 0, W, H);
    else { ctx.fillStyle = '#1c3a5e'; ctx.fillRect(0, 0, W, H); }

    if (this.mode === 'ISLAND') this.drawIsland();
    else if (this.mode === 'SKY') this.drawSky();
    else this.drawOcean();

    updateHud();
  }

  drawObstacleShape(o) {
    const t = OBSTACLE_TYPES[o.key];
    ctx.fillStyle = t ? t.color : '#888';
    const { x, y, w, h } = o;
    switch (o.key) {
      case 'SPIKE': {
        ctx.beginPath();
        ctx.moveTo(x, y + h); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w, y + h);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'STONE': case 'ROCK': case 'WHIRLPOOL': {
        ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
        if (o.key === 'ROCK') {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath(); ctx.ellipse(x + w * 0.35, y + h * 0.4, w * 0.22, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'ICEBERG': {
        ctx.fillStyle = '#c8ebff';
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'ANCHOR': {
        ctx.fillStyle = '#46464f';
        roundRect(x + w * 0.4, y, w * 0.2, h, 4); ctx.fill();
        roundRect(x, y + h * 0.3, w, h * 0.18, 4); ctx.fill();
        ctx.beginPath(); ctx.arc(x + w / 2, y, w * 0.18, 0, Math.PI * 2); ctx.fill();
        break;
      }
      default: {
        roundRect(x, y, w, h, Math.min(w, h) * 0.18);
        ctx.fill();
      }
    }
  }

  drawCharacterSprite(kind, x, y, w, h) {
    const c = state.character;
    let img = null;
    if (this.gameOver) {
      img = images[`${c}_gameover`] || images[`${c}_standing`];
    } else if (kind === 'ship') img = images[`${c}_ship`];
    else if (kind === 'balloon') img = images[`${c}_balloon`];
    else if (kind === 'jump') img = images[`${c}_jump_${this.jumpFrame}`] || images[`${c}_standing`];
    else img = images[`${c}_run_${this.runFrame}`] || images[`${c}_standing`];
    if (!img) return;
    const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
    const targetW = h * (iw / ih);
    ctx.drawImage(img, x, y, targetW, h);
  }

  drawIsland() {
    for (const o of this.obstacles) this.drawObstacleShape(o);
    const h = this.H * 0.34;
    this.drawCharacterSprite(this.jumping ? 'jump' : 'run', this.charX, this.charY - h, null, h);
  }

  drawSky() {
    for (const o of this.obstacles) {
      ctx.fillStyle = '#8b6b3a';
      roundRect(o.x, o.y, o.w, o.h, 6); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      if (o.part === 'top') ctx.fillRect(o.x, o.y + o.h - 14, o.w, 14);
      else ctx.fillRect(o.x, o.y, o.w, 14);
    }
    const size = this.H * 0.15;
    this.drawCharacterSprite('balloon', this.charX, this.charY - size / 2, null, size);
  }

  drawOcean() {
    ctx.setLineDash([8, 10]);
    for (let l = 0; l < 3; l++) {
      const y = this.laneY[l];
      if (this.laneDanger[l] > 0) {
        ctx.fillStyle = `rgba(255,60,30,${this.laneDanger[l] * 0.9})`;
        ctx.fillRect(0, y - this.H * 0.08, this.W, this.H * 0.16);
      }
      ctx.strokeStyle = (l === this.laneTarget) ? 'rgba(255,220,80,0.55)' : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const o of this.obstacles) this.drawObstacleShape(o);
    const shipH = this.H * 0.20;
    this.drawCharacterSprite('ship', this.charX, this.shipY - shipH / 2, null, shipH);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateHud() {
  const best = Math.max(state.highScores[engine.mode], Math.floor(engine.score));
  document.getElementById('hud-best').textContent = 'BEST ' + pad(best);
  document.getElementById('hud-score').textContent = 'SCORE ' + pad(Math.floor(engine.score));
}
function pad(n) { return String(n).padStart(5, '0'); }

function setOverlay(name, show) {
  document.getElementById('overlay-' + name).classList.toggle('hidden', !show);
}

/* =========================================================
   ENGINE INSTANCE + LOOP
   ========================================================= */
const engine = new Engine();
let lastTime = null;
function loop(ts) {
  requestAnimationFrame(loop);
  if (lastTime == null) lastTime = ts;
  let dt = (ts - lastTime) / 1000;
  lastTime = ts;
  dt = Math.min(dt, 0.05);
  if (!screens.game.classList.contains('hidden')) {
    engine.update(dt);
    engine.draw();
  }
}
requestAnimationFrame(loop);

/* =========================================================
   INPUT
   ========================================================= */
let touchStartX = null, touchStartY = null, touchStartT = 0;
canvas.addEventListener('pointerdown', (e) => {
  touchStartX = e.clientX; touchStartY = e.clientY; touchStartT = performance.now();
  if (engine.mode !== 'OCEAN') engine.jumpOrFlap();
});
canvas.addEventListener('pointerup', (e) => {
  if (engine.mode === 'OCEAN' && touchStartX != null) {
    const dx = e.clientX - touchStartX, dy = e.clientY - touchStartY;
    const dt = performance.now() - touchStartT;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && dt < 600) {
      engine.switchLane(dx > 0 ? 1 : -1);
    }
  }
  touchStartX = null;
});

window.addEventListener('keydown', (e) => {
  if (screens.game.classList.contains('hidden')) return;
  if (e.code === 'Space') { e.preventDefault(); engine.jumpOrFlap(); }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') engine.switchLane(-1);
  if (e.code === 'ArrowRight' || e.code === 'KeyD') engine.switchLane(1);
  if (e.code === 'Escape') togglePause();
});

document.getElementById('btn-lane-left').addEventListener('click', () => engine.switchLane(-1));
document.getElementById('btn-lane-right').addEventListener('click', () => engine.switchLane(1));

/* =========================================================
   NAV WIRING
   ========================================================= */
function goHome() {
  engine.started = false;
  engine.paused = false;
  Audio_.playMusic('bg1');
  showScreen('menu');
  refreshMenuScreen();
}

function togglePause() {
  if (!engine.started || engine.gameOver) return;
  engine.paused = !engine.paused;
  Audio_.playSfx('click');
  setOverlay('pause', engine.paused);
}

function enterGame() {
  showScreen('game');
  setTimeout(() => engine.resize(), 30);
  engine.setupForMode(state.horizon);
  updateHud();
  document.getElementById('ready-hint').textContent =
    state.horizon === 'OCEAN' ? 'A/D or ◀▶ to switch lanes' : 'Tap or press Space to move';
  setOverlay('ready', true);
  setOverlay('pause', false);
  setOverlay('gameover', false);
  Audio_.playMusic('bg2');
}

document.getElementById('btn-intro-start').addEventListener('click', async () => {
  await Audio_.unlock();
  Audio_.playMusic('bg1');
  showScreen('menu');
  refreshMenuScreen();
});

document.getElementById('btn-menu-mute').addEventListener('click', (e) => {
  Audio_.setMuted(!state.muted);
  e.target.textContent = state.muted ? '🔇' : '🔊';
});

document.getElementById('btn-play').addEventListener('click', () => { Audio_.playSfx('click'); enterGame(); });
document.getElementById('btn-goto-characters').addEventListener('click', () => {
  Audio_.playSfx('click'); buildCharacterScreen(); showScreen('characters');
});
document.getElementById('btn-goto-horizon').addEventListener('click', () => {
  Audio_.playSfx('click'); buildHorizonScreen(); showScreen('horizon');
});
document.getElementById('btn-goto-settings').addEventListener('click', () => {
  Audio_.playSfx('click'); refreshSettingsScreen(); showScreen('settings');
});

document.getElementById('btn-char-back').addEventListener('click', () => { Audio_.playSfx('click'); showScreen('menu'); refreshMenuScreen(); });
document.getElementById('btn-char-confirm').addEventListener('click', () => { Audio_.playSfx('click'); saveState(); showScreen('menu'); refreshMenuScreen(); });

document.getElementById('btn-horizon-back').addEventListener('click', () => { Audio_.playSfx('click'); showScreen('menu'); refreshMenuScreen(); });
document.getElementById('btn-horizon-confirm').addEventListener('click', () => { Audio_.playSfx('click'); saveState(); showScreen('menu'); refreshMenuScreen(); });

document.getElementById('btn-settings-back').addEventListener('click', () => { saveState(); showScreen('menu'); refreshMenuScreen(); });
document.getElementById('slider-music').addEventListener('input', (e) => Audio_.setMusicVol(e.target.value / 100));
document.getElementById('slider-sfx').addEventListener('input', (e) => { state.sfxVol = e.target.value / 100; });
document.getElementById('btn-reset-scores').addEventListener('click', () => {
  state.highScores = { ISLAND: 0, OCEAN: 0, SKY: 0 };
  saveState(); refreshSettingsScreen();
});

document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-pause-resume').addEventListener('click', togglePause);
document.getElementById('btn-pause-restart').addEventListener('click', () => { Audio_.playSfx('click'); enterGame(); });
document.getElementById('btn-pause-home').addEventListener('click', () => { Audio_.playSfx('click'); goHome(); });

document.getElementById('btn-ready-play').addEventListener('click', () => { Audio_.playSfx('click'); engine.start(); });
document.getElementById('btn-ready-home').addEventListener('click', () => { Audio_.playSfx('click'); goHome(); });

document.getElementById('btn-gameover-play').addEventListener('click', () => { Audio_.playSfx('click'); enterGame(); });
document.getElementById('btn-gameover-home').addEventListener('click', () => { Audio_.playSfx('click'); goHome(); });

/* =========================================================
   BOOT
   ========================================================= */
async function boot() {
  loadState();
  showScreen('loading');
  const fill = document.getElementById('loading-fill');
  const label = document.getElementById('loading-label');
  await preloadAll((p) => {
    fill.style.width = Math.round(p * 100) + '%';
    label.textContent = 'Loading the seas... ' + Math.round(p * 100) + '%';
  });
  showScreen('intro');
}
boot();
