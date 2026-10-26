// Dev: disassemble the cartridge (8K F8: bank 0 assembled at $D000, bank 1
// at $F000) into DASM source that reassembles byte-identically.
// Code = what the coverage run executed (tools/out/coverage.json, ground
// truth) + static extensions from it (untaken branches, JMP/JSR targets, JSR
// returns), each kept only if it never meets an undefined opcode. JMP/JSR to
// $x000 enters the other bank at $x003 (each bank starts with BIT $FFF8 /
// BIT $FFF9). Where one instruction hides another (BIT $xxxx skipping a 2-byte
// instruction that another path enters), the hiding bytes become .byte.
// usage: node tools/disasm.mjs  -> tools/build/space_shuttle_raw.asm, tools/build/code.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadRom } from './atari/vcs.mjs';

const rom = loadRom();
const ORIGIN = [0xd000, 0xf000];
const LEN = { imp: 1, acc: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, izx: 2, izy: 2, rel: 2, abs: 3, abx: 3, aby: 3, ind: 3 };
const OPS = {};
const def = (mn, list) => list.forEach(([op, mode]) => { OPS[op] = { mn, mode }; });
def('adc', [[0x69, 'imm'], [0x65, 'zp'], [0x75, 'zpx'], [0x6d, 'abs'], [0x7d, 'abx'], [0x79, 'aby'], [0x61, 'izx'], [0x71, 'izy']]);
def('and', [[0x29, 'imm'], [0x25, 'zp'], [0x35, 'zpx'], [0x2d, 'abs'], [0x3d, 'abx'], [0x39, 'aby'], [0x21, 'izx'], [0x31, 'izy']]);
def('asl', [[0x0a, 'acc'], [0x06, 'zp'], [0x16, 'zpx'], [0x0e, 'abs'], [0x1e, 'abx']]);
def('bit', [[0x24, 'zp'], [0x2c, 'abs']]);
def('bpl', [[0x10, 'rel']]); def('bmi', [[0x30, 'rel']]); def('bvc', [[0x50, 'rel']]); def('bvs', [[0x70, 'rel']]);
def('bcc', [[0x90, 'rel']]); def('bcs', [[0xb0, 'rel']]); def('bne', [[0xd0, 'rel']]); def('beq', [[0xf0, 'rel']]);
def('brk', [[0x00, 'imp']]);
def('cmp', [[0xc9, 'imm'], [0xc5, 'zp'], [0xd5, 'zpx'], [0xcd, 'abs'], [0xdd, 'abx'], [0xd9, 'aby'], [0xc1, 'izx'], [0xd1, 'izy']]);
def('cpx', [[0xe0, 'imm'], [0xe4, 'zp'], [0xec, 'abs']]);
def('cpy', [[0xc0, 'imm'], [0xc4, 'zp'], [0xcc, 'abs']]);
def('dec', [[0xc6, 'zp'], [0xd6, 'zpx'], [0xce, 'abs'], [0xde, 'abx']]);
def('eor', [[0x49, 'imm'], [0x45, 'zp'], [0x55, 'zpx'], [0x4d, 'abs'], [0x5d, 'abx'], [0x59, 'aby'], [0x41, 'izx'], [0x51, 'izy']]);
def('clc', [[0x18, 'imp']]); def('sec', [[0x38, 'imp']]); def('cli', [[0x58, 'imp']]); def('sei', [[0x78, 'imp']]);
def('clv', [[0xb8, 'imp']]); def('cld', [[0xd8, 'imp']]); def('sed', [[0xf8, 'imp']]);
def('inc', [[0xe6, 'zp'], [0xf6, 'zpx'], [0xee, 'abs'], [0xfe, 'abx']]);
def('jmp', [[0x4c, 'abs'], [0x6c, 'ind']]);
def('jsr', [[0x20, 'abs']]);
def('lda', [[0xa9, 'imm'], [0xa5, 'zp'], [0xb5, 'zpx'], [0xad, 'abs'], [0xbd, 'abx'], [0xb9, 'aby'], [0xa1, 'izx'], [0xb1, 'izy']]);
def('ldx', [[0xa2, 'imm'], [0xa6, 'zp'], [0xb6, 'zpy'], [0xae, 'abs'], [0xbe, 'aby']]);
def('ldy', [[0xa0, 'imm'], [0xa4, 'zp'], [0xb4, 'zpx'], [0xac, 'abs'], [0xbc, 'abx']]);
def('lsr', [[0x4a, 'acc'], [0x46, 'zp'], [0x56, 'zpx'], [0x4e, 'abs'], [0x5e, 'abx']]);
def('nop', [[0xea, 'imp']]);
def('ora', [[0x09, 'imm'], [0x05, 'zp'], [0x15, 'zpx'], [0x0d, 'abs'], [0x1d, 'abx'], [0x19, 'aby'], [0x01, 'izx'], [0x11, 'izy']]);
def('tax', [[0xaa, 'imp']]); def('txa', [[0x8a, 'imp']]); def('dex', [[0xca, 'imp']]); def('inx', [[0xe8, 'imp']]);
def('tay', [[0xa8, 'imp']]); def('tya', [[0x98, 'imp']]); def('dey', [[0x88, 'imp']]); def('iny', [[0xc8, 'imp']]);
def('rol', [[0x2a, 'acc'], [0x26, 'zp'], [0x36, 'zpx'], [0x2e, 'abs'], [0x3e, 'abx']]);
def('ror', [[0x6a, 'acc'], [0x66, 'zp'], [0x76, 'zpx'], [0x6e, 'abs'], [0x7e, 'abx']]);
def('rti', [[0x40, 'imp']]); def('rts', [[0x60, 'imp']]);
def('sbc', [[0xe9, 'imm'], [0xe5, 'zp'], [0xf5, 'zpx'], [0xed, 'abs'], [0xfd, 'abx'], [0xf9, 'aby'], [0xe1, 'izx'], [0xf1, 'izy']]);
def('sta', [[0x85, 'zp'], [0x95, 'zpx'], [0x8d, 'abs'], [0x9d, 'abx'], [0x99, 'aby'], [0x81, 'izx'], [0x91, 'izy']]);
def('txs', [[0x9a, 'imp']]); def('tsx', [[0xba, 'imp']]); def('pha', [[0x48, 'imp']]); def('pla', [[0x68, 'imp']]);
def('php', [[0x08, 'imp']]); def('plp', [[0x28, 'imp']]);
def('stx', [[0x86, 'zp'], [0x96, 'zpy'], [0x8e, 'abs']]);
def('sty', [[0x84, 'zp'], [0x94, 'zpx'], [0x8c, 'abs']]);

