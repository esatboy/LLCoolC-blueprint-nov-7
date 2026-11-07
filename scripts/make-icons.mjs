// Generates PNG app icons with no dependencies (plate ring + 7 dots for the 7 pillars).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const BG = [0xb4, 0x47, 0x2a], FG = [0xfa, 0xf5, 0xec];

function render(N, scale = 1) {
  const SS = 3, raw = Buffer.alloc((N * 3 + 1) * N);
  const cx = N / 2, R = 0.27 * N * scale, T = 0.045 * N * scale, dr = 0.028 * N * scale, orbit = 0.37 * N * scale;
  const dots = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * orbit, cx + Math.sin(a) * orbit];
  });
  for (let y = 0; y < N; y++) {
    raw[y * (N * 3 + 1)] = 0;
    for (let x = 0; x < N; x++) {
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
        const d = Math.hypot(px - cx, py - cx);
        let on = Math.abs(d - R) <= T / 2 || d <= 0.09 * N * scale;
        if (!on) on = dots.some(([dx, dy]) => Math.hypot(px - dx, py - dy) <= dr);
        if (on) cov++;
      }
      const a = cov / (SS * SS), o = y * (N * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', render(192));
writeFileSync('public/icon-512.png', render(512));
writeFileSync('public/icon-maskable-512.png', render(512, 0.8)); // content inside the maskable safe zone
writeFileSync('public/apple-touch-icon.png', render(180));
console.log('icons written');
