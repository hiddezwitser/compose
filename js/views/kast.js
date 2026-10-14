// Kledingkast: overzicht met filters, en het formulier voor één stuk.

import { db, uid } from '../db.js';
import {
  CATEGORIES, STATUS, COLORS, occasionName, loadWardrobe, gapInsight, deletePiece, plural, parsePrice, euro,
} from '../data.js';
import { esc, icons, toast, fmt } from '../ui.js';
import { pieceCard, backLink, mountPhotoZone, commitPhoto, priorityControl, purchaseSheet } from './common.js';

// Filter blijft bewaard zolang de app open is.
const filter = { status: 'all', cat: 'all' };

export async function kast() {
  const w = await loadWardrobe();
  const wanted = w.pieces.filter((p) => p.status !== 'have').length;
  const newHref = filter.status === 'want' || filter.status === 'consider' ? `#/kast/nieuw/${filter.status}` : '#/kast/nieuw';

  const head = `
    <header class="page-head">
      <div class="stack">
        <h1 class="display">Kledingkast</h1>
        <p class="sub">${plural(w.pieces.length, 'stuk', 'stukken')} · ${wanted} gewenst</p>
      </div>
      <a class="icon-btn" href="${newHref}" aria-label="Stuk toevoegen">${icons.plus}</a>
    </header>`;

  if (!w.pieces.length) {
    return {
      html: `${head}
        <div class="empty">
          <div class="line">Je garderobe, stuk voor stuk.</div>
          <p class="hint">Begin met wat je al hebt en voeg daarna toe wat je wilt. Uitgeknipte foto's (in Foto's: houd een kledingstuk ingedrukt → Kopieer) geven het mooiste resultaat.</p>
          <a class="btn primary" href="#/kast/nieuw">${icons.plus}Eerste stuk toevoegen</a>
        </div>`,
    };
  }

  const statusChip = (id, label) =>
    `<button type="button" class="chip" data-status="${id}" aria-pressed="${filter.status === id}">${label}</button>`;
  const catTab = (id, label) =>
    `<button type="button" data-cat="${id}" aria-pressed="${filter.cat === id}">${esc(label)}</button>`;

  return {
    html: `${head}
      <div class="chips">
        ${statusChip('all', 'Alles')}${statusChip('have', 'Heb ik')}${statusChip('want', 'Wil ik')}${statusChip('consider', 'Overweeg')}
      </div>
      <div class="subtabs" role="group" aria-label="Categorie">
        ${catTab('all', 'Alle')}${CATEGORIES.map((c) => catTab(c.id, c.name)).join('')}
      </div>
      ${insightCard(gapInsight(w))}
      <div id="grid"></div>`,
    mount(root) {
      const grid = root.querySelector('#grid');
      const renderGrid = () => {
        const list = w.pieces.filter((p) =>
          (filter.status === 'all' || p.status === filter.status) && (filter.cat === 'all' || p.category === filter.cat));
        grid.innerHTML = list.length
          ? `<div class="grid2">${list.map((p) => pieceCard(p, w.usage)).join('')}</div>`
          : '<p class="hint">Niets gevonden met deze filters.</p>';
      };
      root.querySelectorAll('[data-status]').forEach((btn) => btn.addEventListener('click', () => {
        filter.status = btn.dataset.status;
        root.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        const add = root.querySelector('.page-head .icon-btn');
        add.href = filter.status === 'want' || filter.status === 'consider' ? `#/kast/nieuw/${filter.status}` : '#/kast/nieuw';
        renderGrid();
      }));
      root.querySelectorAll('[data-cat]').forEach((btn) => btn.addEventListener('click', () => {
        filter.cat = btn.dataset.cat;
        root.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        renderGrid();
      }));
      renderGrid();
    },
  };
}

function insightCard(insight) {
  if (!insight) return '';
  let text;
  let href = '#/kast';
  if (insight.kind === 'completes') {
    text = `<b>${esc(insight.piece.name)}</b> maakt ${plural(insight.n, 'outfit', 'outfits')} compleet.`;
    href = `#/kast/${esc(insight.piece.id)}`;
  } else if (insight.kind === 'appears') {
    text = `<b>${esc(insight.piece.name)}</b> zit in ${plural(insight.n, 'outfit', 'outfits')} die nog niet compleet ${insight.n === 1 ? 'is' : 'zijn'}.`;
    href = `#/kast/${esc(insight.piece.id)}`;
  } else {
    text = `Nog niets in <b>${esc(insight.category.name.toLowerCase())}</b> in je kast.`;
  }
  return `
    <a class="card insight" href="${href}">
      <span class="insight-icon">${icons.info}</span>
      <div><div class="label camel">Wat ontbreekt</div><div class="insight-text">${text}</div></div>
    </a>`;
}

