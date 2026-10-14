// Atelier: moodboard, outfits-overzicht en stijlprofiel.

import { db, uid } from '../db.js';
import { images } from '../images.js';
import {
  CATEGORIES, COLORS, colorOf, euro, occasionName, loadWardrobe, outfitMissing, deleteBoardItem,
  getProfile, saveProfile, plural,
} from '../data.js';
import { esc, icons, toast, sheet, pickFile, readClipboardImage, setPasteHandler, dropZone } from '../ui.js';
import { flatlay, missingText, atelierTabs, pieceVisual } from './common.js';

function header() {
  return `
    <header class="page-head">
      <div class="stack"><h1 class="display">Atelier</h1><p class="sub">Jouw esthetiek, samengebracht.</p></div>
    </header>`;
}

// ---------- Moodboard ----------

export async function board() {
  const w = await loadWardrobe();
  const profile = await getProfile();
  const items = w.board.map((item) => boardItem(item, w)).filter(Boolean);

  const strip = `
    <a class="profile-strip" href="#/atelier/profiel">
      <div class="chips">${profile.words.map((word) => `<span class="chip static">${esc(word)}</span>`).join('')}</div>
      <div class="palette-dots"><span class="label">Palet</span>${profile.palette.map((k) => colorOf(k)).filter(Boolean)
        .map((c) => `<span class="dot" style="background:${c.hex}" title="${c.name}"></span>`).join('')}</div>
    </a>`;

  return {
    html: `
      ${header()}
      ${atelierTabs('board')}
      ${strip}
      <div id="board-drop">
        ${items.length
          ? `<div class="masonry">${items.join('')}</div>`
          : `<div class="empty">
               <div class="line">Verzamel wat je aanspreekt.</div>
               <p class="hint">Inspiratiefoto's, notities, stukken uit je kast en outfits komen hier samen. Tik op + om te beginnen, of plak of sleep een foto.</p>
             </div>`}
      </div>
      <button type="button" class="fab" id="add" aria-label="Toevoegen aan moodboard">${icons.plus}</button>`,
    mount(root, { rerender }) {
      const addImage = async (blob) => {
        if (!blob) return;
        try {
          const imageId = await images.save(blob);
          await db.put('board', { id: uid(), type: 'image', imageId, createdAt: Date.now() });
          rerender();
        } catch (err) {
          toast(err.message);
        }
      };
      setPasteHandler(addImage);
      dropZone(root.querySelector('#board-drop'), addImage);

      root.querySelector('#add').addEventListener('click', () => addSheet(w, addImage, rerender));
      root.querySelectorAll('.mb-item').forEach((el) => el.addEventListener('click', () => {
        const item = w.board.find((b) => b.id === el.dataset.id);
        if (item) itemSheet(item, w, rerender);
      }));
    },
  };
}

function boardItem(item, w) {
  const open = (cls, inner, tag) =>
    `<button type="button" class="mb-item ${cls}" data-id="${esc(item.id)}">${inner}${tag ? `<span class="tag">${tag}</span>` : ''}</button>`;

  if (item.type === 'image') {
    const url = images.url(item.imageId);
    if (!url) return '';
    return open(images.isCutout(item.imageId) ? 'cutout' : '', `<img src="${url}" alt="Inspiratie">`, 'Inspiratie');
  }
  if (item.type === 'note') {
    return open('note', `<span class="mb-quote">${esc(item.text)}</span><span class="label">Notitie</span>`, '');
  }
  if (item.type === 'piece') {
    const p = w.byId.get(item.refId);
    if (!p) return '';
    const url = images.url(p.imageId);
    const tag = p.status === 'have' ? 'Mijn stuk' : 'Wens' + (p.price ? ' · ' + euro(p.price) : '');
    if (url) return open(images.isCutout(p.imageId) ? 'cutout' : '', `<img src="${url}" alt="${esc(p.name)}">`, esc(tag));
    return open('', `<div class="mb-swatch" style="background:${colorOf(p.color)?.hex || 'var(--tile)'}"><span>${esc(p.name)}</span></div>`, esc(tag));
  }
  if (item.type === 'outfit') {
    const o = w.outfitById.get(item.refId);
    if (!o) return '';
    return open('outfit', flatlay(o, w.byId, { mini: true }), 'Outfit · ' + esc(o.name));
  }
  return '';
}

function addSheet(w, addImage, rerender) {
  sheet(`
    <div class="sheet-title">Toevoegen</div>
    <div class="sheet-list">
      <button type="button" data-act="photo">${icons.image}Inspiratiefoto kiezen</button>
      <button type="button" data-act="paste">${icons.paste}Foto plakken</button>
      <button type="button" data-act="note">${icons.note}Notitie schrijven</button>
      <button type="button" data-act="piece">${icons.hanger}Stuk uit je kast</button>
      <button type="button" data-act="outfit">${icons.outfit}Outfit</button>
    </div>`, (el, close) => {
    el.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'paste') {
        // Klembord lezen moet direct na de tik gebeuren, dus vóór het sluiten.
        let blob = null;
        try { blob = await readClipboardImage(); } catch (err) { if (err.name !== 'NotAllowedError') toast(err.message); }
        close();
        addImage(blob);
        return;
      }
      close();
      if (act === 'photo') addImage(await pickFile());
      if (act === 'note') noteSheet(null, rerender);
      if (act === 'piece') pickPieceSheet(w, rerender);
      if (act === 'outfit') pickOutfitSheet(w, rerender);
    });
  });
}