const byte = (bank, off) => rom[bank * 4096 + (off & 0xfff)];
const hex = (v, w) => `$${v.toString(16).toUpperCase().padStart(w, '0')}`;
const decode = (bank, off) => {
  const op = OPS[byte(bank, off)];
  if (!op) return null;
  const len = LEN[op.mode];
  if (off + len > 0x1000) return null;
  const lo = byte(bank, off + 1), hi = byte(bank, off + 2);
  return { ...op, op: byte(bank, off), len, val: len === 2 ? lo : lo | (hi << 8) };
};
const relTarget = (off, ins) => (off + 2 + ((ins.val ^ 0x80) - 0x80)) & 0xfff;
const succ = (bank, off, ins) => {
  const out = [];
  if (ins.mode === 'rel') out.push([bank, off + 2], [bank, relTarget(off, ins)]);
  else if ((ins.mn === 'jmp' && ins.mode === 'abs') || ins.mn === 'jsr') {
    out.push((ins.val & 0xfff) === 0 ? [1 - bank, 0x003] : [bank, ins.val & 0xfff]);
    if (ins.mn === 'jsr') out.push([bank, off + 3]);
  } else if (!['rts', 'rti', 'brk', 'jmp'].includes(ins.mn)) out.push([bank, off + ins.len]);
  return out;
};

