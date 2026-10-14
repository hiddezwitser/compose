// Vaste lijsten en gedeelde logica rond kast, outfits en moodboard.

import { db, getSetting, setSetting } from './db.js';
import { images } from './images.js';

export const CATEGORIES = [
  { id: 'overhemden', name: 'Overhemden' },
  { id: 'shirts', name: 'Polo’s & T-shirts' },
  { id: 'knitwear', name: 'Truien & quarter-zips' }, // id blijft 'knitwear' voor bestaande gegevens
  { id: 'vesten', name: 'Vesten & overshirts' },
  { id: 'broeken', name: 'Broeken' },
  { id: 'jassen', name: 'Blazers & jassen' },
  { id: 'schoenen', name: 'Schoenen' },
  { id: 'accessoires', name: 'Accessoires' },
];

export const STATUS = {
  have: { label: 'Heb ik', cls: 'have' },
  want: { label: 'Wil ik', cls: 'want' },
  consider: { label: 'Overweeg', cls: 'consider' },
};

export const COLORS = [
  { key: 'navy', name: 'Navy', hex: '#24324D' },
  { key: 'oxford', name: 'Oxford', hex: '#BCCBDB' },
  { key: 'wit', name: 'Wit', hex: '#F3F1EC' },
  { key: 'ecru', name: 'Ecru', hex: '#E6DCCB' },
  { key: 'kameel', name: 'Kameel', hex: '#B08A60' },
  { key: 'tabak', name: 'Tabak', hex: '#5A3E2B' },
  { key: 'flanel', name: 'Flanel', hex: '#8D8C88' },
  { key: 'antraciet', name: 'Antraciet', hex: '#3E4249' },
  { key: 'olijf', name: 'Olijf', hex: '#5E5F47' },
  { key: 'groen', name: 'Groen', hex: '#2E4A3B' },
  { key: 'bordeaux', name: 'Bordeaux', hex: '#5E2B33' },
  { key: 'zwart', name: 'Zwart', hex: '#1E1E1E' },
];

export const OCCASIONS = [
  { id: 'kantoor', name: 'Kantoor' },
  { id: 'diner', name: 'Diner' },
  { id: 'weekend', name: 'Weekend' },
  { id: 'overig', name: 'Overig' },
];

// Wishlist: kleding komt uit de kast (status wil ik / overweeg), de rest staat in 'wishes'.
export const WISH_CATEGORIES = [
  { id: 'camera', name: 'Camera' },
  { id: 'muziek', name: 'Muziek' },
  { id: 'gadgets', name: 'Gadgets' },
  { id: 'overig', name: 'Overig' },
];

export const PRIORITIES = [
  { id: 'must', name: 'Must' },
  { id: 'nice', name: 'Nice' },
  { id: 'ooit', name: 'Ooit' },
];
const PRIORITY_RANK = { must: 0, nice: 1, ooit: 2 };

export const catName =(id) => CATEGORIES.find((c) => c.id === id)?.name || 'Overig';
export const colorOf = (key) => COLORS.find((c) => c.key === key) || null;
export const occasionName = (id) => OCCASIONS.find((o) => o.id === id)?.name || '';

export function euro(n) {
  const opts = n % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {};
  return '€ ' + n.toLocaleString('nl-NL', opts);
}