function noteSheet(item, rerender) {
  sheet(`
    <div class="sheet-title">${item ? 'Notitie bewerken' : 'Notitie'}</div>
    <label class="field"><span class="label">Tekst</span>
      <textarea id="note-text" rows="4" maxlength="280" placeholder="Bijv. zachte schouders, hoge taille, gedempte tinten.">${esc(item?.text || '')}</textarea>
    </label>
    <button type="button" class="btn primary block" id="note-save">Opslaan</button>`, (el, close) => {
    const ta = el.querySelector('#note-text');
    ta.focus();
    el.querySelector('#note-save').addEventListener('click', async () => {
      const text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      await db.put('board', item ? { ...item, text } : { id: uid(), type: 'note', text, createdAt: Date.now() });
      close();
      rerender();
    });
  });
}

function pickPieceSheet(w, rerender) {
  if (!w.pieces.length) { toast('Je kast is nog leeg'); return; }
  const pinned = new Set(w.board.filter((b) => b.type === 'piece').map((b) => b.refId));
  sheet(`
    <div class="sheet-title">Stuk uit je kast</div>
    <div class="pick-grid">
      ${w.pieces.map((p) => `
        <button type="button" data-id="${esc(p.id)}"${pinned.has(p.id) ? ' disabled' : ''}>
          ${pieceVisual(p)}<span>${esc(p.name)}</span>
        </button>`).join('')}
    </div>`, (el, close) => {
    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-id]');
      if (!btn || btn.disabled) return;
      await db.put('board', { id: uid(), type: 'piece', refId: btn.dataset.id, createdAt: Date.now() });
      close();
      rerender();
    });
  });
}

function pickOutfitSheet(w, rerender) {
  if (!w.outfits.length) { toast('Je hebt nog geen outfits'); return; }
  const pinned = new Set(w.board.filter((b) => b.type === 'outfit').map((b) => b.refId));
  sheet(`
    <div class="sheet-title">Outfit</div>
    <div class="sheet-list">
      ${w.outfits.map((o) => `<button type="button" data-id="${esc(o.id)}"${pinned.has(o.id) ? ' disabled' : ''}>${icons.outfit}${esc(o.name)}</button>`).join('')}
    </div>`, (el, close) => {
    el.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-id]');
      if (!btn || btn.disabled) return;
      await db.put('board', { id: uid(), type: 'outfit', refId: btn.dataset.id, createdAt: Date.now() });
      close();
      rerender();
    });
  });
}

function itemSheet(item, w, rerender) {
  let title = 'Inspiratie';
  let actions = '';
  if (item.type === 'image') {
    actions = `<button type="button" data-act="view">${icons.image}Groot bekijken</button>`;
  } else if (item.type === 'note') {
    title = 'Notitie';
    actions = `<button type="button" data-act="edit">${icons.edit}Bewerken</button>`;
  } else if (item.type === 'piece') {
    title = w.byId.get(item.refId)?.name || 'Stuk';
    actions = `<button type="button" data-act="open">${icons.hanger}Bekijk stuk</button>`;
  } else if (item.type === 'outfit') {
    title = w.outfitById.get(item.refId)?.name || 'Outfit';
    actions = `<button type="button" data-act="open">${icons.outfit}Open outfit</button>`;
  }
  const removeLabel = item.type === 'image' || item.type === 'note' ? 'Verwijderen' : 'Van moodboard halen';

  sheet(`
    <div class="sheet-title">${esc(title)}</div>
    <div class="sheet-list">
      ${actions}
      <button type="button" data-act="remove" class="danger">${icons.trash}${removeLabel}</button>
    </div>`, (el, close) => {
    el.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      close();
      if (act === 'open') location.hash = item.type === 'piece' ? `#/kast/${item.refId}` : `#/outfit/${item.refId}`;
      if (act === 'edit') noteSheet(item, rerender);
      if (act === 'view') {
        sheet(`<img class="sheet-image" src="${images.url(item.imageId)}" alt="Inspiratie">`, (s, c) => s.addEventListener('click', c));
      }
      if (act === 'remove') {
        if ((item.type === 'image' || item.type === 'note') && !confirm('Van je moodboard verwijderen?')) return;
        await deleteBoardItem(item);
        rerender();
      }
    });
  });
}

// ---------- Outfits ----------