// ---- code
const cov = JSON.parse(readFileSync('tools/out/coverage.json', 'utf8'));
const code = [new Map(), new Map()];
const executed = [new Set(cov.code[0]), new Set(cov.code[1])];
const readAsData = [new Set(cov.data[0]), new Set(cov.data[1])]; // ROM bytes the cartridge reads as tables
for (let b = 0; b < 2; b += 1) for (const off of executed[b]) {
  const ins = decode(b, off);
  if (!ins) throw new Error(`executed undefined opcode ${hex(byte(b, off), 2)} at ${hex(ORIGIN[b] + off, 4)}`);
  code[b].set(off, ins);
}
const dropped = [], pending = [];
function extend(bank, start) {
  const path = [], work = [start], seen = new Set();
  while (work.length) {
    const off = work.pop() & 0xfff;
    if (seen.has(off) || code[bank].has(off)) continue;
    seen.add(off);
    const ins = decode(bank, off);
    if (!ins) { dropped.push(`${hex(ORIGIN[bank] + start, 4)} -> undefined opcode at ${hex(ORIGIN[bank] + off, 4)}`); return; }
    if ([...Array(ins.len).keys()].some((k) => readAsData[bank].has(off + k))) { dropped.push(`${hex(ORIGIN[bank] + start, 4)} -> bytes read as data at ${hex(ORIGIN[bank] + off, 4)}`); return; }
    path.push([off, ins]);
    for (const [b2, o2] of succ(bank, off, ins)) if (b2 === bank) work.push(o2);
  }
  for (const [off, ins] of path) code[bank].set(off, ins);
  for (const [off, ins] of path) pending.push(...succ(bank, off, ins));
}
for (let b = 0; b < 2; b += 1) {
  pending.push([b, (byte(b, 0xffc) | (byte(b, 0xffd) << 8)) & 0xfff], [b, 0x003]);
  for (const [off, ins] of code[b]) pending.push(...succ(b, off, ins));
}
while (pending.length) { const [b, o] = pending.pop(); if (!code[b].has(o & 0xfff)) extend(b, o & 0xfff); }
const overlaps = [];
for (let b = 0; b < 2; b += 1) for (const [off, ins] of code[b]) for (let k = 1; k < ins.len; k += 1) if (code[b].has(off + k)) overlaps.push(`${hex(ORIGIN[b] + off, 4)} ${ins.mn} hides ${hex(ORIGIN[b] + off + k, 4)} ${code[b].get(off + k).mn}${executed[b].has(off) && executed[b].has(off + k) ? ' (both executed)' : ''}`);

// ---- labels: branch, JMP and JSR targets that start an instruction in the same bank
const label = (bank, off) => `L${(ORIGIN[bank] + off).toString(16).toUpperCase()}`;
const targets = [new Set(), new Set()];
for (let b = 0; b < 2; b += 1) for (const [off, ins] of code[b]) {
  if (ins.mode === 'rel') { const t = relTarget(off, ins); if (code[b].has(t)) targets[b].add(t); }
  else if ((ins.mn === 'jmp' || ins.mn === 'jsr') && ins.mode === 'abs' && (ins.val & 0xfff) !== 0 && (ins.val >> 12) === ORIGIN[b] >> 12 && code[b].has(ins.val & 0xfff)) targets[b].add(ins.val & 0xfff);
}

