// Differential test of the translated cartridge (src/shuttleMachine.mjs)
// against the real ROM interpreted on the 6502 core: both get the same inputs
// each frame, and after every frame the CPU registers, the bank, the cycle
// count, RAM, the TIA write log and the finished picture must be identical,
// and every ROM read the translation makes must land on a byte of its data
// image.
// Inputs ('auto'): Flight 1, the autosimulator, flown hands-off from the
// countdown to the landing, then over again. ('random'): Status (Select)
// presses, Activate Countdown (Reset), and random joystick, fire, Color/B&W
// and difficulty switches, so flights 1-3 start, abort and get piloted badly.
// usage: node tools/verify-recomp.mjs [frames] [seed] [auto|random]
import { VCS, loadRom } from './atari/vcs.mjs';
import { ShuttleMachine } from '../src/shuttleMachine.mjs';
import { ROM_DATA } from '../src/shuttleRomData.mjs';

const frames = Number(process.argv[2] ?? 3000), seed = Number(process.argv[3] ?? 1), mode = process.argv[4] ?? 'random';
const rom = new VCS(loadRom());
const js = new ShuttleMachine();
const mapped = new Uint8Array(8192);
for (const [at, h] of ROM_DATA) for (let i = 0; i < h.length / 2; i += 1) mapped[at + i] = 1;
const unmapped = new Set();
const busRead = js.bus.read.bind(js.bus);
js.bus.read = (addr) => {
  if ((addr & 0x1000) && !mapped[(js.bus.bank << 12) | (addr & 0xfff)]) unmapped.add(`bank ${js.bus.bank} $${(addr & 0x1fff).toString(16)}`);
  return busRead(addr);
};
let s = seed >>> 0;
const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const hex = (v) => v.toString(16);

// switches: bit 0 Reset (Activate Countdown), bit 1 Select (Status), bit 3
// Color/B&W (Primary Engines), bit 6 left difficulty (Backup Engines), bit 7
// right difficulty (Cargo Doors/Landing Gear); low = pressed / B&W / B
let stick = 0xff, fire = 0x80, held = 0x0b, bad = 0;
for (let f = 0; f < frames; f += 1) {
  let swchb = held;
  if (mode === 'auto') {
    // every 45000 frames: Status held 150 frames (FLT# 3 -> 1), then Activate Countdown
    const t = f % 45000;
    stick = 0xff; fire = 0x80; swchb = 0x0b;
    if (t >= 60 && t < 210) swchb &= ~0x02;
    if (t >= 240 && t < 250) swchb &= ~0x01;
  } else {
    if (f % 30 === 0) {
      stick = [0x7f, 0xbf, 0xdf, 0xef, 0x5f, 0x6f, 0x9f, 0xaf, 0xff][Math.floor(rand() * 9)];
      fire = rand() < 0.35 ? 0x00 : 0x80;
      if (rand() < 0.2) held ^= [0x08, 0x40, 0x80][Math.floor(rand() * 3)];
    }
    swchb = held;
    const t = f % 6000;
    if (t < 160 && rand() < 0.5) swchb &= ~0x02;   // Status: choose a flight
    if (t >= 300 && t < 306) swchb &= ~0x01;       // Activate Countdown
    if (t > 400 && rand() < 0.002) swchb &= ~0x02; // a Status look now and then
  }
  for (const m of [rom, js.bus]) { m.swcha = stick; m.inpt4 = fire; m.swchb = swchb; }
  rom.runFrames(1);
  js.runFrame();
  const diffs = [];
  for (const r of ['a', 'x', 'y', 's', 'p', 'pc', 'cycles']) if (rom.cpu[r] !== js.cpu[r]) diffs.push(`${r} rom ${hex(rom.cpu[r])} js ${hex(js.cpu[r])}`);
  if (rom.bank !== js.bus.bank) diffs.push(`bank rom ${rom.bank} js ${js.bus.bank}`);
  for (let i = 0; i < 128; i += 1) if (rom.ram[i] !== js.bus.ram[i]) diffs.push(`$${hex(0x80 + i)} rom ${hex(rom.ram[i])} js ${hex(js.bus.ram[i])}`);
  const wr = rom.lastFrameWrites, wj = js.bus.lastFrameWrites;
  if (wr.length !== wj.length) diffs.push(`writes rom ${wr.length} js ${wj.length}`);
  for (let i = 0; i < Math.min(wr.length, wj.length); i += 1) {
    if (wr[i].reg !== wj[i].reg || wr[i].value !== wj[i].value || wr[i].cycle !== wj[i].cycle) { diffs.push(`write ${i} rom ${JSON.stringify(wr[i])} js ${JSON.stringify(wj[i])}`); break; }
  }
  const pr = rom.tia.lastFrame, pj = js.bus.tia.lastFrame;
  if (pr && pr.some((row, y) => row.some((c, x) => c !== pj[y][x]))) diffs.push('picture differs');
  if (diffs.length) { bad += 1; if (bad <= 5) console.log(`frame ${f}: ${diffs.slice(0, 8).join(', ')}`); if (bad === 5) break; }
}
if (unmapped.size) console.log('reads outside the data image:', [...unmapped].slice(0, 20).join(', '));
console.log({ frames, mode, seed, bad, unmapped: unmapped.size });
process.exit(bad || unmapped.size ? 1 : 0);
