// Annotations for the Space Shuttle disassembly, applied by tools/disasm.mjs
// to write space_shuttle.asm. Names are given only where the code and a check
// against the running cartridge agree; everything else keeps a neutral name
// (ram_XX, LXXXX) and, where something is known about it, a comment with a "?".
//
// Sources of the facts: reading the code; tools/ramref.mjs (who reads and
// writes each variable, its values in each phase of the autosimulator's
// mission); the status pages drawn with each page number forced (their labels:
// SP, ALT, FUEL, MET, STAT, FLT#, X-AXIS, Y-AXIS, Z-AXIS, PITCH, YAW, RNG);
// and the manual (stat message numbers, the console's flight-deck names).

// ---- RAM ($80-$FF): [name, comment]
export const RAM = {
  0x80: ['random', 'pseudo-random byte: shifted and XORed every frame ($F016)'],
  0x81: ['thrustT', 'the T (thrust) arrow on the control panel; the button raises it. At MET 0 the launch needs it at $75 or more, else LAUNCH SCRUB'],
  0x82: ['commandC0', 'the C (computer command) arrow, first of its two objects (moves with $83)'],
  0x83: ['commandC1', 'the C arrow, second object'],
  0x84: ['computerScreen', 'what the green computer screen shows: $D9A3 picks 1 (ground track) or 2 (docking radar); seen 0 ascent, 3 reentry, 4 landing, 5 before launch'],
  0x85: ['statusPage', 'the status line page: odd values 1 SP, 3 ALT, 5 FUEL, 7 MET, 9 STAT, $0B FLT#, $0D X-AXIS, $0F Y-AXIS, $11 Z-AXIS, $13 PITCH, $15 YAW, $17 RNG, $19 NASA, $1B MISSION ABORT, $1D LAUNCH SCRUB, $1F RENDEZVOUS. A readout shows the three BCD bytes ending at $96 + page'],
  0x86: ['cloud0X', 'x of the first cloud (pad and ascent window scene)'],
  0x87: ['cloud1X', 'x of the second cloud'],
  0x88: ['pitch', 'PITCH (status page $13 shows pitch*4-$1C: the ASLs leave carry clear, so SBC #$1B takes $1C; 0 = -28, 6 = -004, 13 = +24); docking needs 0'],
  0x89: ['starRow', 'star field scroll position ($0E-$14) for the $8A-$95 table'],
  0x8A: ['starX', 'x positions of 12 stars, $8A-$95 (rotated and shifted by the RCS motion flags $AB)'],
  0x96: ['speedLo', 'SP readout, BCD, tenths of mach (low byte)'],
  0x97: ['speedHi', 'SP readout, BCD (high byte): $97:$96 = 0231 is mach 23.1'],
  0x98: ['altitudeLo', 'ALT readout, BCD, tenths of a nautical mile (low byte)'],
  0x99: ['altitudeHi', 'ALT readout, BCD (high byte): $99:$98 = 2048 is 204.8 miles'],
  0x9A: ['fuelLo', 'FUEL, BCD (low byte); burnt by BurnFuel ($FCAE), not in flights 1 and 2'],
  0x9B: ['fuelHi', 'FUEL, BCD (high byte)'],
  0x9C: ['metLo', 'MET (mission elapsed time), BCD seconds, low byte; holds at 15 during the countdown hold, counts down to 0, then up'],
  0x9D: ['metHi', 'MET, high byte; $A0 while counting down'],
  0x9E: ['statLo', 'STAT readout, low byte: before launch the switch check (4 primary, 20 backup, 40 doors: the manual\'s prelaunch messages), in flight the number of dockings (BCD)'],
  0x9F: ['statCode', 'STAT readout, high byte: the abort message (hundreds), set by Abort ($FCC7): $10 runway, $15 early, $20 late, $30 nose gear, $35 banking turn, $40 gear, $50 doors at ascent/entry, $55/$60 pitch at entry, $65 yaw at entry, $70 too low, $75 too high, $80 too slow, $85 doors in orbit, $90 orbit angle at MECO, $95 too low/slow at MECO, $99 out of fuel'],
  0xA0: ['flight', 'flight 1-3 (1 autosimulator, 2 simulator, 3 STS 101); Status steps it while the FLT# page shows'],
  0xA1: ['thrustOffCommand', '$FF while the T arrow is off the C arrow (more fuel burns, the T arrow flashes)'],
  0xA2: ['axisLo', 'signed readout for the axis pages, BCD (low byte)'],
  0xA3: ['axisHi', 'signed readout, high byte ($A0 = minus)'],
  0xA4: ['altitudeTens', 'altitude / 10, binary (follows $99)'],
  0xA5: ['altitude', 'altitude in nautical miles, binary (follows $99:$98); the satellite is at 210 ($D2): docking needs it, Z-AXIS shows 210 - altitude'],
  0xA6: ['speed', 'speed in tenths of mach, binary, up to 255 (follows $97:$96)'],
  0xAA: ['ram_AA', '? the stick\'s up/down moves it between 0 and $21 during ascent; feeds $AD'],
  0xAB: ['motionFlags', 'RCS motion of the view: bit 1 ?, 2 stars down, 4 stars right, 8 stars left (shift the star table)'],
  0xAE: ['preflightStep', 'pre-launch check step, 1-9, one every 64 frames before the countdown starts'],
  0xB0: ['xAxis0', 'X-AXIS readout = $B1 - $B0 (docking needs 0)'],
  0xB1: ['xAxis1', 'see $B0'],
  0xB2: ['yAxis', 'Y-AXIS (left/right offset from the satellite; docking needs 0)'],
  0xB3: ['yaw', 'YAW (status page $15)'],
  0xB4: ['engineMode', '? 0 engines off, 1 from lift-off, 5 from MET 3 (the launch events)'],
  0xB5: ['phase', 'mission phase: 0 pad, 1 ascent, 2 orbit, 3 deorbit/entry, 4 landing'],
  0xB6: ['inFlight', '$FF from the countdown to the end of the flight'],
  0xB9: ['ticks', '+1 every frame ($D422); its wrap advances $BA'],
  0xBA: ['missionTicks', '+1 every 256 frames during a flight'],
  0xBB: ['launchEvent', 'index into the launch event tables (MET of each event, what it does)'],
  0xC1: ['frameCount', '+1 every frame'],
  0xC5: ['metFrames', 'frames until the next MET second (59-0)'],
  0xC6: ['switches', 'SWCHB, read once a frame: bit 0 Activate Countdown (Reset), 1 Status (Select), 3 Primary Engines (Color = on), 6 Backup Engines (left A = on), 7 Cargo Doors/Landing Gear (right A = open/down)'],
  0xC7: ['statusHold', 'Status switch hold timer: a new page every $30 frames held'],
  0xC9: ['soundStep', 'step in the current sound effect ($FE: start)'],
  0xCA: ['sound', 'the sound effect playing (0: none); PlaySound ($FCE6) starts one'],
  0xCB: ['soundTimer', 'frames into the current step'],
  0xCC: ['digitPtr', 'six 2-byte graphics pointers for the 48-pixel status line ($CC-$D7)'],
  0xDE: ['ram_DE', '? positions an object at the end of the frame ($FCA2); docking needs it between $47 and $4F'],
  0xE1: ['entryGlow', '? rises with speed between $78 and $A7 on the way down; the window flickers in the reentry color while random < it'],
  0xE2: ['dockHold', 'frames held in the docking position; at $80 the docking counts'],
  0xE3: ['dockings', 'successful dockings, up to 6'],
  0xE6: ['bayHeat', 'cargo bay heat in orbit with the doors closed: alarm from $80, abort (85) at $FF; open doors reset it'],
  0xE8: ['touchdown', '$FF once the altitude reaches 0 on landing'],
  0xE9: ['range', 'RNG readout during the landing (status page $17)'],
  0xF0: ['doorsOpen', '$FF while the cargo bay doors are open'],
  0xF5: ['fuelBurn', 'fuel burnt each 16th frame by the main engines ($F054)'],
  0xF7: ['stickTouched', '$FF once the joystick moves: in flight 1 the pilot has taken over'],
  0xF8: ['simulator', '$FF in flights 1 and 2: no fuel used, most aborts overridden'],
  0xF9: ['autopilot', '$FF in flight 1 (the autosimulator) until the stick is touched'],
  0xFA: ['temp0', 'scratch'],
  0xFB: ['temp1', 'scratch'],
  0xFC: ['temp2', 'scratch'],
};