// ---- source
function operand(bank, off, ins) {
  const v = ins.val;
  switch (ins.mode) {
    case 'imp': case 'acc': return [ins.mn, ''];
    case 'imm': return [ins.mn, `#${hex(v, 2)}`];
    case 'zp': return [ins.mn, hex(v, 2)];
    case 'zpx': return [ins.mn, `${hex(v, 2)},x`];
    case 'zpy': return [ins.mn, `${hex(v, 2)},y`];
    case 'izx': return [ins.mn, `(${hex(v, 2)},x)`];
    case 'izy': return [ins.mn, `(${hex(v, 2)}),y`];
    case 'ind': return [ins.mn, `(${hex(v, 4)})`];
    case 'rel': { const t = relTarget(off, ins); return [ins.mn, targets[bank].has(t) ? label(bank, t) : null]; }
    default: {
      const w = v < 0x100 ? '.w' : ''; // keep the absolute encoding of a zero-page address
      const own = (ins.mn === 'jmp' || ins.mn === 'jsr') && (v >> 12) === ORIGIN[bank] >> 12 && targets[bank].has(v & 0xfff);
      const idx = ins.mode === 'abx' ? ',x' : ins.mode === 'aby' ? ',y' : '';
      return [ins.mn + w, (own ? label(bank, v & 0xfff) : hex(v, 4)) + idx];
    }
  }
}
const out = [
  '; Space Shuttle: A Journey into Space (Activision, 1983), NTSC 8K F8',
  '; raw disassembly by tools/disasm.mjs (reassembles byte-identically)',
  '    processor 6502',
];
for (let b = 0; b < 2; b += 1) {
  out.push('', `; ---------------------------------------------------------------- bank ${b}`, `    ORG ${hex(b * 0x1000, 4)}`, `    RORG ${hex(ORIGIN[b], 4)}`);
  let data = [];
  const flush = () => { for (let i = 0; i < data.length; i += 16) out.push(`    .byte ${data.slice(i, i + 16).map((v) => hex(v, 2)).join(',')}`); data = []; };
  for (let off = 0; off < 0x1000;) {
    const ins = code[b].get(off);
    if (!ins) { data.push(byte(b, off)); off += 1; continue; }
    flush();
    if (targets[b].has(off)) out.push(`${label(b, off)}:`);
    const inner = [...Array(ins.len - 1).keys()].map((k) => off + 1 + k).find((o) => code[b].has(o));
    if (inner !== undefined) {
      out.push(`    .byte ${[...Array(inner - off).keys()].map((k) => hex(byte(b, off + k), 2)).join(',')}`.padEnd(30) + `; ${hex(ORIGIN[b] + off, 4)} ${ins.mn}: skips the next instruction on this path`);
      off = inner;
      continue;
    }
    const [mn, opd] = operand(b, off, ins);
    if (opd === null) out.push(`    .byte ${[...Array(ins.len).keys()].map((k) => hex(byte(b, off + k), 2)).join(',')}`.padEnd(30) + `; ${hex(ORIGIN[b] + off, 4)} ${ins.mn} into an instruction`);
    else out.push(`    ${mn}${opd ? ` ${opd}` : ''}`.padEnd(30) + `; ${hex(ORIGIN[b] + off, 4)}${executed[b].has(off) ? '' : ' (not executed in the coverage run)'}`);
    off += ins.len;
  }
  flush();
}
mkdirSync('tools/build', { recursive: true });
writeFileSync('tools/build/space_shuttle_raw.asm', out.join('\n') + '\n');
// the instruction list for tools/recompile.mjs: per bank, [offset, executed in the coverage run]
writeFileSync('tools/build/code.json', JSON.stringify({ code: [0, 1].map((b) => [...code[b].keys()].sort((x, y) => x - y).map((o) => [o, executed[b].has(o) ? 1 : 0])), data: cov.data }));
const n = (b) => [...code[b].values()].reduce((s, i) => s + i.len, 0);
console.log(`code: bank 0 ${code[0].size} instructions (${n(0)} bytes, ${executed[0].size} executed), bank 1 ${code[1].size} (${n(1)} bytes, ${executed[1].size} executed); labels ${targets[0].size} + ${targets[1].size}`);
console.log(`overlapping instructions: ${overlaps.length}${overlaps.length ? `\n  ${overlaps.join('\n  ')}` : ''}`);
if (dropped.length) console.log(`dropped static paths (${dropped.length}):\n  ${dropped.slice(0, 20).join('\n  ')}`);