export async function outfitsList() {
  const w = await loadWardrobe();
  const cards = w.outfits.map((o) => `
    <a class="outfit-card" href="#/outfit/${esc(o.id)}">
      ${flatlay(o, w.byId, { mini: true })}
      <div class="piece-name">${esc(o.name)}</div>
      <div class="small">${[occasionName(o.occasion), missingText(outfitMissing(o, w.byId))].filter(Boolean).map(esc).join(' · ')}</div>
    </a>`).join('');

  return {
    html: `
      ${header()}
      ${atelierTabs('outfits')}
      ${w.outfits.length
        ? `<a class="btn block" href="#/outfit/nieuw">${icons.plus}Nieuwe outfit</a><div class="grid2">${cards}</div>`
        : `<div class="empty">
             <div class="line">Combineer tot een look.</div>
             <p class="hint">${w.pieces.length
               ? 'Leg stukken uit je kast samen, ook wat je nog niet hebt. Zo zie je wat er ontbreekt.'
               : 'Voeg eerst een paar stukken toe aan je kast, daarna stel je hier outfits samen.'}</p>
             <a class="btn primary" href="${w.pieces.length ? '#/outfit/nieuw' : '#/kast/nieuw'}">${icons.plus}${w.pieces.length ? 'Eerste outfit' : 'Naar je kast'}</a>
           </div>`}`,
  };
}

// ---------- Profiel ----------

export async function profile() {
  const w = await loadWardrobe();
  const p = await getProfile();
  const prof = { words: [...p.words], palette: [...p.palette] };

  const owned = w.pieces.filter((x) => x.status === 'have');
  const counts = new Map();
  for (const x of owned) if (x.color) counts.set(x.color, (counts.get(x.color) || 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);

  const colorSection = ranked.length ? `
    <div class="colorbar">${ranked.map(([k, n]) => `<span style="flex:${n};background:${colorOf(k).hex}" title="${colorOf(k).name}"></span>`).join('')}</div>
    <div class="legend">${ranked.slice(0, 6).map(([k, n]) => `<span><i style="background:${colorOf(k).hex}"></i>${colorOf(k).name} ${n}</span>`).join('')}</div>
    <p class="hint" id="outside"></p>`
    : '<p class="hint">Geef stukken in je kast een kleur, dan zie je hier hoe je garderobe is opgebouwd.</p>';

  return {
    html: `
      ${header()}
      ${atelierTabs('profiel')}

      <section class="group">
        <div class="label strong">Stijlwoorden</div>
        <div class="chips" id="words"></div>
        <form class="inline-add" id="word-form">
          <input id="word" maxlength="30" autocomplete="off" placeholder="Woord toevoegen" aria-label="Stijlwoord">
          <button type="submit" class="btn small">Toevoegen</button>
        </form>
      </section>

      <section class="group">
        <div class="label strong">Kleurpalet</div>
        <p class="hint">De kleuren die bij jouw stijl horen.</p>
        <div class="palette-grid">
          ${COLORS.map((c) => `
            <button type="button" data-color="${c.key}" aria-pressed="${prof.palette.includes(c.key)}">
              <span class="dot" style="background:${c.hex}"></span>${c.name}
            </button>`).join('')}
        </div>
      </section>

      <section class="group">
        <div class="label strong">Je kast in kleur</div>
        ${colorSection}
      </section>

      <section class="group">
        <div class="label strong">Per categorie</div>
        <div class="meta-list">
          ${CATEGORIES.map((c) => {
            const have = owned.filter((x) => x.category === c.id).length;
            const want = w.pieces.filter((x) => x.category === c.id && x.status !== 'have').length;
            return `<div><span>${esc(c.name)}</span><span class="v">${have} heb ik${want ? ` · ${want} gewenst` : ''}</span></div>`;
          }).join('')}
        </div>
      </section>`,
    mount(root) {
      const wordsEl = root.querySelector('#words');
      const renderWords = () => {
        wordsEl.innerHTML = prof.words.length
          ? prof.words.map((word, i) => `<button type="button" class="chip" data-i="${i}" aria-label="${esc(word)} verwijderen">${esc(word)}${icons.close}</button>`).join('')
          : '<span class="hint">Nog geen woorden.</span>';
      };
      const updateOutside = () => {
        const el = root.querySelector('#outside');
        if (!el) return;
        const n = w.pieces.filter((x) => x.color && !prof.palette.includes(x.color)).length;
        el.textContent = n ? `${plural(n, 'stuk valt', 'stukken vallen')} buiten je palet.` : 'Alles in je kast past binnen je palet.';
      };
      wordsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-i]');
        if (!btn) return;
        prof.words.splice(Number(btn.dataset.i), 1);
        saveProfile(prof);
        renderWords();
      });
      root.querySelector('#word-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = root.querySelector('#word');
        const word = input.value.trim();
        if (word && !prof.words.includes(word)) {
          prof.words.push(word);
          saveProfile(prof);
          renderWords();
        }
        input.value = '';
      });
      root.querySelectorAll('[data-color]').forEach((btn) => btn.addEventListener('click', () => {
        const k = btn.dataset.color;
        prof.palette = prof.palette.includes(k) ? prof.palette.filter((x) => x !== k) : [...prof.palette, k];
        btn.setAttribute('aria-pressed', String(prof.palette.includes(k)));
        saveProfile(prof);
        updateOutside();
      }));
      renderWords();
      updateOutside();
    },
  };
}
