// Dev oracle: the real cartridge interpreted by the 6502 core on the shared
// bus. Not used by the game itself.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { M6502 } from '../../src/cpu6502.mjs';
import { VcsBus, TIA, CYCLES_PER_LINE } from '../../src/vcsBus.mjs';

export { TIA, CYCLES_PER_LINE };

// Space Shuttle: A Journey into Space (Activision, 1983), NTSC, 8K F8
// (each bank starts with BIT $FFF8 / BIT $FFF9: a JMP to $x000 switches banks)
export const ROM_MD5 = '5894c9c0c1e7e29f3ab86c6d3f673361';

export function loadRom(path = 'rom/space_shuttle.a26') {
  const rom = readFileSync(path);
  const md5 = createHash('md5').update(rom).digest('hex');
  if (md5 !== ROM_MD5) throw new Error(`unexpected ROM md5 ${md5}`);
  return rom;
}

export class VCS extends VcsBus {
  constructor(rom, options = {}) {
    super(rom, options);
    this.cpu = new M6502(this);
    this.cpu.reset();
  }
}
