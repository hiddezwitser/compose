// Bouwstenen die meerdere schermen delen: stuk-tegels, flat lay, koppen.

import { images } from '../images.js';
import { STATUS, PRIORITIES, catName, colorOf, euro, plural, parsePrice, markBought } from '../data.js';
import { esc, icons, toast, sheet, pickFile, readClipboardImage, setPasteHandler, dropZone } from '../ui.js';
import { proxyUrl, fetchProduct, fetchImage } from '../linkfill.js';

// ---------- Fotovak (kiezen / plakken / slepen) ----------
// target: object met een imageId-veld dat wordt bijgewerkt. originalId: de foto zoals opgeslagen,
// die pas bij opslaan mag verdwijnen; tussentijds gekozen foto's ruimen we direct op.
export function mountPhotoZone(zone, target, originalId, onChange) {
  const isTemp = (id) => id && id !== originalId;
  const render = () => {
    const url = images.url(target.imageId);
    zone.classList.toggle('has-photo', !!url);
    zone.classList.toggle('cutout', !!url && images.isCutout(target.imageId));
    zone.innerHTML = url
      ? `<img src="${url}" alt="">
         <div class="photo-tools">
           <button type="button" class="chip on-photo" data-pick>${icons.image}Andere</button>
           <button type="button" class="chip on-photo" data-paste>${icons.paste}Plakken</button>
           <button type="button" class="chip on-photo" data-clear aria-label="Foto verwijderen">${icons.close}</button>
         </div>`
      : `<div class="empty-line">Voeg een foto toe</div>
         <p class="hint">Houd in Foto's het onderwerp ingedrukt, kies <b>Kopieer</b> en plak het hier. Of sleep een foto erheen.</p>
         <div class="photo-actions">
           <button type="button" class="btn small" data-pick>${icons.image}Kies foto</button>
           <button type="button" class="btn small" data-paste>${icons.paste}Plakken</button>
         </div>`;
  };
  const setImage = async (blob) => {
    if (!blob) return;
    zone.classList.add('busy');
    try {
      const newId = await images.save(blob);
      if (isTemp(target.imageId)) await images.remove(target.imageId);
      target.imageId = newId;
      onChange?.();
      render();
    } catch (err) {
      toast(err.message);
    } finally {
      zone.classList.remove('busy');
    }
  };
  zone.addEventListener('click', async (e) => {
    if (e.target.closest('[data-pick]')) setImage(await pickFile());
    else if (e.target.closest('[data-paste]')) {
      try { setImage(await readClipboardImage()); } catch (err) { if (err.name !== 'NotAllowedError') toast(err.message); }
    } else if (e.target.closest('[data-clear]')) {
      if (isTemp(target.imageId)) await images.remove(target.imageId);
      target.imageId = null;
      onChange?.();
      render();
    }
  });
  dropZone(zone, setImage);
  setPasteHandler(setImage);
  render();
  return { setImage };
}

// ---------- Linkveld met "Plak link" en slim invullen ----------

export function linkField(link) {
  const safe = /^https?:\/\//i.test(link || '') ? link : '';
  return `
    <div class="field">
      <span class="label">Link webshop ${safe ? `<a href="${esc(safe)}" target="_blank" rel="noopener" class="field-link">Openen</a>` : ''}</span>
      <div class="link-row">
        <input id="link" type="url" inputmode="url" autocomplete="off" placeholder="https://" value="${esc(link)}" aria-label="Link webshop">
        <button type="button" class="chip" id="paste-link">${icons.paste}Plak link</button>
      </div>
      <p class="small link-status" id="link-status" hidden></p>
    </div>`;
}

// apply(data) vult het formulier aan en geeft de namen terug van wat er is ingevuld.
export function mountLinkField(root, apply) {
  const input = root.querySelector('#link');
  const status = root.querySelector('#link-status');
  let last = input.value.trim();
  const say = (msg) => { status.hidden = !msg; status.textContent = msg || ''; };

  const fill = async () => {
    const link = input.value.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(link) || link === last) return;
    last = link;
    if (!(await proxyUrl())) {
      say('Tip: zet "Slim invullen" aan in Instellingen, dan vult Composé naam, prijs en foto zelf in.');
      return;
    }
    say('Gegevens ophalen…');
    try {
      const data = await fetchProduct(link);
      const filled = await apply(data);
      say(filled.length ? `Ingevuld: ${filled.join(', ')}. Controleer het even.` : 'Alles was al ingevuld.');
    } catch (err) {
      say(err.name === 'TypeError' || err.name === 'TimeoutError'
        ? 'Kon de koppeling niet bereiken. Vul het zelf in, of probeer het later opnieuw.'
        : `${err.message}. Vul het zelf in.`);
    }
  };

  input.addEventListener('change', fill);
  input.addEventListener('paste', () => setTimeout(fill, 0));
  root.querySelector('#paste-link').addEventListener('click', async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!/^https?:\/\//i.test(text)) { toast('Geen link op het klembord'); return; }
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fill();
    } catch (err) {
      if (err.name !== 'NotAllowedError') toast('Plakken lukt niet; plak de link handmatig in het veld');
    }
  });
}

// Productfoto van de webshop als foto gebruiken (alleen als er nog geen foto is).
export async function usePhotoFrom(data, target, photo) {
  if (target.imageId || !data.image) return false;
  try {
    await photo.setImage(await fetchImage(data.image));
    return !!target.imageId;
  } catch (e) {
    return false;
  }
}

// Na opslaan: de oude foto weg als die vervangen of verwijderd is.
export async function commitPhoto(originalId, newId) {
  if (originalId && originalId !== newId) await images.remove(originalId);
}

export function priorityControl(current) {
  return `<div class="segmented" role="radiogroup" aria-label="Prioriteit">
    ${PRIORITIES.map((p) => `<button type="button" role="radio" data-priority="${p.id}" aria-checked="${current === p.id}">${p.name}</button>`).join('')}
  </div>`;
}

// ---------- Gekocht ----------
// Vraagt wat je betaald hebt en wanneer, en markeert het daarna als gekocht.
export function purchaseSheet(entry, onDone) {
  const today = new Date().toISOString().slice(0, 10);
  const price = entry.price != null ? String(entry.price).replace('.', ',') : '';
  sheet(`
    <div class="sheet-title">Gekocht</div>
    <p class="hint">${esc(entry.name)}${entry.kind === 'piece' ? ' verhuist naar je kast als "Heb ik".' : ' verhuist naar je aankopen.'}</p>
    <div class="row2">
      <label class="field"><span class="label">Betaald (€)</span><input id="paid" inputmode="decimal" autocomplete="off" value="${esc(price)}"></label>
      <label class="field"><span class="label">Datum</span><input id="paid-on" type="date" value="${today}" max="${today}"></label>
    </div>
    <button type="button" class="btn primary block" id="confirm">Bevestigen</button>`, (el, close) => {
    el.querySelector('#confirm').addEventListener('click', async () => {
      const paid = parsePrice(el.querySelector('#paid').value);
      if (Number.isNaN(paid)) { toast('Bedrag is niet geldig'); return; }
      const date = el.querySelector('#paid-on').value || today;
      await markBought(entry, paid, date);
      close();
      toast('Gefeliciteerd met je aankoop');
      onDone?.();
    });
  });
}

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
