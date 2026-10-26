// Dev: play a scripted input sequence (as tools/scenario.mjs), add every
// executed instruction to tools/out/coverage.json, and save a frame every
// `every` frames as tools/out/c<frame>.png.
// usage: node tools/cov-scenario.mjs '<json steps>' [every]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { VCS, loadRom } from './atari/vcs.mjs';
import { writeFramePng } from './atari/png.mjs';

const steps = JSON.parse(process.argv[2]);
const every = Number(process.argv[3] ?? 0);
const path = 'tools/out/coverage.json';
const old = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { code: [[], []], data: [[], []] };
const starts = [new Set(old.code[0]), new Set(old.code[1])];
const reads = [new Set(old.data[0]), new Set(old.data[1])]; // ROM bytes read as data
let insPc = 0;
const before = starts[0].size + starts[1].size;
const vcs = new VCS(loadRom());
vcs.onRead = (a) => { if ((a & 0x1000) && ((a - insPc) & 0x1fff) > 2) reads[vcs.bank].add(a & 0xfff); };
mkdirSync('tools/out', { recursive: true });
let f = 0;
// a { "frames": n, "random": seed } step: joystick, fire, Color/B&W and the
// difficulties change at random every 4-90 frames; Select now and then
let seed = 1, held = { stick: 'ff' }, hold = 0;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) % n; };
for (const s0 of steps) { if (s0.random) seed = s0.random; for (let k = 0; k < s0.frames; k += 1) {
  let s = s0;
  if (s0.random) {
    if (hold-- <= 0) {
      hold = 4 + rnd(90);
      held = { stick: ['ff', 'ef', 'df', 'bf', '7f', 'af', '6f', '9f', '5f'][rnd(9)], fire: rnd(3) === 0, bw: rnd(2) === 0 ? !held.bw : held.bw, leftA: rnd(6) === 0 ? !held.leftA : held.leftA, rightA: rnd(4) === 0 ? !held.rightA : held.rightA };
    }
    s = { ...held, select: rnd(250) === 0 };
  }
  vcs.swcha = parseInt(s.stick ?? 'ff', 16);
  vcs.inpt4 = s.fire ? 0 : 0x80;
  vcs.swchb = (s.reset ? 0 : 1) | (s.select ? 0 : 2) | (s.bw ? 0 : 8) | (s.leftA ? 0x40 : 0) | (s.rightA ? 0x80 : 0);
  const target = vcs.frame + 1;
  while (vcs.frame < target) { starts[vcs.bank].add(vcs.cpu.pc & 0xfff); insPc = vcs.cpu.pc & 0x1fff; vcs.cpu.step(); }
  f += 1;
  if (every && f % every === 0) writeFramePng(`tools/out/c${f}.png`, vcs.tia.lastFrame.slice(0, 262), 2, 1);
} }
writeFileSync(path, JSON.stringify({ code: starts.map((s) => [...s].sort((a, b) => a - b)), data: reads.map((s) => [...s].sort((a, b) => a - b)) }));
console.log(`${f} frames; coverage ${before} -> ${starts[0].size + starts[1].size} (${starts[0].size} + ${starts[1].size}); data bytes read ${reads[0].size} + ${reads[1].size}`);
