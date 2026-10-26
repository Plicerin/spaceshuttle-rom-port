// Playable Space Shuttle for the site: the translated cartridge
// (shuttleMachine.mjs) on a canvas, keyboard input while the game has focus,
// a gamepad (switches on Start, Back, the bumpers and left trigger), touch buttons on phones, the TIA sound worklet, and the flight
// deck console: the cartridge reads every console switch as a cockpit control.
//   Color/B&W          Primary Engines   (Color = on)
//   Left difficulty    Backup Engines    (A = on)
//   Right difficulty   Cargo Doors / Landing Gear (A = open / down)
//   Game Select        Status            (hold)
//   Game Reset         Activate Countdown (hold)
// Mount with mountPlayer(root); root holds the canvas and the [data-*] controls.
import { ShuttleMachine } from './shuttleMachine.mjs';
import { NTSC_PALETTE_RGB } from './palette.mjs';
import { createTiaAudio } from './tiaAudio.mjs';
import { readGamepad, gamepadEdges } from './gamepad.mjs';

export const FIRST_LINE = 38;    // VBLANK goes off in frame line 38 and back on in line 234
export const VISIBLE_LINES = 196;
const FRAME_MS = 1000 / 60;
const KEYS = {
  ArrowRight: 'right', KeyD: 'right', ArrowLeft: 'left', KeyA: 'left',
  ArrowDown: 'down', KeyS: 'down', ArrowUp: 'up', KeyW: 'up', Space: 'fire', KeyZ: 'fire',
};
// toggles (key, label when on / off)
const TOGGLES = {
  primary: { key: 'KeyE', name: 'Primary Engines', on: 'ON', off: 'SHUTDOWN' },
  backup: { key: 'KeyB', name: 'Backup Engines', on: 'ON', off: 'SHUTDOWN' },
  doors: { key: 'KeyC', name: 'Cargo Doors / Gear', on: 'OPEN / DOWN', off: 'CLOSED / UP' },
};
// the pad's console buttons: Start holds Activate Countdown, Back holds Status
const PAD = { countdown: 'start', status: 'back' };
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* fine */ } } };