// ---- hardware registers: write names (stores and read-modify-writes) and read names
export const TIA_WRITE = ['VSYNC', 'VBLANK', 'WSYNC', 'RSYNC', 'NUSIZ0', 'NUSIZ1', 'COLUP0', 'COLUP1', 'COLUPF', 'COLUBK', 'CTRLPF', 'REFP0', 'REFP1', 'PF0', 'PF1', 'PF2',
  'RESP0', 'RESP1', 'RESM0', 'RESM1', 'RESBL', 'AUDC0', 'AUDC1', 'AUDF0', 'AUDF1', 'AUDV0', 'AUDV1', 'GRP0', 'GRP1', 'ENAM0', 'ENAM1', 'ENABL',
  'HMP0', 'HMP1', 'HMM0', 'HMM1', 'HMBL', 'VDELP0', 'VDELP1', 'VDELBL', 'RESMP0', 'RESMP1', 'HMOVE', 'HMCLR', 'CXCLR'];
export const TIA_READ = ['CXM0P', 'CXM1P', 'CXP0FB', 'CXP1FB', 'CXM0FB', 'CXM1FB', 'CXBLPF', 'CXPPMM', 'INPT0', 'INPT1', 'INPT2', 'INPT3', 'INPT4', 'INPT5'];
export const RIOT = { 0x280: 'SWCHA', 0x281: 'SWACNT', 0x282: 'SWCHB', 0x283: 'SWBCNT', 0x284: 'INTIM', 0x294: 'TIM1T', 0x295: 'TIM8T', 0x296: 'TIM64T', 0x297: 'T1024T' };

