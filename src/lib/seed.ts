import { repo } from '../data/repo';
import { db } from '../db';
import type { Answer, Capture, Origin, PillarId } from '../types';
import { newId } from './id';
import { makeVariants } from './image';
import { DAY, initialResurfaceAt, nextAfterAnswer } from './scheduler';
import { computeStrength } from './strength';

/* ---------- procedural "photos" (so sample data needs no assets and works offline) ---------- */

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void;

const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const wood: Painter = (ctx, w, h, rnd) => {
  const planks = 7, ph = h / planks;
  for (let i = 0; i < planks; i++) {
    const l = 30 + rnd() * 10;
    ctx.fillStyle = `hsl(${24 + rnd() * 8} ${45 + rnd() * 10}% ${l}%)`;
    ctx.fillRect(0, i * ph, w, ph);
    for (let g = 0; g < 26; g++) {
      ctx.strokeStyle = `hsla(22 40% ${15 + rnd() * 15}% / ${0.15 + rnd() * 0.2})`;
      ctx.lineWidth = 1 + rnd() * 1.5;
      const y = i * ph + rnd() * ph;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 14, w * 0.6, y + (rnd() - 0.5) * 14, w, y + (rnd() - 0.5) * 8);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30,15,5,.55)'; ctx.fillRect(0, i * ph, w, 3);
  }
};

const tile: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, w, h);
  const n = 8, s = w / n;
  for (let y = 0; y < Math.ceil(h / s); y++) for (let x = 0; x < n; x++) {
    const g = ctx.createLinearGradient(x * s, y * s, (x + 1) * s, (y + 1) * s);
    const hue = 165 + rnd() * 18, l = 28 + rnd() * 10;
    g.addColorStop(0, `hsl(${hue} 50% ${l + 8}%)`); g.addColorStop(1, `hsl(${hue} 55% ${l}%)`);
    ctx.fillStyle = g; ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x * s + 5, y * s + 5, s * 0.35, 4);
  }
};

const bowl: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = '#e9d9bd'; ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.42;
  ctx.fillStyle = '#4a2c1c'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#d9541e'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  ctx.fillStyle = '#f3e7c9'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, -Math.PI * 0.5, Math.PI * 0.5); ctx.fill();
  for (let i = 0; i < 60; i++) {
    const a = rnd() * 7, d = rnd() * r * 0.8;
    ctx.fillStyle = rnd() > 0.5 ? '#b83a10' : '#fff8e6';
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 5, 3);
  }
  ctx.strokeStyle = '#2f6b2f'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy - r * 0.3); ctx.quadraticCurveTo(cx, cy - r * 0.7, cx + r * 0.5, cy - r * 0.2); ctx.stroke();
  ctx.strokeStyle = '#3b1a0e'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(cx - r * 0.4, cy + r * 0.3); ctx.quadraticCurveTo(cx, cy + r * 0.55, cx + r * 0.5, cy + r * 0.25); ctx.stroke();
};

const chicken: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = '#2b2118'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f2ead8'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.4, h * 0.38, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 5; i++) {
    const x = w * (0.28 + rnd() * 0.44), y = h * (0.3 + rnd() * 0.4);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * 3);
    ctx.fillStyle = `hsl(${28 + rnd() * 8} 75% ${40 + rnd() * 8}%)`;
    ctx.beginPath(); ctx.ellipse(0, 0, 70, 38, 0, 0, 7); ctx.fill();
    for (let k = 0; k < 40; k++) { ctx.fillStyle = rnd() > 0.5 ? '#7a2b0c' : '#e8a13a'; ctx.fillRect((rnd() - 0.5) * 120, (rnd() - 0.5) * 60, 3, 3); }
    ctx.restore();
  }
  ctx.strokeStyle = '#a21f4f'; ctx.lineWidth = 5;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(w * (0.3 + rnd() * 0.4), h * (0.3 + rnd() * 0.4), 18, 0, Math.PI); ctx.stroke(); }
};

const lights: Painter = (ctx, w, h, rnd) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1b120c'); g.addColorStop(1, '#3a2415');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    const x = w * (0.15 + i * 0.23), y = h * (0.25 + rnd() * 0.15);
    const rg = ctx.createRadialGradient(x, y, 4, x, y, h * 0.5);
    rg.addColorStop(0, 'rgba(255,200,110,.95)'); rg.addColorStop(0.25, 'rgba(255,160,60,.45)'); rg.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#120b06'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 14); ctx.stroke();
    ctx.fillStyle = '#ffe2a8'; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill();
  }
};

