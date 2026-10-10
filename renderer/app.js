const state = {
  mode: 'music',
  holdMs: 250, // music fades out this long after the last key
  count: 0,
  ctx: null,
  musicBuffer: null,
  loadingMusic: null,
  // Continuous playback: playhead is where the song resumes after a pause.
  playhead: 0,
  musicSource: null,
  musicGain: null,
  playStartedAt: 0,
  playStartOffset: 0,
  stopTimer: null,
  frame: null,
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
const nowLine = document.getElementById('nowLine');
const modeHint = document.getElementById('modeHint');
const statusBadge = document.getElementById('statusBadge');
const progressFill = document.getElementById('progressFill');
const panels = {
  music: document.getElementById('musicPanel'),
  fx: document.getElementById('fxPanel'),
  off: document.getElementById('offPanel')
};
const permissionNotice = document.getElementById('permissionNotice');
const permissionTitle = document.getElementById('permissionTitle');
const permissionText = document.getElementById('permissionText');
const openSettings = document.getElementById('openSettings');
const relaunchApp = document.getElementById('relaunchApp');

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
      const response = await fetch('../assets/music/bad.mp3');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.musicBuffer = await ctx.decodeAudioData(await response.arrayBuffer());
      audioStatus.textContent = formatTime(state.musicBuffer.duration);
      return state.musicBuffer;
    } catch (e) {
      audioStatus.textContent = 'Failed to load';
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

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function setMode(mode) {
  state.mode = mode;
  if (mode !== 'music') stopMusic();
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  Object.entries(panels).forEach(([name, el]) => { el.hidden = name !== mode; });
  nowLine.textContent = mode === 'off' ? 'Silent' : 'Waiting';
  modeHint.textContent = {
    music: 'Typing plays the song. Stop typing and it stops.',
    fx: 'Every key gets a sound effect.',
    off: 'Typing stays silent.'
  }[mode];
  window.keyJam.modeChanged(mode);
}

document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

function flash(el) {
  el.classList.add('hit');
  clearTimeout(el.flashTimer);
  el.flashTimer = setTimeout(() => el.classList.remove('hit'), 120);
}

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

const FX_KEYS = {
  0x001C: ['bomb', explosion], // Enter
  0x0039: ['gun', gun],        // Space
  0x000E: ['pupu', plop]       // Backspace
};

function playFx(keycode) {
  const [name, fallback] = FX_KEYS[keycode] || ['duck', quack];
  playSample(name, fallback);
  flash(document.querySelector(`[data-fx="${name}"]`));
  nowLine.textContent = name;
}

function currentPlayhead() {
  if (!state.musicSource) return state.playhead;
  const elapsed = state.ctx.currentTime - state.playStartedAt;
  return (state.playStartOffset + elapsed) % state.musicBuffer.duration;
}

function drawProgress() {
  progressFill.style.width = `${(currentPlayhead() / state.musicBuffer.duration) * 100}%`;
  if (state.musicSource) state.frame = requestAnimationFrame(drawProgress);
}

function stopMusic() {
  clearTimeout(state.stopTimer);
  state.stopTimer = null;
  if (!state.musicSource) return;
  const ctx = audioContext();
  const t = ctx.currentTime;
  state.playhead = currentPlayhead();
  // Short fade so the cut doesn't click.
  state.musicGain.gain.setTargetAtTime(0, t, .04);
  state.musicSource.stop(t + .2);
  state.musicSource = null;
  state.musicGain = null;
  cancelAnimationFrame(state.frame);
  if (state.mode === 'music') nowLine.textContent = 'Paused';
}

async function playMusic() {
  const buffer = await ensureMusic();
  if (!buffer || state.mode !== 'music') return;
  const ctx = audioContext();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

  if (!state.musicSource) {
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(.92, t + .03);
    source.connect(gain).connect(ctx.destination);
    source.start(t, state.playhead);
    state.musicSource = source;
    state.musicGain = gain;
    state.playStartedAt = t;
    state.playStartOffset = state.playhead;
    state.frame = requestAnimationFrame(drawProgress);
    nowLine.textContent = 'Playing';
  }

  clearTimeout(state.stopTimer);
  state.stopTimer = setTimeout(stopMusic, state.holdMs);
}

// uiohook keycodes are PC scan codes (set 1).
const KEY_NAMES = {
  0x001C: 'ENTER', 0x0039: 'SPACE', 0x000E: 'DELETE', 0x000F: 'TAB', 0x0001: 'ESC',
  0x002A: 'SHIFT', 0x0036: 'SHIFT', 0x001D: 'CTRL', 0x0038: 'OPT', 0x0E5B: 'CMD', 0x0E5C: 'CMD', 0x003A: 'CAPS',
  0xE048: '↑', 0xE050: '↓', 0xE04B: '←', 0xE04D: '→',
  0x000C: '-', 0x000D: '=', 0x001A: '[', 0x001B: ']', 0x0027: ';', 0x0028: "'", 0x0029: '`',
  0x002B: '\\', 0x0033: ',', 0x0034: '.', 0x0035: '/'
};
[['QWERTYUIOP', 0x10], ['ASDFGHJKL', 0x1E], ['ZXCVBNM', 0x2C], ['1234567890', 0x02]].forEach(([row, start]) => {
  [...row].forEach((ch, i) => { KEY_NAMES[start + i] = ch; });
});

function keyLabel(code) {
  return KEY_NAMES[code] || '•';
}

window.keyJam.onGlobalKeydown(async event => {
  state.count++;
  const label = keyLabel(event.keycode);
  lastKey.textContent = label;
  flash(lastKey);
  eventCount.textContent = `${state.count} hit${state.count === 1 ? '' : 's'}`;
  if (state.mode === 'fx') playFx(event.keycode);
  if (state.mode === 'music') playMusic();
});

function showKeyboardStatus(status) {
  permissionNotice.hidden = status === 'listening';
  statusBadge.textContent = { listening: 'Listening', 'needs-permission': 'No access', 'needs-restart': 'Restart' }[status];
  statusBadge.classList.toggle('warn', status !== 'listening');
  if (status === 'needs-permission') {
    permissionTitle.textContent = 'Keyboard access needed';
    permissionText.textContent = 'Turn on KeyJam in Privacy & Security → Accessibility. It starts working as soon as it’s on.';
    openSettings.hidden = false;
    relaunchApp.hidden = true;
  }
  if (status === 'needs-restart') {
    permissionTitle.textContent = 'Almost there';
    permissionText.textContent = 'Access is on, but macOS needs KeyJam to restart before it takes effect.';
    openSettings.hidden = true;
    relaunchApp.hidden = false;
  }
}

openSettings.addEventListener('click', () => window.keyJam.openAccessibilitySettings());
document.getElementById('hideWindow').addEventListener('click', () => window.keyJam.hideWindow());
document.getElementById('quitApp').addEventListener('click', () => window.keyJam.quit());
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.keyJam.hideWindow(); });
window.keyJam.onSetMode(setMode);

// The window is sized to fit its content, which changes with mode and the permission notice.
new ResizeObserver(() => window.keyJam.setContentHeight(document.getElementById('root').offsetHeight))
  .observe(document.getElementById('root'));
relaunchApp.addEventListener('click', () => window.keyJam.relaunch());
window.keyJam.onKeyboardStatus(showKeyboardStatus);
window.keyJam.getKeyboardStatus().then(showKeyboardStatus);

ensureMusic();
loadFx();
setMode('music');
