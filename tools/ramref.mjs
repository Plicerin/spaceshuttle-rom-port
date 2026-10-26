// Dev: RAM reference for annotating. For every zero-page variable ($80-$FF):
// the instructions that read and write it (from the disassembly's code list),
// and its values over the Flight 1 autosimulator's mission, sampled per phase
// (pre-launch, countdown, ascent, orbit, reentry, landing).
// usage: node tools/ramref.mjs [addr ...]   -> tools/out/ramref.txt (all) or the given ones
import { readFileSync, writeFileSync } from 'node:fs';
import { VCS, loadRom } from './atari/vcs.mjs';

const rom = loadRom();
const code = JSON.parse(readFileSync('tools/build/code.json', 'utf8')).code;
const ORG = [0xd000, 0xf000];
const LEN = { 0: 1 };
// operand addressing: [len, zp operand?, writes?]
const MODES = {};
const set = (ops, len, zp, w) => ops.forEach((o) => { MODES[o] = [len, zp, w]; });
// zp reads
set([0xa5, 0xa6, 0xa4, 0x65, 0xe5, 0x25, 0x05, 0x45, 0xc5, 0xe4, 0xc4, 0x24, 0xb5, 0xb6, 0xb4, 0x75, 0xf5, 0x35, 0x15, 0x55, 0xd5, 0xb1, 0x71, 0xf1, 0x31, 0x11, 0x51, 0xd1, 0xa1, 0x61, 0xe1, 0x21, 0x01, 0x41, 0xc1], 2, true, false);
// zp writes / read-modify-write
set([0x85, 0x86, 0x84, 0x95, 0x96, 0x94, 0x91, 0x81], 2, true, true);
set([0xe6, 0xc6, 0x06, 0x46, 0x26, 0x66, 0xf6, 0xd6, 0x16, 0x56, 0x36, 0x76], 2, true, 'rmw');
// absolute (.w) forms on RAM
set([0xad, 0xae, 0xac, 0x6d, 0xed, 0x2d, 0x0d, 0x4d, 0xcd, 0xec, 0xcc, 0x2c, 0xbd, 0xb9, 0xbe, 0xbc], 3, false, false);
set([0x8d, 0x8e, 0x8c, 0x9d, 0x99], 3, false, true);
set([0xee, 0xce, 0x0e, 0x4e, 0x2e, 0x6e], 3, false, 'rmw');
const refs = new Map();
for (const b of [0, 1]) for (const [off] of code[b]) {
  const op = rom[b * 4096 + off], m = MODES[op];
  if (!m) continue;
  const v = m[0] === 2 ? rom[b * 4096 + off + 1] : rom[b * 4096 + off + 1] | (rom[b * 4096 + off + 2] << 8);
  if (v < 0x80 || v > 0xff) continue;
  const r = refs.get(v) ?? { r: [], w: [] };
  (m[2] ? r.w : r.r).push((ORG[b] + off).toString(16).toUpperCase());
  if (m[2] === 'rmw') r.r.push((ORG[b] + off).toString(16).toUpperCase());
  refs.set(v, r);
}
// values per phase (Flight 1 hands-off)
const vcs = new VCS(rom);
const PH = [['pre', 0, 240], ['count', 260, 1100], ['ascent', 1200, 6500], ['orbit', 6500, 13000], ['reentry', 13000, 18500], ['landing', 18500, 22000]];
const samples = Object.fromEntries(PH.map(([n]) => [n, []]));
const input = (f) => (f >= 60 && f < 210 ? 0x09 : f >= 240 && f < 250 ? 0x0a : 0x0b);
for (let f = 0; f < 22000; f += 1) {
  vcs.swchb = input(f); vcs.runFrames(1);
  if (f % 20 === 0) for (const [n, a, b] of PH) if (f >= a && f < b) samples[n].push(vcs.ram.slice());
}
const want = process.argv.slice(2).map((x) => parseInt(x.replace('$', ''), 16));
const out = [];
for (let a = 0x80; a <= 0xff; a += 1) {
  if (want.length && !want.includes(a)) continue;
  const r = refs.get(a) ?? { r: [], w: [] };
  const ph = PH.map(([n]) => {
    const vals = samples[n].map((s) => s[a - 0x80]);
    const uniq = [...new Set(vals)];
    if (uniq.length === 1) return `${n} =${uniq[0].toString(16)}`;
    const mn = Math.min(...vals), mx = Math.max(...vals);
    return `${n} ${uniq.length}v ${mn.toString(16)}..${mx.toString(16)}`;
  }).join(' | ');
  out.push(`$${a.toString(16).toUpperCase()}  W ${r.w.length ? r.w.join(' ') : '-'}  R ${r.r.length > 14 ? r.r.slice(0, 14).join(' ') + ` (+${r.r.length - 14})` : r.r.join(' ') || '-'}\n      ${ph}`);
}
const text = out.join('\n');
if (want.length) console.log(text); else { writeFileSync('tools/out/ramref.txt', text + '\n'); console.log('tools/out/ramref.txt written'); }
