// Foto's: verkleinen, uitgeknipte foto's (met transparante achtergrond) herkennen
// en bijsnijden, opslaan als Blob, en tonen via object-URL's.

import { db, uid } from './db.js';

const MAX_SIDE = 1200;
const cache = new Map(); // id -> { url, cutout }

async function process(blob) {
  const src = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();

    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    let w = Math.max(1, Math.round(img.naturalWidth * scale));
    let h = Math.max(1, Math.round(img.naturalHeight * scale));
    let canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);

    // Uitgeknipt (bijv. via "Kopieer onderwerp" in Foto's)? Dan transparante randen wegsnijden.
    let cutout = false;
    if (blob.type !== 'image/jpeg') {
      const { data } = canvas.getContext('2d').getImageData(0, 0, w, h);
      let minX = w, minY = h, maxX = -1, maxY = -1, clear = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          } else {
            clear++;
          }
        }
      }
      if (maxX >= 0 && clear > w * h * 0.02) {
        cutout = true;
        const cw = maxX - minX + 1;
        const ch = maxY - minY + 1;
        const cropped = document.createElement('canvas');
        cropped.width = cw;
        cropped.height = ch;
        cropped.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
        canvas = cropped;
        w = cw;
        h = ch;
      }
    }

    const out = await new Promise((resolve) => canvas.toBlob(resolve, cutout ? 'image/png' : 'image/jpeg', 0.86));
    if (!out) throw new Error('De foto kon niet verwerkt worden.');
    return { blob: out, cutout, w, h };
  } catch (err) {
    if (err.name === 'EncodingError') throw new Error('Dit bestandstype wordt niet ondersteund.');
    throw err;
  } finally {
    URL.revokeObjectURL(src);
  }
}

export const images = {
  async save(blob) {
    const rec = { id: uid(), ...(await process(blob)) };
    await db.put('images', rec);
    cache.set(rec.id, { url: URL.createObjectURL(rec.blob), cutout: rec.cutout });
    return rec.id;
  },

  // Laad de opgegeven foto's in, zodat url() daarna direct werkt.
  async preload(ids) {
    const todo = [...new Set(ids.filter(Boolean))].filter((id) => !cache.has(id));
    await Promise.all(todo.map(async (id) => {
      const rec = await db.get('images', id);
      if (rec) cache.set(id, { url: URL.createObjectURL(rec.blob), cutout: !!rec.cutout });
    }));
  },

  url: (id) => cache.get(id)?.url || null,
  isCutout: (id) => !!cache.get(id)?.cutout,

  async remove(id) {
    const hit = cache.get(id);
    if (hit) URL.revokeObjectURL(hit.url);
    cache.delete(id);
    await db.del('images', id);
  },

  reset() {
    for (const hit of cache.values()) URL.revokeObjectURL(hit.url);
    cache.clear();
  },
};
