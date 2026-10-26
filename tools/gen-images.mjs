// Renders the site's pictures from the translated cartridge (src/shuttleMachine.mjs):
// img/start.png (the title screen, the poster), img/<phase>.png from the
// Flight 1 autosimulator mission, and the icons (the NASA mission panel).
// usage: node tools/gen-images.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { ShuttleMachine } from '../src/shuttleMachine.mjs';
import { NTSC_PALETTE_RGB } from '../src/palette.mjs';
import { FIRST_LINE, VISIBLE_LINES } from '../src/shuttlePlayer.mjs';

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8); out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length); return out; };
function png(path, w, h, rgbAt) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const c = rgbAt(x, y), o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c >> 16; raw[o + 1] = (c >> 8) & 255; raw[o + 2] = c & 255; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const color = (frame, x, y) => NTSC_PALETTE_RGB[(frame[FIRST_LINE + y][x] >> 1) & 0x7f];
// the visible picture, 4 x 2 per TIA pixel: 640 x 392
const screenshot = (path, frame) => png(path, 640, VISIBLE_LINES * 2, (x, y) => color(frame, x >> 2, y >> 1));

mkdirSync('img', { recursive: true });
const m = new ShuttleMachine();
const sw = (o = {}) => (o.reset ? 0 : 1) | (o.select ? 0 : 2) | (o.color ? 8 : 0);
const run = (n, o) => { for (let i = 0; i < n; i += 1) { m.bus.swchb = sw(o); m.runFrame(); } };
run(300);
screenshot('img/start.png', m.bus.tia.lastFrame);
// the NASA mission panel for the icons: a square around it, on the panel's own colors
const frame0 = m.bus.tia.lastFrame.map((r) => r.slice());
// Flight 1: Status held (FLT# 3 -> 1), Activate Countdown, then hands off
run(150, { select: 1 }); run(30); run(10, { reset: 1 });
const shots = { launch: 1700, orbit: 7250, reentry: 14750, landing: 19900 };
let f = 0;
for (const [name, at] of Object.entries(shots).sort((a, b) => a[1] - b[1])) { run(at - f); f = at; screenshot(`img/${name}.png`, m.bus.tia.lastFrame); }
// icons: the panel's middle (the shuttle emblem), scaled whole-pixel
const [px0, py0, pw, ph] = [72, 155, 16, 30]; // TIA pixels x, visible lines y: the emblem (a TIA pixel is about two lines wide)
for (const [size, file] of [[180, 'icon-180'], [192, 'icon-192'], [512, 'icon-512']]) {
  png(`img/${file}.png`, size, size, (x, y) => color(frame0, px0 + Math.floor((x * pw) / size), py0 + Math.floor((y * ph) / size)));
}
console.log('images written');