export function mountPlayer(root) {
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const playButton = root.querySelector('[data-play]');
  const poster = root.querySelector('[data-poster]');
  const hint = root.querySelector('[data-hint]');
  const note = root.querySelector('[data-note]');
  const muteButtons = root.querySelectorAll('[data-mute]');
  const pauseButtons = root.querySelectorAll('[data-pause]');
  const volumeSlider = root.querySelector('[data-volume]');

  const game = new ShuttleMachine();
  const held = new Set();
  // a key or button released before the next frame still counts for that frame
  const tapped = new Set();
  const touch = matchMedia('(pointer: coarse)').matches;
  const audio = createTiaAudio(new URL('./tiaSound.worklet.js', import.meta.url).href);
  const screen = document.createElement('canvas');
  screen.width = 160;
  screen.height = VISIBLE_LINES;
  const screenCtx = screen.getContext('2d');
  const image = screenCtx.createImageData(160, VISIBLE_LINES);

  let started = false, paused = false, muted = false;
  // the pre-flight positions: engines shut down, cargo doors closed (the
  // countdown waits for all three)
  const toggles = { primary: false, backup: false, doors: false };
  const down = { status: false, countdown: false };
  let last = 0, acc = 0, pad = null, frames = 0, padShown = false, padWake = false;

  const setHint = (text) => { if (hint && hint.textContent !== text) hint.textContent = text; };
  // the hint follows the flight: the cartridge's flight number ($A0), whether
  // a flight is under way ($B6) and its phase ($B5: 0 pad, 1 ascent, 2 orbit, 3 entry, 4 landing)
  const status = touch ? 'Status' : 'Status (X)', countdown = touch ? 'Activate Countdown' : 'Activate Countdown (Enter)';
  function phaseHint() {
    const ram = game.bus.ram, flight = ram[0xa0 & 0x7f], phase = ram[0xb5 & 0x7f];
    if (!ram[0xb6 & 0x7f]) return `Hold ${status} to pick a flight (1 flies itself). Engines shut down, doors closed, then hold ${countdown}.`;
    if (flight === 1) return 'Flight 1 flies itself: touch the hand controller to take over.';
    return [
      'Primary Engines on at MET-015. Hold the button the moment MET-004 appears.',
      'Keep T on C with taps, follow the trajectory, keep the plane centred. Engines off at about 205 miles.',
      'Orbit: engines on, pitch -28, engines off, doors open. Dock: Z, Y, then X to 0. Deorbit once X reaches 128.',
      'Reentry: pitch +24, engines off, doors closed. Follow the course on the computer screen.',
      'Landing: turn right to line up, keep steering. Gear down when range goes negative, then hold forward.',
    ][phase] ?? '';
  }
  function showNote() {
    if (!note) return;
    const text = paused ? 'PAUSED' : started && !touch && !pad && document.activeElement !== canvas ? 'Click the screen to use the keyboard' : '';
    note.textContent = text;
    note.hidden = !text;
  }
  const silence = () => audio.setSilent(muted || paused || !started);

  function step() {
    const on = (control) => held.has(control) || tapped.has(control) || !!down[control] || !!(PAD[control] ? !padWake && pad?.[PAD[control]] : pad?.[control]);
    let swcha = 0xff;
    if (on('right')) swcha &= ~0x80;
    if (on('left')) swcha &= ~0x40;
    if (on('down')) swcha &= ~0x20;
    if (on('up')) swcha &= ~0x10;
    game.bus.swcha = swcha;
    game.bus.inpt4 = on('fire') ? 0x00 : 0x80;
    // SWCHB: bit 0 Reset, bit 1 Select (low = pressed), bit 3 Color, bit 6 left difficulty A, bit 7 right A
    game.bus.swchb = (on('countdown') ? 0 : 0x01) | (on('status') ? 0 : 0x02)
      | (toggles.primary ? 0x08 : 0) | (toggles.backup ? 0x40 : 0) | (toggles.doors ? 0x80 : 0);
    game.runFrame();
    tapped.clear();
    audio.update(game.bus.audio);
    frames += 1;
    if (started && frames % 30 === 0) setHint(phaseHint());
  }

  function draw() {
    const rows = game.bus.tia.lastFrame;
    if (!rows) return;
    const data = image.data;
    for (let y = 0; y < VISIBLE_LINES; y += 1) {
      const row = rows[FIRST_LINE + y];
      for (let x = 0; x < 160; x += 1) {
        const rgb = NTSC_PALETTE_RGB[(row[x] >> 1) & 0x7f];
        const o = (y * 160 + x) * 4;
        data[o] = rgb >> 16; data[o + 1] = (rgb >> 8) & 0xff; data[o + 2] = rgb & 0xff; data[o + 3] = 255;
      }
    }
    screenCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(screen, 0, 0, canvas.width, canvas.height);
  }

  function frame(t) {
    if (!last) last = t;
    const dt = Math.min(100, t - last);
    last = t;
    pad = readGamepad();
    const edges = gamepadEdges(pad);
    // the Start or Back press that powers on doesn't also count as Activate Countdown or Status
    if ((edges.start || edges.back) && !started) { play(); padWake = true; }
    if (padWake && !pad?.start && !pad?.back) padWake = false;
    if (edges.lb) flip('primary');
    if (edges.rb) flip('doors');
    if (edges.lt) flip('backup');
    if (!!pad !== padShown) { padShown = !!pad; showNote(); }
    if (!paused && !document.hidden) {
      acc += dt;
      while (acc >= FRAME_MS) { step(); acc -= FRAME_MS; }
    }
    draw();
    requestAnimationFrame(frame);
  }

  async function play() {
    started = true;
    if (poster) poster.hidden = true;
    canvas.focus({ preventScroll: true });
    setHint(phaseHint());
    showNote();
    await audio.start();
    silence();
  }

  function togglePause() {
    paused = !paused;
    pauseButtons.forEach((b) => { b.textContent = paused ? 'Resume' : 'Pause'; });
    showNote();
    silence();
  }

  function toggleMute() {
    muted = !muted;
    muteButtons.forEach((b) => {
      b.textContent = muted ? 'Sound on' : 'Mute';
      b.setAttribute('aria-pressed', String(muted));
    });
    silence();
  }

  // the console switches
  const toggleButtons = {};
  root.querySelectorAll('[data-toggle]').forEach((button) => { toggleButtons[button.dataset.toggle] = button; });
  const showToggle = (name) => {
    const b = toggleButtons[name], t = TOGGLES[name];
    if (!b) return;
    b.querySelector('[data-state]').textContent = toggles[name] ? t.on : t.off;
    b.setAttribute('aria-pressed', String(toggles[name]));
  };
  const flip = (name) => { toggles[name] = !toggles[name]; showToggle(name); };
  for (const name of Object.keys(TOGGLES)) {
    toggleButtons[name]?.addEventListener('click', () => { if (!started) play(); flip(name); canvas.focus({ preventScroll: true }); });
    showToggle(name);
  }
  root.querySelectorAll('[data-press]').forEach((button) => {
    const name = button.dataset.press;
    const press = (event) => { event.preventDefault(); if (!started) play(); down[name] = true; tapped.add(name); try { button.setPointerCapture(event.pointerId); } catch { /* fine */ } };
    const release = () => { down[name] = false; };
    button.addEventListener('pointerdown', press);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(ev, release);
  });

  function setVolume(v) {
    audio.setVolume(v / 100);
    if (volumeSlider) volumeSlider.value = String(v);
    store.set('shuttle-volume', String(v));
  }
  setVolume(Number(store.get('shuttle-volume') ?? 70));
  volumeSlider?.addEventListener('input', () => setVolume(Number(volumeSlider.value)));

  playButton?.addEventListener('click', play);
  pauseButtons.forEach((b) => b.addEventListener('click', () => { if (started) togglePause(); }));
  muteButtons.forEach((b) => b.addEventListener('click', toggleMute));

  canvas.addEventListener('keydown', (event) => {
    const control = KEYS[event.code];
    if (control) { event.preventDefault(); held.add(control); tapped.add(control); }
    if (event.code === 'Enter') { event.preventDefault(); if (!started) play(); down.countdown = true; tapped.add('countdown'); }
    if (event.code === 'KeyX') { down.status = true; tapped.add('status'); }
    for (const [name, t] of Object.entries(TOGGLES)) if (event.code === t.key && !event.repeat) flip(name);
    if (event.code === 'KeyP') togglePause();
    if (event.code === 'KeyM') toggleMute();
  });
  canvas.addEventListener('keyup', (event) => {
    const control = KEYS[event.code];
    if (control) held.delete(control);
    if (event.code === 'Enter') down.countdown = false;
    if (event.code === 'KeyX') down.status = false;
  });
  canvas.addEventListener('blur', () => { held.clear(); down.status = down.countdown = false; showNote(); });
  canvas.addEventListener('focus', showNote);
  canvas.addEventListener('pointerdown', () => { if (!started) play(); });

  // touch controls: hold to press
  root.querySelectorAll('[data-hold]').forEach((button) => {
    const control = button.dataset.hold;
    const press = (event) => {
      event.preventDefault();
      held.add(control);
      if (!started) play();
      try { button.setPointerCapture(event.pointerId); } catch { /* finger already lifted: the press still counts */ }
    };
    const up = () => held.delete(control);
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
  });

  document.addEventListener('visibilitychange', () => (document.hidden ? audio.suspend() : audio.resume()));

  step();
  draw();
  requestAnimationFrame(frame);

  // dev hook for headless checks: runs frames without the animation loop
  return {
    machine: game,
    step(n = 1) { for (let i = 0; i < n; i += 1) step(); draw(); },
    hold(control, on) { if (on) held.add(control); else held.delete(control); },
    press(name, on) { down[name] = on; },
    flip,
    toggles,
    play,
  };
}
