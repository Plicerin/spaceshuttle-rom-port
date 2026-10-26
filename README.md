# Space Shuttle: A Journey into Space (Atari 2600) — ROM translation

Steve Kitchen's *Space Shuttle* (Activision, 1983) for the browser: the
cartridge's 6502 program translated into JavaScript one instruction at a time,
with every cycle counted, running on a model of the 2600's TIA and RIOT chips.
A 6502 core runs the real ROM beside the translation to prove that the two
match frame by frame.

The ROM is not included. The tools expect the NTSC 8K cartridge (MD5
`5894c9c0c1e7e29f3ab86c6d3f673361`) at `rom/space_shuttle.a26`.

## Controls

Every console switch is a cockpit control; the page has buttons for them.

| Console        | Flight deck                 | Keyboard   |
|----------------|-----------------------------|------------|
| Game Select    | Status (hold)               | `X`        |
| Game Reset     | Activate Countdown (hold)   | `Enter`    |
| Color/B&W      | Primary Engines (Color = on)| `E`        |
| Left difficulty| Backup Engines (A = on)     | `B`        |
| Right difficulty| Cargo Doors / Landing Gear (A = open / down) | `C` |
| Joystick, button | Hand controller           | arrows / WASD, `Space` |

Flight 1 (hold Status until it reads FLT# 1, then Activate Countdown) flies the
whole mission by itself.

## How it was made

There was no published disassembly, so the cartridge was disassembled from scratch:

1. `tools/coverage.mjs`, `tools/cov-scenario.mjs` run the real cartridge
   (random input; the autosimulator's whole mission; flights 2 and 3) and record
   every instruction executed and every ROM byte read as data.
2. `tools/disasm.mjs` writes DASM source from that (plus static tracing from the
   executed code, stopping at undefined opcodes and at bytes read as data), with
   the fifteen places where a `BIT` instruction hides another one.
   `tools/build-rom.ps1` reassembles it and checks the MD5: byte-identical.
3. `tools/recompile.mjs` translates every instruction into `src/shuttleRecomp.mjs`
   and puts the bytes no instruction occupies in `src/shuttleRomData.mjs`.
   The cartridge is 8K with F8 bank switching: bank 0 is assembled at $D000,
   bank 1 at $F000, and the code dispatches on bank and address; every frame the
   game jumps to $F000, where `BIT $FFF8` switches to the drawing bank.
4. `tools/verify-recomp.mjs [frames] [seed] [auto|random]` runs the translation
   and the ROM side by side and compares registers, bank, cycles, RAM, every TIA
   write and every pixel after each frame. 105,000 frames (the autosimulator's
   mission and two random seeds): no differences.

`tools/gen-images.mjs` renders the site's pictures from the translation.

*Space Shuttle: A Journey into Space* is © 1983 Activision. An unofficial
preservation project, not affiliated with Activision or NASA.
