// Dev: a scripted pilot for flights 2 and 3, for coverage. It follows the
// manual's launch sequence, reading the flight number ($A0) and the mission
// clock ($9C, BCD seconds, counting down to launch) from RAM: every switch
// off, Status held until the flight comes up, Activate Countdown, Primary
// Engines on once the clock counts (MET-014; on before the pre-flight
// checks finish holds the countdown), the button held from MET-004 (thrust, pulsed with
// `duty`). After lift-off it pilots at random (stick, button bursts, now and
// then the engine and door switches) for `frames` frames. Every executed
// instruction and ROM data read is added to tools/out/coverage.json.
// usage: node tools/cov-pilot.mjs <flight 2|3> <seed> [frames] [duty 0-1] [every]   (env ASCENT=frames of steady climb first)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { VCS, loadRom } from './atari/vcs.mjs';
import { writeFramePng } from './atari/png.mjs';

const flight = Number(process.argv[2] ?? 2);
let seed = Number(process.argv[3] ?? 1);
const frames = Number(process.argv[4] ?? 20000);
const duty = Number(process.argv[5] ?? 1);
const every = Number(process.argv[6] ?? 0);
const rnd = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) % n; };
const path = 'tools/out/coverage.json';
const old = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { code: [[], []], data: [[], []] };
const starts = [new Set(old.code[0]), new Set(old.code[1])];
const reads = [new Set(old.data[0]), new Set(old.data[1])];
const before = starts[0].size + starts[1].size;
const vcs = new VCS(loadRom());
let insPc = 0;
vcs.onRead = (a) => { if ((a & 0x1000) && ((a - insPc) & 0x1fff) > 2) reads[vcs.bank].add(a & 0xfff); };
mkdirSync('tools/out', { recursive: true });
const FLIGHT = 0xa0, MET = 0x9c;
const ram = (a) => vcs.ram[a & 0x7f];
let f = 0;
const sw = { primary: false, backup: false, doors: false };
function frame({ stick = 0xff, fire = false, select = false, reset = false } = {}) {
  vcs.swcha = stick; vcs.inpt4 = fire ? 0 : 0x80;
  vcs.swchb = (reset ? 0 : 1) | (select ? 0 : 2) | (sw.primary ? 8 : 0) | (sw.backup ? 0x40 : 0) | (sw.doors ? 0x80 : 0);
  const target = vcs.frame + 1;
  while (vcs.frame < target) { starts[vcs.bank].add(vcs.cpu.pc & 0xfff); insPc = vcs.cpu.pc & 0x1fff; vcs.cpu.step(); }
  f += 1;
  if (every && f % every === 0) writeFramePng(`tools/out/p${f}.png`, vcs.tia.lastFrame.slice(0, 262), 2, 1);
}
for (let i = 0; i < 60; i += 1) frame();
// Status held until the flight number comes up (it steps every 48 frames on the flight page)
for (let i = 0; i < 600 && ram(FLIGHT) !== flight; i += 1) frame({ select: true });
for (let i = 0; i < 30; i += 1) frame();
const chosen = ram(FLIGHT);
for (let i = 0; i < 10; i += 1) frame({ reset: true });
// countdown: Primary Engines at MET-015, the button from MET-004, until lift-off (the clock stops counting down)
let launched = false;
for (let i = 0; i < 3000 && !launched; i += 1) {
  const met = ram(MET);
  if (met <= 0x14) sw.primary = true; // once the clock is counting (on during the checks holds the countdown)
  const fire = met <= 0x04 && (duty >= 1 || rnd(100) < duty * 100);
  frame({ fire });
  if (met === 0 && i > 60) launched = true;
}
// ascent: engines on, the button held (pulsed with `duty`), the stick centred, no switch moves
const ascent = Number(process.env.ASCENT ?? 0);
for (let i = 0; i < ascent; i += 1) frame({ fire: duty >= 1 || rnd(100) < duty * 100 });
// then random piloting
let hold = 0, input = {};
for (let i = 0; i < frames; i += 1) {
  if (hold-- <= 0) {
    hold = 3 + rnd(60);
    input = { stick: ['ff', 'ef', 'df', 'bf', '7f', 'af', '6f', '9f', '5f'][rnd(9)], fire: rnd(100) < duty * 70 };
    if (rnd(12) === 0) sw.primary = !sw.primary;
    if (rnd(30) === 0) sw.doors = !sw.doors;
    if (rnd(80) === 0) sw.backup = !sw.backup;
  }
  frame({ stick: parseInt(input.stick, 16), fire: input.fire, select: rnd(400) === 0 });
}
writeFileSync(path, JSON.stringify({ code: starts.map((s) => [...s].sort((a, b) => a - b)), data: reads.map((s) => [...s].sort((a, b) => a - b)) }));
console.log(`flight ${chosen} seed ${process.argv[3]} duty ${duty}: ${f} frames; coverage ${before} -> ${starts[0].size + starts[1].size}`);
