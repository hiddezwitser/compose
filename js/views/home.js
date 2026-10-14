// Dashboard.

import { db, getSetting } from '../db.js';
import { images } from '../images.js';
import { loadWardrobe, outfitMissing, colorOf, plural } from '../data.js';
import { esc, icons, fmt, greeting, isStandalone } from '../ui.js';
import { missingText } from './common.js';

export async function home() {
  const [w, wishCount, lastBackup] = await Promise.all([loadWardrobe(), db.count('wishes'), getSetting('lastBackup')]);
  const wanted = w.pieces.filter((p) => p.status !== 'have');
  const wishTotal = wishCount + wanted.length;

  // Drie beelden uit het atelier: eerst moodboard, aangevuld met stukken uit de kast.
  const tiles = [];
  for (const b of w.board) {
    if (b.type === 'image') tiles.push({ url: images.url(b.imageId), cutout: images.isCutout(b.imageId) });
    if (b.type === 'piece' && w.byId.get(b.refId)) tiles.push(pieceTile(w.byId.get(b.refId)));
    if (tiles.length >= 3) break;
  }
  for (const p of w.pieces) {
    if (tiles.length >= 3) break;
    if (!w.board.some((b) => b.refId === p.id)) tiles.push(pieceTile(p));
  }
  while (tiles.length < 3) tiles.push({});
  const tileHtml = tiles.map((t) => t.url
    ? `<div class="visual ${t.cutout ? 'cutout' : 'photo'}"><img src="${t.url}" alt=""></div>`
    : `<div class="visual"${t.hex ? ` style="background:${t.hex}"` : ''}></div>`).join('');

  const latest = w.outfits[0];
  const atelierLine = latest
    ? `<a class="atelier-line" href="#/outfit/${esc(latest.id)}"><span class="serif">Outfit: ${esc(latest.name)}</span><span class="small">${esc(missingText(outfitMissing(latest, w.byId)))}</span></a>`
    : `<div class="small">${w.pieces.length ? 'Nog geen outfits samengesteld.' : 'Je atelier is nog leeg.'}</div>`;

  const installCard = isStandalone() ? '' : `
    <section class="card">
      <div class="label strong">Zet Composé op je beginscherm</div>
      <p class="hint">Open deze pagina in Safari, tik op <b>Deel</b> en kies <b>Zet op beginscherm</b>. Daarna opent Composé als een echte app, ook offline.</p>
    </section>`;

  const backupNudge = lastBackup || !w.pieces.length ? '' : `
    <a class="rule-row" href="#/instellingen">
      <div><div class="label strong">Back-up</div><div class="small">Nog geen back-up gemaakt</div></div>
      <span class="link">Instellingen</span>
    </a>`;

  return {
    html: `
      <header class="page-head">
        <div class="stack">
          <div class="label">${esc(fmt.today())}</div>
          <h1 class="display">${greeting()}.</h1>
        </div>
        <a class="icon-btn" href="#/instellingen" aria-label="Instellingen">${icons.settings}</a>
      </header>

      ${installCard}

      <section class="card">
        <div class="section-head"><div class="label strong">Deze week</div><div class="small">Google Agenda</div></div>
        <div class="empty-line">Je agenda verschijnt hier zodra we hem koppelen.</div>
      </section>

      <section class="card green">
        <div class="section-head"><div class="label">Budget ${esc(fmt.month())}</div><a href="#/budget" style="color: #D7BC97">Bekijk</a></div>
        <div class="empty-line">Nog geen budget ingesteld.</div>
      </section>

      <section class="section">
        <div class="section-head"><div class="label strong">Uit je Atelier</div><a href="#/atelier">Openen</a></div>
        <a class="tiles" href="#/atelier" aria-label="Naar je Atelier">${tileHtml}</a>
        ${atelierLine}
      </section>

      <a class="rule-row" href="#/kast">
        <div><div class="label strong">Kledingkast</div><div class="small">${plural(w.pieces.length, 'stuk', 'stukken')} · ${plural(w.outfits.length, 'outfit', 'outfits')}</div></div>
        <span class="link">Bekijk</span>
      </a>

      <a class="rule-row" href="#/wishlist">
        <div><div class="label strong">Wishlist</div><div class="small">${plural(wishTotal, 'wens', 'wensen')}</div></div>
        <span class="link">Bekijk</span>
      </a>

      ${backupNudge}
    `,
  };
}

function pieceTile(p) {
  return p.imageId && images.url(p.imageId)
    ? { url: images.url(p.imageId), cutout: images.isCutout(p.imageId) }
    : { hex: colorOf(p.color)?.hex };
}
