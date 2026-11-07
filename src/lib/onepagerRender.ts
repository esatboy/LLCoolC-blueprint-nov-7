import { APP_NAME } from '../config';
import type { OnePagerContent } from './onepager';
import { slug } from './onepager';

/** US Letter at 150dpi. One canvas renderer feeds the preview, the PNG and the PDF so they always match. */
export const PAGE_W = 1275;
export const PAGE_H = 1650;

const C = { paper: '#faf5ec', ink: '#2a1f17', muted: '#6b5b4d', line: '#dccbb0', accent: '#b4472a', wash: '#f1e6d2' };
const SERIF = "Fraunces, Georgia, 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const test = cur ? `${cur} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxW || !cur) { cur = test; continue; }
    lines.push(cur);
    cur = words[i];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1).trimEnd();
      lines[maxLines - 1] = last + '…';
    }
  }
  return lines;
}

function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / img.width, h / img.height);
  const sw = w / k, sh = h / k;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.clip();
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
}

export interface RenderInput {
  name: string;
  oneLiner: string;
  content: OnePagerContent;
  date?: Date;
}

export async function renderOnePager(canvas: HTMLCanvasElement, input: RenderInput): Promise<void> {
  try {
    await Promise.all([document.fonts.load(`700 80px Fraunces`), document.fonts.load(`500 30px Fraunces`)]);
  } catch { /* fall back to Georgia */ }

  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d')!;
  const M = 80, W = PAGE_W - M * 2;
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textBaseline = 'alphabetic';

  // Header
  let y = M + 10;
  ctx.fillStyle = C.accent; ctx.font = `700 22px ${SANS}`;
  ctx.fillText('CONCEPT ONE-PAGER', M, y);
  y += 30;
  ctx.fillStyle = C.ink; ctx.font = `700 78px ${SERIF}`;
  const name = input.name.trim() || 'Untitled concept';
  const nameLines = wrap(ctx, name, W, 2);
  for (const l of nameLines) { y += 78; ctx.fillText(l, M, y); }
  y += 20;
  if (input.oneLiner.trim()) {
    ctx.fillStyle = C.muted; ctx.font = `italic 500 34px ${SERIF}`;
    for (const l of wrap(ctx, input.oneLiner.trim(), W, 3)) { y += 44; ctx.fillText(l, M, y); }
  }
  y += 28;
  ctx.fillStyle = C.line; ctx.fillRect(M, y, W, 3);
  y += 28;

  // Hero photos
  const heroes = input.content.heroes;
  if (heroes.length) {
    const bmps = await Promise.all(heroes.map((h) => createImageBitmap(h.blob!)));
    const cols = heroes.length <= 4 ? heroes.length : 3;
    const rows = Math.ceil(heroes.length / cols);
    const gap = 14, rowH = rows === 1 ? 300 : 205;
    const cw = (W - gap * (cols - 1)) / cols;
    bmps.forEach((b, i) => {
      cover(ctx, b, M + (i % cols) * (cw + gap), y + Math.floor(i / cols) * (rowH + gap), cw, rowH);
      b.close();
    });
    y += rows * rowH + (rows - 1) * gap + 34;
  } else {
    ctx.fillStyle = C.wash; ctx.beginPath(); ctx.roundRect(M, y, W, 130, 14); ctx.fill();
    ctx.fillStyle = C.muted; ctx.font = `italic 500 28px ${SERIF}`;
    ctx.fillText('Add a few photos of the space, the food and the feel to fill this row.', M + 28, y + 76);
    y += 164;
  }

  // Pillar grid: 2 columns x 4 rows (the 8th cell summarizes what is left)
  const footerY = PAGE_H - M + 6;
  const gridBottom = footerY - 44;
  const gapX = 44, colW = (W - gapX) / 2;
  const rowH = (gridBottom - y) / 4;
  const cells = [...input.content.sections, null];
  cells.forEach((s, i) => {
    const x = M + (i % 2) * (colW + gapX);
    const cy = y + Math.floor(i / 2) * rowH;
    ctx.fillStyle = s?.thin !== false ? C.wash : 'transparent';
    if (s && s.thin) { ctx.setLineDash([8, 7]); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, cy, colW, rowH - 18, 12); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = C.accent; ctx.fillRect(x + (s?.thin ? 18 : 0), cy + 8, 8, 28);
    const tx = x + (s?.thin ? 18 : 0) + 20, tw = colW - (s?.thin ? 36 : 0) - 20;
    ctx.fillStyle = C.ink; ctx.font = `700 31px ${SERIF}`;
    ctx.fillText(s ? s.pillar.name : 'Still to decide', tx, cy + 36);
    ctx.font = `400 23px ${SANS}`;
    let ty = cy + 74;
    if (!s) {
      const miss = input.content.missing;
      ctx.fillStyle = C.muted;
      const msg = miss.length === 0 ? 'Every pillar has a strong idea behind it.' : `${miss.map((m) => m.name).join(', ')}.`;
      for (const l of wrap(ctx, msg, tw, 3)) { ctx.fillText(l, tx, ty); ty += 30; }
    } else if (s.thin) {
      ctx.fillStyle = C.muted; ctx.font = `italic 500 24px ${SERIF}`;
      for (const l of wrap(ctx, `Still to find: ${s.pillar.prompt}`, tw, 3)) { ctx.fillText(l, tx, ty); ty += 31; }
    } else {
      ctx.fillStyle = C.ink;
      for (const idea of s.ideas) {
        const lines = wrap(ctx, idea, tw - 22, 2);
        ctx.fillStyle = C.accent; ctx.fillText('•', tx, ty);
        ctx.fillStyle = C.ink;
        for (const l of lines) { ctx.fillText(l, tx + 22, ty); ty += 30; }
        ty += 6;
      }
    }
  });

  // Footer
  ctx.fillStyle = C.muted; ctx.font = `400 20px ${SANS}`;
  const date = (input.date ?? new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  ctx.fillText(`Made with ${APP_NAME} · ${date}`, M, footerY);
  ctx.textAlign = 'right';
  ctx.fillText('A working concept, not a final plan.', PAGE_W - M, footerY);
  ctx.textAlign = 'left';
}

export const canvasToPng = (c: HTMLCanvasElement): Promise<Blob> =>
  new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG export failed'))), 'image/png'));

export async function canvasToPdf(c: HTMLCanvasElement): Promise<Blob> {
  const { jsPDF } = await import('jspdf'); // loaded on demand, precached by the service worker
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 612, 792);
  return pdf.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Native share sheet when available (phones), otherwise a normal download. Nothing leaves the device until she picks a target. */
export async function shareOrDownload(blob: Blob, name: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], `${slug(name)}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'shared';
    }
  }
  downloadBlob(blob, file.name);
  return 'downloaded';
}
