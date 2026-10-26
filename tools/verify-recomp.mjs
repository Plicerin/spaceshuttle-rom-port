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
// ('auto' with env TAKEOVER=frame): the autosimulator flies until that
// frame, then random piloting takes over (the joystick hands over control).
// ('pilot'): tools/cov-pilot.mjs's scripted launch (env FLIGHT 2|3, ASCENT
// frames of steady climb, DUTY of the button), then random piloting with
// engine and door switch moves; it reads the flight number and the clock
// from the cartridge's RAM. ('replay', env REPLAY=file): recorded input from
// tools/replays/, runs of [frames, SWCHA, INPT4, SWCHB]: flight3-mission.json
// is a careful pilot's whole flight 3 (launch, docking, deorbit, reentry,
// landing; stick, button and switches only), restart.json a restart in flight.
// usage: node tools/verify-recomp.mjs [frames] [seed] [auto|random|pilot|replay]
import { VCS, loadRom } from './atari/vcs.mjs';
import { ShuttleMachine } from '../src/shuttleMachine.mjs';
import { ROM_DATA } from '../src/shuttleRomData.mjs';

const mode = process.argv[4] ?? 'random', seed = Number(process.argv[3] ?? 1);
const replay = mode === 'replay' ? JSON.parse(readFileSync(process.env.REPLAY, 'utf8')).flatMap(([n, ...input]) => Array(n).fill(input)) : null;
const frames = replay ? replay.length : Number(process.argv[2] ?? 3000);
const rom = new VCS(loadRom());
// every instruction the cartridge executes during the comparison (bank << 12 | offset), saved to
// tools/out/verified-<mode>-<seed>.json so tools/verified-coverage.mjs can combine the runs
import { writeFileSync as saveFile, readFileSync } from 'node:fs';
const ran = new Set();
const romStep = rom.cpu.step.bind(rom.cpu);
rom.cpu.step = () => { ran.add((rom.bank << 12) | (rom.cpu.pc & 0xfff)); return romStep(); };
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
// the pilot: a state machine over the cartridge's RAM (flight $A0, clock $9C)
const P = { phase: 'boot', t: 0, sw: { primary: false, backup: false, doors: false }, hold: 0, input: { stick: 0xff, fire: false } };
const FLIGHT_WANTED = Number(process.env.FLIGHT ?? 2), ASCENT = Number(process.env.ASCENT ?? 6000), DUTY = Number(process.env.DUTY ?? 1);
const ramOf = (a) => rom.ram[a & 0x7f];
function pilot() {
  const o = { stick: 0xff, fire: false, select: false, reset: false };
  P.t += 1;
  if (P.phase === 'boot') { if (P.t > 60) { P.phase = 'select'; P.t = 0; } }
  else if (P.phase === 'select') { if (ramOf(0xa0) === FLIGHT_WANTED || P.t > 600) { P.phase = 'settle'; P.t = 0; } else o.select = true; }
  else if (P.phase === 'settle') { if (P.t > 30) { P.phase = 'countdown'; P.t = 0; } }
  else if (P.phase === 'countdown') {
    if (P.t <= 10) o.reset = true;
    const met = ramOf(0x9c);
    if (met <= 0x14 && P.t > 15) P.sw.primary = true;
    o.fire = met <= 0x04 && P.t > 15 && (DUTY >= 1 || rand() < DUTY);
    if ((met === 0 && P.t > 60) || P.t > 3000) { P.phase = 'ascent'; P.t = 0; }
  } else if (P.phase === 'ascent') {
    o.fire = DUTY >= 1 || rand() < DUTY;
    if (P.t > ASCENT) { P.phase = 'free'; P.t = 0; }
  } else {
    if (P.hold-- <= 0) {
      P.hold = 3 + Math.floor(rand() * 60);
      P.input = { stick: [0xff, 0xef, 0xdf, 0xbf, 0x7f, 0xaf, 0x6f, 0x9f, 0x5f][Math.floor(rand() * 9)], fire: rand() < DUTY * 0.7 };
      if (rand() < 1 / 12) P.sw.primary = !P.sw.primary;
      if (rand() < 1 / 30) P.sw.doors = !P.sw.doors;
      if (rand() < 1 / 80) P.sw.backup = !P.sw.backup;
    }
    o.stick = P.input.stick; o.fire = P.input.fire; o.select = rand() < 1 / 400;
  }
  return { stick: o.stick, fire: o.fire ? 0x00 : 0x80, swchb: (o.reset ? 0 : 1) | (o.select ? 0 : 2) | (P.sw.primary ? 8 : 0) | (P.sw.backup ? 0x40 : 0) | (P.sw.doors ? 0x80 : 0) };
}
for (let f = 0; f < frames; f += 1) {
  let swchb = held;
  if (replay) {
    [stick, fire, swchb] = replay[f];
  } else if (mode === 'pilot') {
    ({ stick, fire, swchb } = pilot());
  } else if (mode === 'auto' && process.env.TAKEOVER && f >= Number(process.env.TAKEOVER)) {
    // the autosimulator flew up to here; touching the joystick hands over the controls
    P.phase = 'free';
    ({ stick, fire, swchb } = pilot());
  } else if (mode === 'auto') {
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
saveFile(`tools/out/verified-${mode}${mode === 'pilot' ? `-${FLIGHT_WANTED}-${ASCENT}-${DUTY}` : ''}${process.env.TAKEOVER ? `-t${process.env.TAKEOVER}` : ''}${replay ? `-${process.env.REPLAY.replace(/.*[\\/]|\.json$/g, '')}` : ''}-${seed}.json`, JSON.stringify([...ran]));
if (unmapped.size) console.log('reads outside the data image:', [...unmapped].slice(0, 20).join(', '));
console.log({ frames, mode, seed, ...(mode === 'pilot' ? { flight: FLIGHT_WANTED, ascent: ASCENT, duty: DUTY } : {}), bad, unmapped: unmapped.size });
process.exit(bad || unmapped.size ? 1 : 0);
