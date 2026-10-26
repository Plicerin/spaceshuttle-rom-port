# Space Shuttle: A Journey into Space (Atari 2600) — ROM translation

Jessica Stevens' *Space Shuttle* (Activision, 1983; credited at the time as Steve
Kitchen) for the browser: the
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
| Joystick, button | Hand controller           | arrows / WASD, `Space` or `Z` |

On a gamepad: stick or D-pad, A/B/X/Y for the button, Start (hold) Activate
Countdown, Back (hold) Status, left bumper Primary Engines, right bumper Cargo
Doors / Gear, left trigger Backup Engines.

The original flight manual is at the Internet Archive:
<https://archive.org/details/Space_Shuttle_Journey_Into_Space_1983_Activision>.

Flight 1 (hold Status until it reads FLT# 1, then Activate Countdown) flies the
whole mission by itself. Holding Activate Countdown for about two seconds in
flight goes back to the launch pad (the 1983 manual says Status). The page's
"How to fly" has the checklists for every stage.

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
4. `tools/verify-recomp.mjs [frames] [seed] [auto|random|pilot]` runs the
   translation and the ROM side by side and compares registers, bank, cycles,
   RAM, every TIA write and every pixel after each frame. Inputs: the
   autosimulator's whole mission; random console and stick input; take-overs
   from the autopilot late in the mission (env `TAKEOVER`); and a scripted
   pilot for flights 2 and 3 (env `FLIGHT`, `ASCENT`, `DUTY`) that follows the
   manual's launch sequence by reading the flight number ($A0) and the mission
   clock ($9C) from RAM. Recorded flights in `tools/replays/` (mode `replay`,
   env `REPLAY`): a careful pilot's whole flight 3, from launch through a
   docking, the deorbit burn and reentry to the landing, flown with the stick,
   button and switches only; and a restart in flight. 381,000 frames: no
   differences. `tools/verified-coverage.mjs` combines the runs: 2,962 of the
   3,002 instructions (98.7%) were executed in the comparisons. `tools/cov-pilot.mjs`
   is the same pilot for the coverage runs.

`tools/gen-images.mjs` renders the site's pictures from the translation.

## The annotated disassembly

`space_shuttle.asm` is the disassembly with names: the TIA and RIOT
registers, a RAM map, the routines, the main tables and section headers for
the frame (bank 1's game logic and cockpit windows, bank 0's lower panel and
overscan logic, the bank switches between them). It reassembles byte-identically,
and the translation takes its labels and comments from it.

Names are given only where the code and the running cartridge agree. The
sources: reading the code; `tools/ramref.mjs` (who reads and writes each
variable, and its values in each phase of the autosimulator's mission); the
status pages drawn with each page number forced, which give the readouts'
meanings (SP is `$97:$96`, ALT `$99:$98`, FUEL `$9B:$9A`, MET `$9D:$9C`, STAT
`$9F:$9E`...); and the manual's stat message numbers, which match the abort
codes in the code. Variables not yet understood keep neutral names (`ram_XX`,
`LXXXX`), and comments marked "?" are leads, not facts. The names live in
`tools/annotations.mjs`; `node tools/disasm.mjs` regenerates the source.

*Space Shuttle: A Journey into Space* is © 1983 Activision. An unofficial
preservation project, not affiliated with Activision or NASA.