// ---------- Formulier voor één stuk ----------

export async function pieceEditor(id, presetStatus) {
  const existing = id ? await db.get('pieces', id) : null;
  if (id && !existing) {
    return { html: `${backLink('#/kast', 'Kast')}<div class="empty"><div class="line">Dit stuk bestaat niet meer.</div></div>` };
  }
  const w = await loadWardrobe();
  const piece = existing ? { ...existing } : {
    name: '', status: STATUS[presetStatus] ? presetStatus : 'have', priority: 'nice', category: 'overhemden',
    color: null, brand: '', price: null, link: '', note: '', imageId: null,
  };
  const inOutfits = existing ? w.outfits.filter((o) => o.items.some((it) => it.pieceId === id)) : [];
  const onBoard = existing ? w.board.some((b) => b.refId === id) : false;

  const statusBtn = (s) =>
    `<button type="button" role="radio" data-status="${s}" aria-checked="${piece.status === s}">${STATUS[s].label}</button>`;
  const swatch = (c) =>
    `<button type="button" class="swatch" data-color="${c.key}" aria-pressed="${piece.color === c.key}" aria-label="${c.name}" title="${c.name}" style="background:${c.hex}"></button>`;
  const safeLink = /^https?:\/\//i.test(piece.link || '') ? piece.link : '';

  return {
    html: `
      <div class="topbar">
        ${backLink('#/kast', 'Kast')}
        <button type="button" class="btn primary small" id="save">Opslaan</button>
      </div>

      <div class="photo-zone" id="photo"></div>

      <label class="field">
        <span class="label">Naam</span>
        <input id="name" class="name-input" autocomplete="off" placeholder="Bijv. navy blazer" value="${esc(piece.name)}">
      </label>

      <div class="field">
        <span class="label">Status</span>
        <div class="segmented" role="radiogroup" aria-label="Status">${statusBtn('have')}${statusBtn('want')}${statusBtn('consider')}</div>
      </div>

      <div class="field" data-wish-only>
        <span class="label">Prioriteit</span>
        ${priorityControl(piece.priority || 'nice')}
      </div>

      <label class="field">
        <span class="label">Categorie</span>
        <span class="select"><select id="category">
          ${CATEGORIES.map((c) => `<option value="${c.id}"${piece.category === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select></span>
      </label>

      <div class="field">
        <span class="label">Kleur <span id="color-name" class="color-name">${esc(COLORS.find((c) => c.key === piece.color)?.name || '')}</span></span>
        <div class="swatches">${COLORS.map(swatch).join('')}</div>
      </div>

      <div class="row2">
        <label class="field"><span class="label">Merk</span><input id="brand" autocomplete="off" value="${esc(piece.brand)}"></label>
        <label class="field"><span class="label">Prijs (€)</span><input id="price" inputmode="decimal" autocomplete="off" placeholder="0" value="${piece.price != null ? esc(String(piece.price).replace('.', ',')) : ''}"></label>
      </div>

      <label class="field">
        <span class="label">Link ${safeLink ? `<a href="${esc(safeLink)}" target="_blank" rel="noopener" class="field-link">Openen</a>` : ''}</span>
        <input id="link" type="url" inputmode="url" autocomplete="off" placeholder="https://" value="${esc(piece.link)}">
      </label>

      <label class="field">
        <span class="label">Notitie</span>
        <textarea id="note" rows="3" placeholder="Pasvorm, maat, waar te koop…">${esc(piece.note)}</textarea>
      </label>

      ${existing ? `
        <section class="group">
          <div class="label strong">Komt voor in</div>
          ${inOutfits.length
            ? `<div class="meta-list">${inOutfits.map((o) => `<div><a href="#/outfit/${esc(o.id)}" style="color: inherit">${esc(o.name)}</a><span class="v">${esc(occasionName(o.occasion))}</span></div>`).join('')}</div>`
            : '<p class="hint">Nog in geen enkele outfit.</p>'}
        </section>
        <div class="btn-row">
          ${existing.status !== 'have' ? `<button type="button" class="btn primary block" id="bought">Gekocht</button>` : ''}
          ${existing.status === 'have' && existing.boughtAt ? `<p class="hint">Gekocht op ${esc(fmt.date(existing.boughtAt))}${existing.boughtPrice != null ? ` voor ${esc(euro(existing.boughtPrice))}` : ''}.</p>` : ''}
          <button type="button" class="btn block" id="pin"${onBoard ? ' disabled' : ''}>${icons.pin}${onBoard ? 'Staat op je moodboard' : 'Op moodboard zetten'}</button>
          <button type="button" class="btn block danger" id="delete">${icons.trash}Verwijderen</button>
        </div>` : ''}
    `,
    mount(root, { rerender }) {
      let dirty = false;
      const markDirty = () => { dirty = true; };
      root.querySelectorAll('input, textarea, select').forEach((el) => el.addEventListener('input', markDirty));

      mountPhotoZone(root.querySelector('#photo'), piece, existing?.imageId, markDirty);

      // Status (prioriteit en "gekocht" alleen bij wensen), prioriteit en kleur
      const wishOnly = root.querySelectorAll('[data-wish-only]');
      const syncWishOnly = () => wishOnly.forEach((el) => { el.hidden = piece.status === 'have'; });
      root.querySelectorAll('[data-status]').forEach((btn) => btn.addEventListener('click', () => {
        piece.status = btn.dataset.status;
        dirty = true;
        root.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
        syncWishOnly();
      }));
      root.querySelectorAll('[data-priority]').forEach((btn) => btn.addEventListener('click', () => {
        piece.priority = btn.dataset.priority;
        dirty = true;
        root.querySelectorAll('[data-priority]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
      }));
      syncWishOnly();
      root.querySelectorAll('[data-color]').forEach((btn) => btn.addEventListener('click', () => {
        piece.color = piece.color === btn.dataset.color ? null : btn.dataset.color;
        dirty = true;
        root.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === piece.color)));
        root.querySelector('#color-name').textContent = COLORS.find((c) => c.key === piece.color)?.name || '';
      }));

      // Opslaan
      root.querySelector('#save').addEventListener('click', async () => {
        const name = root.querySelector('#name').value.trim();
        if (!name) {
          toast('Geef het stuk een naam');
          root.querySelector('#name').focus();
          return;
        }
        const price = parsePrice(root.querySelector('#price').value);
        if (Number.isNaN(price)) {
          toast('Prijs is geen geldig bedrag');
          root.querySelector('#price').focus();
          return;
        }
        const now = Date.now();
        const record = {
          ...piece,
          id: existing?.id || uid(),
          name,
          category: root.querySelector('#category').value,
          brand: root.querySelector('#brand').value.trim(),
          price,
          link: root.querySelector('#link').value.trim(),
          note: root.querySelector('#note').value.trim(),
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        if (record.status !== 'have') { delete record.boughtAt; delete record.boughtPrice; }
        await db.put('pieces', record);
        await commitPhoto(existing?.imageId, record.imageId);
        dirty = false;
        toast(existing ? 'Opgeslagen' : 'Toegevoegd aan je kast');
        location.hash = '#/kast';
      });

      // Terug zonder opslaan
      root.querySelector('[data-back]').addEventListener('click', (e) => {
        if (dirty && !confirm('Je wijzigingen zijn niet opgeslagen. Toch terug?')) e.preventDefault();
      });

      if (existing) {
        root.querySelector('#bought')?.addEventListener('click', () => {
          purchaseSheet({ kind: 'piece', id: existing.id, name: existing.name, price: existing.price }, rerender);
        });
        const pin = root.querySelector('#pin');
        pin.addEventListener('click', async () => {
          await db.put('board', { id: uid(), type: 'piece', refId: existing.id, createdAt: Date.now() });
          pin.disabled = true;
          pin.innerHTML = `${icons.pin}Staat op je moodboard`;
          toast('Op je moodboard gezet');
        });
        root.querySelector('#delete').addEventListener('click', async () => {
          const extra = inOutfits.length ? ` Het verdwijnt ook uit ${plural(inOutfits.length, 'outfit', 'outfits')}.` : '';
          if (!confirm(`"${existing.name}" verwijderen?${extra}`)) return;
          await deletePiece(existing.id);
          toast('Verwijderd');
          location.hash = '#/kast';
        });
      }
    },
  };
}