const board: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = '#26302d'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#8c6a43'; ctx.lineWidth = 14; ctx.strokeRect(7, 7, w - 14, h - 14);
  ctx.fillStyle = '#f0ead8'; ctx.textAlign = 'center';
  ctx.font = `bold ${h * 0.12}px Georgia, serif`; ctx.fillText('THE BOWL', w / 2, h * 0.22);
  ctx.font = `${h * 0.065}px Georgia, serif`;
  ['Jollof + Carolina rice', 'Suya fried chicken', 'Plantain, shito mayo', 'Hibiscus tea'].forEach((t, i) => {
    ctx.fillText(t, w / 2, h * (0.42 + i * 0.14));
    ctx.fillStyle = 'rgba(240,234,216,.4)'; ctx.fillRect(w * 0.2, h * (0.45 + i * 0.14) + rnd() * 2, w * 0.6, 1.5); ctx.fillStyle = '#f0ead8';
  });
};

const PAINTERS = { wood, tile, bowl, chicken, lights, board };
type PhotoKey = keyof typeof PAINTERS;

async function paint(key: PhotoKey) {
  const c = document.createElement('canvas');
  c.width = 900; c.height = key === 'wood' || key === 'lights' ? 600 : 900;
  PAINTERS[key](c.getContext('2d')!, c.width, c.height, rng(key.length * 7919));
  return makeVariants(c, c.width, c.height);
}

/* ---------- sample captures (West African x Southern counter-service concept) ---------- */

interface Seed {
  d: number; // days ago
  t: string; pillar: PillarId | null; origin?: Origin; tags?: string[];
  photo?: PhotoKey; sug?: PillarId;
  hist?: [number, Answer][]; // [daysAgo, answer]
}

const SEEDS: Seed[] = [
  { d: 30, t: 'Jollof-and-Lowcountry-rice bowl: smoky party jollof, Carolina Gold rice with benne seed, pickled okra on top.', pillar: 'food', hist: [[28, 'fire'], [20, 'fire']] },
  { d: 26, t: 'Suya-spiced fried chicken: yaji rub in the flour, buttermilk brine, finish with sliced red onion like the street stand.', pillar: 'food', hist: [[19, 'fire'], [11, 'fire']] },
  { d: 12, t: 'Shito mayo as the house sauce. Works on chicken, fries, everything.', pillar: 'food', hist: [[5, 'fire']] },
  { d: 15, t: 'Fried plantain holds 10 min max under the lamp. Fry to order for pop-ups, tiny batches.', pillar: 'food', origin: 'lesson', hist: [[8, 'meh']] },
  { d: 9, t: 'Saw a Charleston red rice and egusi collards plate. Greens could go egusi-style with ground melon seed.', pillar: 'food', origin: 'inspiration' },
  { d: 4, t: 'Bowl layout: rice, chicken, slaw, sauce stripe', pillar: 'food', photo: 'bowl', tags: ['plating'] },
  { d: 2, t: 'Suya chicken crust, this deep colour', pillar: 'food', photo: 'chicken', tags: ['dish'], origin: 'inspiration' },
  { d: 20, t: 'Warm wood counter, deep brown', pillar: 'space', photo: 'wood', hist: [[13, 'fire']] },
  { d: 16, t: 'Green zellige-style tile backsplash', pillar: 'space', photo: 'tile', hist: [[9, 'fire']] },
  { d: 7, t: 'Amber pendant glow, evening', pillar: 'space', photo: 'lights' },
  { d: 3, t: 'Chalk menu board idea', pillar: 'space', photo: 'board', origin: 'inspiration' },
  { d: 14, t: 'Counter seating only: 8 stools facing the pass so guests watch the fry station.', pillar: 'space', hist: [[7, 'fire']] },
  { d: 6, t: 'Counter seating: low-back stools, no more than 14 inches from the counter edge.', pillar: 'space' },
  { d: 5, t: 'Counter seating at that Lisbon tasca. Guests chat with the cook. Do that.', pillar: 'space', origin: 'inspiration' },
  { d: 3, t: 'Counter seating height: ask the pop-up host if 36 inch stools are available.', pillar: 'space' },
  { d: 1, t: 'Counter seating needs a hook under the counter for bags.', pillar: 'space', tags: ['seating'] },
  { d: 18, t: 'Counter service: order at the register, number on the ticket, food out in under 6 minutes.', pillar: 'service', hist: [[11, 'fire'], [4, 'fire']] },
  { d: 10, t: 'At work the line dies when the ticket printer jams. Keep a paper backup for the pop-up.', pillar: 'service', origin: 'lesson' },
  { d: 22, t: 'Lunch crowd from nearby offices plus 4pm school-out kids. Need a $9 kids jollof cup.', pillar: 'guest', hist: [[15, 'fire']] },
  { d: 6, t: 'Regulars want to be remembered. Learn names by week two.', pillar: 'guest', origin: 'lesson' },
  { d: 17, t: 'Name idea: Benne & Bay. Benne seed meets Lowcountry.', pillar: 'brand', hist: [[10, 'fire']] },
  { d: 8, t: 'Hand-painted wax print patterns on packaging, bright against kraft paper.', pillar: 'brand', origin: 'inspiration' },
  { d: 19, t: 'My best sous stayed because we ate family meal together. Paid family meal every shift.', pillar: 'team', origin: 'lesson', hist: [[12, 'fire'], [3, 'fire']] },
  { d: 21, t: 'Target ticket average $16, food cost under 30%.', pillar: 'numbers', hist: [[14, 'meh']] },
  { d: 11, t: 'Labor eats everything. Pop-up with 3 people max until the numbers prove it.', pillar: 'numbers', origin: 'lesson' },
  { d: 12, t: 'Suya nachos fusion thing. Gimmicky.', pillar: 'food', hist: [[5, 'no']] },
  // unsorted: waiting for a confirm
  { d: 0, t: 'Puff-puff as the dessert, honey drizzle', pillar: null, sug: 'food' },
  { d: 0, t: 'Soundtrack: Fela, Al Green, Sade for Friday lunch', pillar: null, sug: 'space' },
  { d: 0, t: 'Tile samples from the shop on Atlantic', pillar: null, photo: 'tile', sug: 'space', origin: 'inspiration' },
];

