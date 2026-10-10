const state = {
  mode: 'music',
  behavior: 'mapped',
  chunkMs: 280,
  count: 0,
  seqIndex: 0,
  ctx: null,
  musicBuffer: null,
  loadingMusic: null,
  fxBuffers: {}
};

// FX samples from CodeDuck (github.com/emmaruyiyang/CodeDuck/tree/main/data/sound)
const FX_FILES = {
  bomb: '../assets/sounds/bomb.mp3',
  gun: '../assets/sounds/gun.mp3',
  pupu: '../assets/sounds/pupu.mp3',
  duck: '../assets/sounds/duck.mp3'
};

const lastKey = document.getElementById('lastKey');
const eventCount = document.getElementById('eventCount');
const audioStatus = document.getElementById('audioStatus');
const chunk = document.getElementById('chunk');
const chunkValue = document.getElementById('chunkValue');
const musicControls = document.getElementById('musicControls');
const modeHint = document.getElementById('modeHint');
const visual = document.getElementById('visual');

for (let i = 0; i < 38; i++) {
  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.style.height = `${8 + Math.random() * 42}px`;
  visual.appendChild(bar);
}
const bars = [...visual.children];

function audioContext() {
  if (!state.ctx) state.ctx = new (window.AudioContext || window.webkitAudioContext)();
  return state.ctx;
}

async function ensureMusic() {
  if (state.musicBuffer) return state.musicBuffer;
  if (state.loadingMusic) return state.loadingMusic;
  state.loadingMusic = (async () => {
    try {
      const ctx = audioContext();
      const response = await fetch('../assets/music/she-so-bad.mp3');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.musicBuffer = await ctx.decodeAudioData(await response.arrayBuffer());
      audioStatus.textContent = `${state.musicBuffer.duration.toFixed(1)}s sample ready`;
      return state.musicBuffer;
    } catch (e) {
      audioStatus.textContent = 'Music sample failed to load';
      console.error(e);
      return null;
    }
  })();
  return state.loadingMusic;
}

async function loadFx() {
  const ctx = audioContext();
  await Promise.all(Object.entries(FX_FILES).map(async ([name, url]) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.fxBuffers[name] = await ctx.decodeAudioData(await response.arrayBuffer());
    } catch (e) {
      console.error(`FX sample "${name}" failed to load, using synth fallback`, e);
    }
  }));
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  musicControls.style.opacity = mode === 'music' ? '1' : '.42';
  if (mode === 'music') modeHint.textContent = 'Every key recalls a tiny slice of the “She’s so bad” hook.';
  if (mode === 'fx') modeHint.textContent = 'Enter = bomb, Space = gun, Backspace = pupu, other keys = duck squeeze.';
  if (mode === 'off') modeHint.textContent = 'Typing stays silent.';
}

document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelectorAll('[data-behavior]').forEach(b => b.addEventListener('click', () => {
  state.behavior = b.dataset.behavior;
  state.seqIndex = 0;
  document.querySelectorAll('[data-behavior]').forEach(x => x.classList.toggle('active', x === b));
}));

chunk.addEventListener('input', () => {
  state.chunkMs = Number(chunk.value);
  chunkValue.textContent = chunk.value;
  state.seqIndex = 0;
});

function noiseBuffer(seconds = .25) {
  const ctx = audioContext();
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function connectWithEnvelope(source, start, duration, peak = .55) {
  const ctx = audioContext();
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + .006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(gain).connect(ctx.destination);
  return gain;
}

function explosion() {
  const ctx = audioContext();
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(.8);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1500, t);
  filter.frequency.exponentialRampToValueAtTime(90, t + .75);
  src.connect(filter);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(.85, t);
  gain.gain.exponentialRampToValueAtTime(.0001, t + .8);
  filter.connect(gain).connect(ctx.destination);
  src.start(t);
}

function gun() {
  const ctx = audioContext();
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(.11);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 700;
  src.connect(hp);
  connectWithEnvelope(hp, t, .11, .7);
  src.start(t);
}

function plop() {
  const ctx = audioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + .22);
  connectWithEnvelope(osc, t, .24, .55);
  osc.start(t); osc.stop(t + .25);
}

function quack() {
  const ctx = audioContext();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(360, t);
  osc.frequency.linearRampToValueAtTime(240, t + .09);
  filter.type = 'bandpass'; filter.frequency.value = 1100; filter.Q.value = 4;
  osc.connect(filter);
  connectWithEnvelope(filter, t, .12, .17);
  osc.start(t); osc.stop(t + .13);
}

function playSample(name, fallback) {
  const buffer = state.fxBuffers[name];
  if (!buffer) return fallback();
  const ctx = audioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = .9;
  source.connect(gain).connect(ctx.destination);
  source.start();
}

function playFx(keycode) {
  if (keycode === 0x001C) return playSample('bomb', explosion); // Enter
  if (keycode === 0x0039) return playSample('gun', gun);        // Space
  if (keycode === 0x000E) return playSample('pupu', plop);      // Backspace
  playSample('duck', quack);
}

async function playMusicChunk(keycode) {
  const buffer = await ensureMusic();
  if (!buffer) return;
  const ctx = audioContext();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

  const chunkSec = Math.min(state.chunkMs / 1000, Math.max(.08, buffer.duration / 3));
  const slots = Math.max(1, Math.floor(buffer.duration / chunkSec));
  let slot;

  if (state.behavior === 'sequence') {
    slot = state.seqIndex++ % slots;
  } else if (state.behavior === 'shuffle') {
    slot = Math.floor(Math.random() * slots);
  } else {
    slot = Math.abs((keycode * 17 + 11) % slots);
  }

  const offset = Math.min(slot * chunkSec, Math.max(0, buffer.duration - chunkSec));
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = .92;
  source.connect(gain).connect(ctx.destination);
  source.start(0, offset, chunkSec);

  bars.forEach((bar, i) => {
    const d = Math.abs((i / bars.length) - (slot / slots));
    bar.style.height = `${8 + Math.max(0, 1 - d * 6) * 72}px`;
  });
}

function keyLabel(code) {
  if (code === 0x001C) return 'Enter';
  if (code === 0x0039) return 'Space';
  if (code === 0x000E) return 'Backspace';
  return `0x${Number(code).toString(16).toUpperCase()}`;
}

window.keyJam.onGlobalKeydown(async event => {
  state.count++;
  lastKey.textContent = keyLabel(event.keycode);
  eventCount.textContent = `${state.count} hit${state.count === 1 ? '' : 's'}`;
  if (state.mode === 'fx') playFx(event.keycode);
  if (state.mode === 'music') playMusicChunk(event.keycode);
});

ensureMusic();
loadFx();
setMode('music');
