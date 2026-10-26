// Dev: run a scripted input sequence on the real cartridge and save chosen frames.
// usage: node tools/scenario.mjs '<json steps>' frame,frame,...
//   steps: [{ "frames": n, "select": 1, "reset": 1, "stick": "ff", "fire": 1, "bw": 1, "leftA": 1, "rightA": 1 }, ...]
//   (bw: Color/B&W in B&W = Primary Engines on; leftA: left difficulty A = Backup Engines; rightA: right A = cargo doors/gear)
import { mkdirSync } from 'node:fs';
import { VCS, loadRom } from './atari/vcs.mjs';
import { writeFramePng } from './atari/png.mjs';

const steps = JSON.parse(process.argv[2]);
const shots = new Set((process.argv[3] ?? '').split(',').filter(Boolean).map(Number));
const vcs = new VCS(loadRom());
mkdirSync('tools/out', { recursive: true });
let f = 0;
for (const s of steps) for (let k = 0; k < s.frames; k += 1) {
  vcs.swcha = parseInt(s.stick ?? 'ff', 16);
  vcs.inpt4 = s.fire ? 0 : 0x80;
  vcs.swchb = (s.reset ? 0 : 1) | (s.select ? 0 : 2) | (s.bw ? 0 : 8) | (s.leftA ? 0x40 : 0) | (s.rightA ? 0x80 : 0);
  vcs.runFrames(1);
  f += 1;
  if (shots.has(f)) { writeFramePng(`tools/out/s${f}.png`, vcs.tia.lastFrame.slice(0, 262), 2, 1); console.log(`frame ${f} saved; RAM ${[...vcs.ram].map((v) => v.toString(16).padStart(2, '0')).join('')}`); }
}