// ---- labels: address -> [name, comment]
export const LABELS = {
  // bank 1 ($F000): reset, the frame's game logic, the cockpit windows, the end of the frame
  0xF000: ['Bank1Start', 'BIT $FFF8: selects bank 0, which carries on at $F003 (its LowerKernel)'],
  0xF003: ['Reset', 'power-on: clear the TIA and RAM, then InitRAM'],
  0xF011: ['FrameLogic', 'top of every frame (after VSYNC): VBLANK timer, random number, frame counter, then the flight'],
  0xF054: ['FuelAndHeat', 'BurnFuel($F5); every 16th frame the bay heat +1 and, in flight, 1 fuel unit (+6 with engineMode set, +2 while T is off C)'],
  0xF180: ['ReadConsole', 'the console switches: Activate Countdown (Reset) and Status (Select)'],
  0xF19A: ['StartCountdown', 'Activate Countdown: the flight\'s flags (autopilot, simulator), RAM cleared, pre-launch checks begin'],
  0xF1C1: ['StatusSwitch', 'Status held: the next page every $30 frames; on the FLT# page before a flight it steps the flight number'],
  0xF20C: ['MissionClock', 'the MET clock, once a second while in flight'],
  0xF23C: ['ScrubLaunch', 'MET reached 0 without enough thrust (T < $75): LAUNCH SCRUB, the clock back to 16'],
  0xF278: ['LaunchEvents', 'the launch events at their MET (tables at $FEAB / $FE8D)'],
  0xF2F3: ['AscentStick', 'ascent and entry: every 32 frames a random drift of Y-AXIS; the stick\'s left/right moves Y, up/down moves $AA'],
  0xF3A7: ['DockingCheck', 'Y 0, pitch 0, $DE in $47-$4F, X 0 and altitude 210: count frames to a docking'],
  0xF44B: ['OrbitLimits', 'altitude 255 (abort 75); in orbit below 195 miles (70) or slowing to mach 16.9 (80)'],
  0xF470: ['OrbitControls', '? in orbit: the stick fires the thrusters (pitch, yaw, X, Y), using fuel, every $18 frames'],
  0xF5E6: ['EntryInterface', 'altitude down to 200: phase 3; yaw must be 0 (abort 65), pitch right (55 skip off / 60 burn up)'],
  0xF65B: ['LandingApproach', 'altitude down to 30: phase 4, range $40, the approach screen'],
  0xF6E1: ['Touchdown', 'altitude 0: touchdown checks: too early or late (15 / 20), landing gear (40), lined up with the runway (10)'],
  0xF743: ['Landed', 'the end of the flight: $84 = 5, 6 with a docking, 7 with six dockings and 7500+ fuel (flight 3; the manual\'s Commander)'],
  0xF7F6: ['BuildStatusLine', 'the status line: the page\'s three BCD bytes ending at $96 + page into six digit pointers, and its label'],
  0xF857: ['WaitVblank', 'wait for the VBLANK timer, then the cockpit windows'],
  0xFA01: ['RunwayWindows', 'the windows on the landing approach (phase 4)'],
  0xFC3D: ['EndOfFrame', 'back from bank 0 (via $D776 BIT $FFF9, $F779): cargo doors and bay heat'],
  0xFC89: ['VerticalSync', 'wait for the overscan timer, then VSYNC; the satellite\'s position; next frame'],
  0xFCAE: ['BurnFuel', 'A = fuel units (BCD) off $9B:$9A, not in flights 1-2; out of fuel aborts (99)'],
  0xFCC7: ['Abort', 'X = stat message: MISSION ABORT with that code in $9F (only while in flight)'],
  0xFCE6: ['PlaySound', 'X = sound effect: starts it'],
  0xFD0F: ['AddMotion', 'A = motion flag bits into $AB'],
  0xFD20: ['AltitudeUp', '+0.1 mile: $99:$98 (BCD), $A4, and $A5 every whole mile'],
  0xFD42: ['AltitudeDown', '-0.1 mile'],
  0xFDDC: ['SetDigit', 'A = glyph offset, X = digit slot: the digit pointer (leading digits blank while $E1 bit 7 and Y < 4)'],
  0xFDF5: ['PositionOffset', 'A + $B2 (wrapped to 0-159), then PositionObject'],
  0xFE00: ['PositionObject', 'A = x, X = object: coarse position by the divide-by-15 loop, then the fine motion'],
  0xFE65: ['ClearFlightRAM', 'zero $81-$F7, then InitRAM'],
  0xFE6E: ['InitRAM', 'copy the table at $FD64 to $80-$A1'],
  0xFED5: ['SpeedUp', '+0.1 mach: $A6 (saturating) and $97:$96 (BCD)'],
  0xFEEA: ['SpeedDown', '-0.1 mach'],
  // bank 0 ($D000): the lower half of the screen, the second half of the logic
  0xD003: ['LowerKernel', 'entered from bank 1\'s JMP $F000: the instrument strip (C and T arrows), the status line and the computer screen'],
  0xD04B: ['CommandBar', 'the C (computer) arrow\'s bar, 8 lines (the arrow\'s objects placed from $82/$83 just before)'],
  0xD0BF: ['TickScale', 'the scale between the bars: tick marks by repeated RESP0/RESP1'],
  0xD138: ['ThrustBar', 'the T (thrust) arrow\'s bar (placed from $81 at $D121)'],
  0xD1EF: ['StatusLine', 'the status line: label and six digits through Draw48'],
  0xD217: ['ComputerScreen', 'the green computer screen (tracking, ground track, docking radar, approach)'],
  0xD3B4: ['OverscanLogic', 'after the picture (VBLANK on at $D394): the overscan timer, then the thrust check, idle timers, sound, the star field and the satellite\'s motion'],
  0xD776: ['ToBank1', 'BIT $FFF9: back to bank 1, which carries on at $F779 (JMP EndOfFrame)'],
  0xD958: ['PositionObject0', 'bank 0\'s PositionObject (A = x, X = object)'],
  0xD979: ['Draw48', 'the 48-pixel text kernel: six graphics pointers $CC-$D7, $FA lines'],
  0xD9A3: ['DockingView', 'docking-closeness test: pitch 0, yaw and X within limits: computer screen 2 (docking radar), else 1'],
  0xD9DA: ['FrameParity', 'carry set on even frames (these instruction bytes are also read as a table)'],
  0xDDFB: ['HighNibble', 'A = A >> 4'],
};