// "1.299,95", "49,95", "49.95" en "1.299" → getal; leeg → null; ongeldig → NaN.
export function parsePrice(input) {
  let s = String(input || '').trim().replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

export const plural =(n, one, many) => `${n} ${n === 1 ? one : many}`;

// Alles wat de kast- en atelierschermen nodig hebben in één keer.
export async function loadWardrobe() {
  const [pieces, outfits, board] = await Promise.all([db.all('pieces'), db.all('outfits'), db.all('board')]);
  pieces.sort((a, b) => b.createdAt - a.createdAt);
  outfits.sort((a, b) => b.updatedAt - a.updatedAt);
  board.sort((a, b) => b.createdAt - a.createdAt);
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const outfitById = new Map(outfits.map((o) => [o.id, o]));
  const usage = new Map();
  for (const o of outfits) for (const it of o.items) usage.set(it.pieceId, (usage.get(it.pieceId) || 0) + 1);
  await images.preload([...pieces.map((p) => p.imageId), ...board.map((b) => b.imageId)]);
  return { pieces, outfits, board, byId, outfitById, usage };
}

export function outfitMissing(outfit, byId) {
  const missing = outfit.items.map((it) => byId.get(it.pieceId)).filter((p) => p && p.status !== 'have');
  const cost = missing.reduce((sum, p) => sum + (p.price || 0), 0);
  return { missing, cost };
}

// Welke aankoop levert het meest op? Eerst: een stuk dat outfits compleet maakt.
export function gapInsight({ pieces, outfits, byId }) {
  const completes = new Map();
  const appears = new Map();
  for (const o of outfits) {
    const { missing } = outfitMissing(o, byId);
    for (const p of missing) appears.set(p.id, (appears.get(p.id) || 0) + 1);
    if (missing.length === 1) completes.set(missing[0].id, (completes.get(missing[0].id) || 0) + 1);
  }
  const top = (map) => [...map].sort((a, b) => b[1] - a[1])[0];
  const c = top(completes);
  if (c) return { kind: 'completes', piece: byId.get(c[0]), n: c[1] };
  const a = top(appears);
  if (a) return { kind: 'appears', piece: byId.get(a[0]), n: a[1] };
  if (pieces.length >= 3) {
    const owned = new Set(pieces.filter((p) => p.status === 'have').map((p) => p.category));
    const core = ['overhemden', 'broeken', 'jassen', 'schoenen', 'knitwear']; // basis van business casual
    const gap = CATEGORIES.find((cat) => core.includes(cat.id) && !owned.has(cat.id));
    if (gap) return { kind: 'category', category: gap };
  }
  return null;
}

export async function deletePiece(id) {
  const piece = await db.get('pieces', id);
  if (piece?.imageId) await images.remove(piece.imageId);
  await db.del('pieces', id);
  for (const o of await db.all('outfits')) {
    if (o.items.some((it) => it.pieceId === id)) {
      o.items = o.items.filter((it) => it.pieceId !== id);
      await db.put('outfits', o);
    }
  }
  for (const b of await db.all('board')) if (b.refId === id) await db.del('board', b.id);
}

export async function deleteOutfit(id) {
  await db.del('outfits', id);
  for (const b of await db.all('board')) if (b.refId === id) await db.del('board', b.id);
}

export async function deleteBoardItem(item) {
  if (item.imageId) await images.remove(item.imageId);
  await db.del('board', item.id);
}

// ---------- Wishlist ----------

export const wishCatName = (id) => WISH_CATEGORIES.find((c) => c.id === id)?.name || 'Overig';

export function hostOf(link) {
  try { return new URL(link).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

// Eén lijst met alle wensen (kleding uit de kast + overige), plus wat er gekocht is.
export async function loadWishlist() {
  const [w, wishes] = await Promise.all([loadWardrobe(), db.all('wishes')]);
  await images.preload(wishes.map((x) => x.imageId));
  const fromPiece = (p) => ({
    kind: 'piece', id: p.id, name: p.name, cat: 'kleding', catLabel: catName(p.category),
    price: p.price, priority: p.priority || 'nice', imageId: p.imageId, color: p.color,
    href: `#/kast/${p.id}`, link: p.link, createdAt: p.createdAt, source: p,
    inAtelier: w.usage.has(p.id) || w.board.some((b) => b.refId === p.id),
    boughtAt: p.boughtAt, boughtPrice: p.boughtPrice,
  });
  const fromWish = (x) => ({
    kind: 'wish', id: x.id, name: x.name, cat: x.category, catLabel: wishCatName(x.category),
    price: x.price, priority: x.priority || 'nice', imageId: x.imageId, color: null,
    href: `#/wishlist/${x.id}`, link: x.link, createdAt: x.createdAt, source: x,
    inAtelier: false, boughtAt: x.boughtAt, boughtPrice: x.boughtPrice,
  });

  const open = [
    ...w.pieces.filter((p) => p.status !== 'have').map(fromPiece),
    ...wishes.filter((x) => x.status !== 'bought').map(fromWish),
  ].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt - a.createdAt);

  const bought = [
    ...w.pieces.filter((p) => p.status === 'have' && p.boughtAt).map(fromPiece),
    ...wishes.filter((x) => x.status === 'bought').map(fromWish),
  ].sort((a, b) => (b.boughtAt || '').localeCompare(a.boughtAt || ''));

  return { open, bought, wardrobe: w };
}

export const sumPrices = (list) => list.reduce((s, x) => s + (x.price || 0), 0);

// Iets als gekocht markeren: een kledingstuk gaat naar "heb ik", een overige wens naar "gekocht".
export async function markBought(entry, price, date) {
  const store = entry.kind === 'piece' ? 'pieces' : 'wishes';
  const rec = await db.get(store, entry.id);
  if (!rec) return;
  if (entry.kind === 'piece') rec.status = 'have';
  else rec.status = 'bought';
  rec.boughtAt = date;
  rec.boughtPrice = price;
  rec.updatedAt = Date.now();
  await db.put(store, rec);
}

export async function unmarkBought(entry) {
  const store = entry.kind === 'piece' ? 'pieces' : 'wishes';
  const rec = await db.get(store, entry.id);
  if (!rec) return;
  rec.status = entry.kind === 'piece' ? 'want' : 'wanted';
  delete rec.boughtAt;
  delete rec.boughtPrice;
  rec.updatedAt = Date.now();
  await db.put(store, rec);
}

export async function deleteWish(id) {
  const rec = await db.get('wishes', id);
  if (rec?.imageId) await images.remove(rec.imageId);
  await db.del('wishes', id);
}

export const DEFAULT_PROFILE = {
  words: ['Ivy', 'Napolitaanse snit', 'Quiet luxury', 'Clean'],
  palette: ['navy', 'oxford', 'ecru', 'kameel', 'flanel', 'tabak'],
};

export const getProfile = () => getSetting('styleProfile', DEFAULT_PROFILE);
export const saveProfile = (profile) => setSetting('styleProfile', profile);