export async function hasSampleData(): Promise<boolean> {
  return (await db.captures.filter((c) => !!c.sample).count()) > 0;
}

export async function loadSampleData(now = Date.now()): Promise<number> {
  if (await hasSampleData()) return 0;
  const photos = new Map<PhotoKey, { blob: Blob; thumb: Blob }>();
  for (const key of new Set(SEEDS.flatMap((s) => (s.photo ? [s.photo] : [])))) photos.set(key, await paint(key));

  const caps: Capture[] = SEEDS.map((s) => {
    const createdAt = now - s.d * DAY - Math.floor(Math.random() * 3_600_000);
    const resonanceHistory = (s.hist ?? []).map(([ago, answer]) => ({ at: now - ago * DAY, answer, source: 'prompt' as const }));
    const last = resonanceHistory[resonanceHistory.length - 1];
    const img = s.photo ? photos.get(s.photo) : undefined;
    return {
      id: newId(),
      type: img ? 'photo' : 'text',
      text: s.t,
      blob: img?.blob, thumb: img?.thumb, mime: img ? 'image/jpeg' : undefined,
      tags: s.tags ?? [],
      createdAt,
      origin: s.origin ?? 'vision',
      pillar: s.pillar,
      suggestedPillar: s.pillar ?? s.sug ?? null,
      strength: computeStrength(resonanceHistory),
      status: last?.answer === 'no' ? 'archived' : 'active',
      nextResurfaceAt: last ? nextAfterAnswer(resonanceHistory, last.answer, last.at) : initialResurfaceAt(createdAt),
      resonanceHistory,
      sample: true,
    } satisfies Capture;
  });
  await repo.addCaptures(caps);
  await repo.logEvent('sample_loaded', { count: caps.length });
  return caps.length;
}

export async function clearSampleData(): Promise<number> {
  const ids = (await db.captures.filter((c) => !!c.sample).primaryKeys()) as string[];
  await repo.deleteCaptures(ids);
  await repo.logEvent('sample_cleared', { count: ids.length });
  return ids.length;
}