// ---- comments on single instructions: address -> text
export const COMMENTS = {
  0xF016: 'random: shift, XOR, rotate',
  0xF043: 'prelaunch switch check: (switches >> 1) & $64 = 4 primary, 20 backup, 40 doors (the manual\'s message numbers)',
  0xF22E: 'MET 0: enough thrust for lift-off?',
  0xF3C5: 'every axis lined up: count frames toward a docking',
  0xF3D1: 'docked: sound, the satellite sails off, another docking counted, fuel bonus',
  0xFC64: 'right difficulty: cargo doors (orbit) / landing gear',
  0xD405: 'T arrow on the C arrow?',
  0xD41B: 'the joystick moved',
  0xD394: 'the picture ends: VBLANK on',
};

// ---- section headers: address -> lines
export const SECTIONS = {
  0xD000: ['Bank 0, assembled at $D000. Bank switching is F8: an access to $1FF8 selects bank 0, $1FF9 bank 1,',
    'and the cartridge ignores address bit 13, so each bank\'s code also runs at the other origin.',
    'Frame: bank 1 FrameLogic (VBLANK) and the cockpit windows (lines 39-142); JMP $F000 = BIT $FFF8 into',
    'bank 0 at $F003: LowerKernel (lines 143-237) and OverscanLogic; $D776 BIT $FFF9 back to bank 1 at $F779:',
    'JMP EndOfFrame, VerticalSync, JMP FrameLogic.'],
  0xD3B4: ['Overscan logic, first half (bank 0)'],
  0xF000: ['Bank 1, assembled at $F000'],
  0xF011: ['The frame\'s game logic (during VBLANK)'],
  0xF857: ['The cockpit windows'],
  0xFC3D: ['End of the frame (overscan, second half)'],
  0xFCAE: ['Subroutines'],
};

// ---- data: address -> [name, comment] (tables the code reads)
export const DATA = {
  0xFD64: ['InitTable', 'copied to $80-$A1 at power on (InitRAM)'],
  0xFEAB: ['LaunchEventMet', 'the MET (BCD) of each launch event'],
  0xFE8D: ['LaunchEventAction', 'what each launch event does (low nibble -> $BC)'],
  0xFDEE: ['DockingFuelBonus', 'fuel (BCD hundreds) added per docking, by docking number'],
  0xFEC5: ['SkyColor', 'window background color: by altitude, or by the pre-launch step on the pad'],
  0xFE16: ['StatusLabelLo', 'the status line label\'s graphics, by page / 2'],
};
