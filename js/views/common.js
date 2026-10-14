// Bouwstenen die meerdere schermen delen: stuk-tegels, flat lay, koppen.

import { images } from '../images.js';
import { STATUS, catName, colorOf, euro, plural } from '../data.js';
import { esc, icons } from '../ui.js';

// Beeld van een stuk: foto (uitgeknipt of gewoon) of een kleurvlak.
export function pieceVisual(piece, cls = 'tile') {
  const url = images.url(piece.imageId);
  if (url) {
    const kind = images.isCutout(piece.imageId) ? 'cutout' : 'photo';
    return `<div class="visual ${cls} ${kind}"><img src="${url}" alt="" draggable="false"></div>`;
  }
  const hex = colorOf(piece.color)?.hex;
  return `<div class="visual ${cls} swatch-fill"${hex ? ` style="background:${hex}"` : ''}></div>`;
}

export function statusLabel(piece) {
  const s = STATUS[piece.status] || STATUS.have;
  return `<span class="status ${s.cls}">${s.label}</span>`;
}

export function pieceCard(piece, usage) {
  const n = usage.get(piece.id) || 0;
  return `
    <a class="piece" href="#/kast/${esc(piece.id)}">
      ${pieceVisual(piece)}
      <div class="piece-row"><span class="piece-name">${esc(piece.name)}</span>${statusLabel(piece)}</div>
      <div class="small">${esc(catName(piece.category))}${n ? ` · in ${plural(n, 'outfit', 'outfits')}` : ''}</div>
    </a>`;
}

// Flat lay van een outfit. Posities zijn fracties van de breedte/hoogte van het vlak.
export function flatlay(outfit, byId, { interactive = false, mini = false, selected = -1 } = {}) {
  const items = outfit.items.map((it, i) => {
    const p = byId.get(it.pieceId);
    if (!p) return '';
    const url = images.url(p.imageId);
    const kind = url ? (images.isCutout(p.imageId) ? 'cutout' : 'photo') : 'swatch';
    const hex = colorOf(p.color)?.hex || 'var(--tile)';
    const visual = url
      ? `<img src="${url}" alt="${esc(p.name)}" draggable="false">`
      : `<div class="fl-swatch" style="background:${hex}"><span>${esc(p.name)}</span></div>`;
    return `<div class="fl-item ${kind}${i === selected ? ' selected' : ''}" data-index="${i}"
      style="left:${(it.x * 100).toFixed(2)}%;top:${(it.y * 100).toFixed(2)}%;width:${(it.w * 100).toFixed(2)}%;z-index:${it.z || 1}">
      ${visual}${p.status !== 'have' ? '<span class="fl-want">Wens</span>' : ''}</div>`;
  }).join('');
  const empty = !outfit.items.length && interactive
    ? '<div class="fl-empty">Kies hieronder stukken uit je kast</div>' : '';
  return `<div class="flatlay${interactive ? ' interactive' : ''}${mini ? ' mini' : ''}">${items}${empty}</div>`;
}

export function missingText({ missing, cost }) {
  if (!missing.length) return 'Compleet';
  return `${plural(missing.length, 'stuk', 'stukken')} nodig${cost ? ' · ' + euro(cost) : ''}`;
}

export function backLink(href, label) {
  return `<a class="back" href="${href}" data-back>${icons.back}${esc(label)}</a>`;
}

export function atelierTabs(active) {
  const tab = (id, href, label) =>
    `<a href="${href}" class="${active === id ? 'active' : ''}"${active === id ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="subnav" aria-label="Atelier">
    ${tab('board', '#/atelier', 'Moodboard')}${tab('outfits', '#/atelier/outfits', 'Outfits')}${tab('profiel', '#/atelier/profiel', 'Profiel')}
  </nav>`;
}

// Placeholder voor tabbladen uit latere fases.
export function upcoming({ title, sub, numeral, line, note }) {
  return () => ({
    html: `
      <header class="page-head">
        <div class="stack"><h1 class="display">${title}</h1><p class="sub">${sub}</p></div>
      </header>
      <div class="empty">
        <div class="numeral">${numeral}</div>
        <div class="line">${line}</div>
        <p class="hint">${note}</p>
      </div>`,
  });
}
