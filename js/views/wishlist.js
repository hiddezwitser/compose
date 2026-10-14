// Wishlist: overzicht van alles wat je wilt (kleding uit de kast + overige wensen),
// formulier voor overige wensen, en een overzicht van wat je gekocht hebt.

import { db, uid } from '../db.js';
import { images } from '../images.js';
import {
  WISH_CATEGORIES, PRIORITIES, colorOf, euro, plural, parsePrice, hostOf,
  loadWishlist, sumPrices, unmarkBought, deleteWish,
} from '../data.js';
import { esc, icons, toast, sheet, fmt } from '../ui.js';
import { backLink, mountPhotoZone, commitPhoto, priorityControl, purchaseSheet } from './common.js';

const view = { cat: 'all', sort: 'priority' };
const PRIO_NAME = Object.fromEntries(PRIORITIES.map((p) => [p.id, p.name]));
const CAT_FILTERS = [{ id: 'all', name: 'Alles' }, { id: 'kleding', name: 'Kleding' }, ...WISH_CATEGORIES];

const monthFmt = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' });
const monthLabel = (ym) => {
  const s = monthFmt.format(new Date(ym + '-01T12:00:00'));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function thumb(entry) {
  const url = images.url(entry.imageId);
  if (url) return `<div class="visual thumb ${images.isCutout(entry.imageId) ? 'cutout' : 'photo'}"><img src="${url}" alt=""></div>`;
  const hex = colorOf(entry.color)?.hex;
  return `<div class="visual thumb"${hex ? ` style="background:${hex}"` : ''}></div>`;
}

function row(entry, { bought = false } = {}) {
  const host = hostOf(entry.link);
  const meta = bought
    ? [entry.catLabel, entry.boughtAt ? fmt.date(entry.boughtAt) : '']
    : [entry.catLabel, host, entry.inAtelier ? 'in Atelier' : ''];
  const price = bought ? entry.boughtPrice : entry.price;
  return `
    <a class="wish-row" href="${esc(entry.href)}">
      ${thumb(entry)}
      <div class="wish-main">
        <div class="piece-name">${esc(entry.name)}</div>
        <div class="small">${meta.filter(Boolean).map(esc).join(' · ')}</div>
      </div>
      <div class="wish-side">
        <div class="serif price">${price != null ? euro(price) : '—'}</div>
        ${bought ? '' : `<div class="prio ${entry.priority}">${PRIO_NAME[entry.priority]}</div>`}
      </div>
    </a>`;
}

// ---------- Overzicht ----------

export async function wishlist() {
  const { open, bought } = await loadWishlist();
  const month = new Date().toISOString().slice(0, 7);
  const boughtNow = bought.filter((b) => (b.boughtAt || '').startsWith(month));

  return {
    html: `
      <header class="page-head">
        <div class="stack">
          <h1 class="display">Wishlist</h1>
          <p class="sub" id="count"></p>
        </div>
        <div class="total"><div class="label">Totaal</div><div class="serif" id="total"></div></div>
      </header>

      <div class="chips">
        ${CAT_FILTERS.map((c) => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${view.cat === c.id}">${esc(c.name)}</button>`).join('')}
      </div>

      <div class="totals" id="prio-totals"></div>

      <div class="section-head">
        <div class="label strong">Wensen</div>
        <label class="sort"><span class="sr-only">Sorteren</span>
          <select id="sort">
            <option value="priority">Op prioriteit</option>
            <option value="price-desc">Prijs hoog–laag</option>
            <option value="price-asc">Prijs laag–hoog</option>
            <option value="new">Nieuwste eerst</option>
          </select>
        </label>
      </div>

      <div class="wish-list" id="list"></div>

      <a class="rule-row" href="#/wishlist/gekocht">
        <div><div class="label strong">Gekocht</div><div class="small">${boughtNow.length ? `${boughtNow.length} deze maand` : 'Nog niets deze maand'}</div></div>
        <span class="serif">${boughtNow.length ? euro(boughtNow.reduce((s, b) => s + (b.boughtPrice || 0), 0)) : ''} <span class="link">›</span></span>
      </a>

      <button type="button" class="fab" id="add" aria-label="Wens toevoegen">${icons.plus}</button>`,
    mount(root) {
      const sortEl = root.querySelector('#sort');
      sortEl.value = view.sort;

      const render = () => {
        let list = open.filter((e) => view.cat === 'all' || e.cat === view.cat);
        if (view.sort === 'price-desc') list = [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
        if (view.sort === 'price-asc') list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        if (view.sort === 'new') list = [...list].sort((a, b) => b.createdAt - a.createdAt);

        root.querySelector('#count').textContent = plural(list.length, 'wens', 'wensen');
        root.querySelector('#total').textContent = euro(sumPrices(list));
        root.querySelector('#prio-totals').innerHTML = PRIORITIES.map((p) =>
          `<div><div class="label">${p.name}</div><div class="serif">${euro(sumPrices(list.filter((e) => e.priority === p.id)))}</div></div>`).join('');
        root.querySelector('#list').innerHTML = list.length
          ? list.map((e) => row(e)).join('')
          : `<p class="hint">${open.length ? 'Niets in deze categorie.' : 'Nog geen wensen. Tik op + om iets toe te voegen.'}</p>`;
      };

      root.querySelectorAll('[data-cat]').forEach((btn) => btn.addEventListener('click', () => {
        view.cat = btn.dataset.cat;
        root.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        render();
      }));
      sortEl.addEventListener('change', () => { view.sort = sortEl.value; render(); });

      root.querySelector('#add').addEventListener('click', () => {
        sheet(`
          <div class="sheet-title">Wens toevoegen</div>
          <div class="sheet-list">
            <button type="button" data-go="#/kast/nieuw/want">${icons.hanger}<span>Kledingstuk<span class="small block">Komt ook in je kast als "Wil ik"</span></span></button>
            <button type="button" data-go="#/wishlist/nieuw">${icons.pin}<span>Iets anders<span class="small block">Camera, muziek, gadgets…</span></span></button>
          </div>`, (el) => {
          el.addEventListener('click', (e) => {
            const go = e.target.closest('[data-go]')?.dataset.go;
            if (go) location.hash = go;
          });
        });
      });

      render();
    },
  };
}

// ---------- Aankopen ----------

export async function boughtList() {
  const { bought } = await loadWishlist();
  const groups = new Map();
  for (const b of bought) {
    const ym = (b.boughtAt || '').slice(0, 7) || 'onbekend';
    if (!groups.has(ym)) groups.set(ym, []);
    groups.get(ym).push(b);
  }
  const sections = [...groups].map(([ym, list]) => `
    <section class="section">
      <div class="section-head">
        <div class="label strong">${ym === 'onbekend' ? 'Zonder datum' : esc(monthLabel(ym))}</div>
        <div class="serif month-total">${euro(list.reduce((s, b) => s + (b.boughtPrice || 0), 0))}</div>
      </div>
      <div class="wish-list">${list.map((b) => row(b, { bought: true })).join('')}</div>
    </section>`).join('');

  return {
    html: `
      <header class="page-head">
        <div class="stack">
          ${backLink('#/wishlist', 'Wishlist')}
          <h1 class="display">Gekocht</h1>
          <p class="sub">Wat je van je wishlist hebt aangeschaft.</p>
        </div>
      </header>
      ${sections || '<div class="empty"><div class="line">Nog niets gekocht.</div><p class="hint">Tik bij een wens op "Gekocht" om hem hier te zetten.</p></div>'}`,
  };
}

// ---------- Formulier voor een overige wens ----------

export async function wishEditor(id) {
  const existing = id ? await db.get('wishes', id) : null;
  if (id && !existing) {
    return { html: `${backLink('#/wishlist', 'Wishlist')}<div class="empty"><div class="line">Deze wens bestaat niet meer.</div></div>` };
  }
  if (existing?.imageId) await images.preload([existing.imageId]);
  const wish = existing ? { ...existing } : {
    name: '', category: 'camera', priority: 'nice', price: null, link: '', note: '', imageId: null, status: 'wanted',
  };
  const isBought = existing?.status === 'bought';
  const safeLink = /^https?:\/\//i.test(wish.link || '') ? wish.link : '';

  return {
    html: `
      <div class="topbar">
        ${backLink(isBought ? '#/wishlist/gekocht' : '#/wishlist', isBought ? 'Gekocht' : 'Wishlist')}
        <button type="button" class="btn primary small" id="save">Opslaan</button>
      </div>

      <div class="photo-zone" id="photo"></div>

      <label class="field">
        <span class="label">Naam</span>
        <input id="name" class="name-input" autocomplete="off" placeholder="Bijv. 35mm f/1.4 lens" value="${esc(wish.name)}">
      </label>

      <div class="field">
        <span class="label">Categorie</span>
        <div class="chips">
          ${WISH_CATEGORIES.map((c) => `<button type="button" class="chip" data-category="${c.id}" aria-pressed="${wish.category === c.id}">${esc(c.name)}</button>`).join('')}
        </div>
      </div>

      ${isBought ? '' : `
      <div class="field">
        <span class="label">Prioriteit</span>
        ${priorityControl(wish.priority)}
      </div>`}

      <div class="row2">
        <label class="field"><span class="label">Prijs (€)</span><input id="price" inputmode="decimal" autocomplete="off" placeholder="0" value="${wish.price != null ? esc(String(wish.price).replace('.', ',')) : ''}"></label>
        <label class="field"><span class="label">Link ${safeLink ? `<a href="${esc(safeLink)}" target="_blank" rel="noopener" class="field-link">Openen</a>` : ''}</span><input id="link" type="url" inputmode="url" autocomplete="off" placeholder="https://" value="${esc(wish.link)}"></label>
      </div>

      <label class="field">
        <span class="label">Notitie</span>
        <textarea id="note" rows="3" placeholder="Waarom, welke variant, waar te koop…">${esc(wish.note)}</textarea>
      </label>

      ${existing ? `
        <div class="btn-row">
          ${isBought
            ? `<p class="hint">Gekocht op ${esc(fmt.date(existing.boughtAt))}${existing.boughtPrice != null ? ` voor ${esc(euro(existing.boughtPrice))}` : ''}.</p>
               <button type="button" class="btn block" id="unbuy">Terug naar wishlist</button>`
            : '<button type="button" class="btn primary block" id="bought">Gekocht</button>'}
          <button type="button" class="btn block danger" id="delete">${icons.trash}Verwijderen</button>
        </div>` : ''}
    `,
    mount(root, { rerender }) {
      let dirty = false;
      const markDirty = () => { dirty = true; };
      root.querySelectorAll('input, textarea').forEach((el) => el.addEventListener('input', markDirty));
      mountPhotoZone(root.querySelector('#photo'), wish, existing?.imageId, markDirty);

      root.querySelectorAll('[data-category]').forEach((btn) => btn.addEventListener('click', () => {
        wish.category = btn.dataset.category;
        dirty = true;
        root.querySelectorAll('[data-category]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      }));
      root.querySelectorAll('[data-priority]').forEach((btn) => btn.addEventListener('click', () => {
        wish.priority = btn.dataset.priority;
        dirty = true;
        root.querySelectorAll('[data-priority]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
      }));

      const save = async () => {
        const name = root.querySelector('#name').value.trim();
        if (!name) { toast('Geef je wens een naam'); root.querySelector('#name').focus(); return null; }
        const price = parsePrice(root.querySelector('#price').value);
        if (Number.isNaN(price)) { toast('Prijs is geen geldig bedrag'); root.querySelector('#price').focus(); return null; }
        const now = Date.now();
        const record = {
          ...wish,
          id: existing?.id || uid(),
          name,
          price,
          link: root.querySelector('#link').value.trim(),
          note: root.querySelector('#note').value.trim(),
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        await db.put('wishes', record);
        await commitPhoto(existing?.imageId, record.imageId);
        dirty = false;
        return record;
      };

      root.querySelector('#save').addEventListener('click', async () => {
        if (!(await save())) return;
        toast(existing ? 'Opgeslagen' : 'Toegevoegd aan je wishlist');
        location.hash = isBought ? '#/wishlist/gekocht' : '#/wishlist';
      });

      root.querySelector('[data-back]').addEventListener('click', (e) => {
        if (dirty && !confirm('Je wijzigingen zijn niet opgeslagen. Toch terug?')) e.preventDefault();
      });

      if (existing) {
        root.querySelector('#bought')?.addEventListener('click', async () => {
          const rec = dirty ? await save() : existing;
          if (!rec) return;
          purchaseSheet({ kind: 'wish', id: rec.id, name: rec.name, price: rec.price }, () => { location.hash = '#/wishlist'; });
        });
        root.querySelector('#unbuy')?.addEventListener('click', async () => {
          await unmarkBought({ kind: 'wish', id: existing.id });
          toast('Terug op je wishlist');
          rerender();
        });
        root.querySelector('#delete').addEventListener('click', async () => {
          if (!confirm(`"${existing.name}" verwijderen?`)) return;
          await deleteWish(existing.id);
          toast('Verwijderd');
          location.hash = isBought ? '#/wishlist/gekocht' : '#/wishlist';
        });
      }
    },
  };
}
