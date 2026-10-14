// Outfit samenstellen: stukken op een vlak leggen (flat lay), verschuiven, schalen.

import { db, uid } from '../db.js';
import { CATEGORIES, OCCASIONS, euro, loadWardrobe, outfitMissing, deleteOutfit, plural } from '../data.js';
import { esc, icons, toast } from '../ui.js';
import { flatlay, backLink, pieceVisual } from './common.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export async function outfitEditor(id) {
  const w = await loadWardrobe();
  const existing = id ? w.outfitById.get(id) : null;
  if (id && !existing) {
    return { html: `${backLink('#/atelier/outfits', 'Outfits')}<div class="empty"><div class="line">Deze outfit bestaat niet meer.</div></div>` };
  }
  const state = existing
    ? { ...existing, items: existing.items.map((it) => ({ ...it })) }
    : { name: '', occasion: 'kantoor', items: [], note: '' };
  const onBoard = existing ? w.board.some((b) => b.refId === existing.id) : false;

  return {
    html: `
      <div class="topbar">
        ${backLink('#/atelier/outfits', 'Outfits')}
        <button type="button" class="btn primary small" id="save">Opslaan</button>
      </div>

      <input id="name" class="name-input" autocomplete="off" placeholder="Naam van de outfit" aria-label="Naam van de outfit" value="${esc(state.name)}">

      <div class="chips" id="occasions">
        ${OCCASIONS.map((o) => `<button type="button" class="chip" data-occasion="${o.id}" aria-pressed="${state.occasion === o.id}">${o.name}</button>`).join('')}
      </div>

      <div id="canvas"></div>

      <div class="toolbar" id="tools" hidden>
        <button type="button" class="chip" data-tool="smaller">Kleiner</button>
        <button type="button" class="chip" data-tool="bigger">Groter</button>
        <button type="button" class="chip" data-tool="front">Naar voren</button>
        <button type="button" class="chip" data-tool="back">Naar achteren</button>
        <button type="button" class="chip" data-tool="remove" aria-label="Weghalen uit outfit">${icons.close}</button>
      </div>

      <div class="summary" id="summary"></div>

      <section class="group">
        <div class="label strong">Kies uit je kast</div>
        ${w.pieces.length ? `
          <div class="subtabs" id="pick-cats">
            <button type="button" data-cat="all" aria-pressed="true">Alle</button>
            ${CATEGORIES.map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="false">${esc(c.name)}</button>`).join('')}
          </div>
          <div class="strip" id="strip"></div>
          <p class="small">Tik om toe te voegen of weg te halen · sleep op het vlak om te schikken</p>`
        : '<p class="hint">Je kast is nog leeg. <a href="#/kast/nieuw">Voeg eerst stukken toe.</a></p>'}
      </section>

      <label class="field">
        <span class="label">Notitie</span>
        <textarea id="note" rows="2" placeholder="Bijv. bruine riem bij bruine schoen.">${esc(state.note)}</textarea>
      </label>

      ${existing ? `
        <div class="btn-row">
          <button type="button" class="btn block" id="pin"${onBoard ? ' disabled' : ''}>${icons.pin}${onBoard ? 'Staat op je moodboard' : 'Op moodboard zetten'}</button>
          <button type="button" class="btn block danger" id="delete">${icons.trash}Outfit verwijderen</button>
        </div>` : ''}
    `,
    mount(root) {
      let selected = -1;
      let pickCat = 'all';
      let dirty = false;
      const canvas = root.querySelector('#canvas');
      const tools = root.querySelector('#tools');

      const renderCanvas = () => {
        canvas.innerHTML = flatlay(state, w.byId, { interactive: true, selected });
        tools.hidden = selected < 0;
      };
      const renderSummary = () => {
        const el = root.querySelector('#summary');
        if (!state.items.length) { el.innerHTML = ''; return; }
        const { missing, cost } = outfitMissing(state, w.byId);
        el.innerHTML = missing.length
          ? `<span>${plural(missing.length, 'stuk', 'stukken')} nog niet in bezit</span>${cost ? `<span class="serif cost">+ ${euro(cost)}</span>` : ''}`
          : '<span class="ok">Compleet: alles hangt al in je kast</span>';
      };
      const renderStrip = () => {
        const strip = root.querySelector('#strip');
        if (!strip) return;
        const used = new Set(state.items.map((it) => it.pieceId));
        const list = w.pieces.filter((p) => pickCat === 'all' || p.category === pickCat);
        strip.innerHTML = list.length
          ? list.map((p) => `
              <button type="button" data-piece="${esc(p.id)}" aria-pressed="${used.has(p.id)}">
                ${pieceVisual(p)}<span>${esc(p.name)}</span>
              </button>`).join('')
          : '<p class="hint">Niets in deze categorie.</p>';
      };
      const changed = () => { dirty = true; renderCanvas(); renderSummary(); renderStrip(); };

      // Slepen op het vlak
      canvas.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('.fl-item');
        if (!el) {
          if (selected >= 0) { selected = -1; renderCanvas(); }
          return;
        }
        e.preventDefault();
        const i = Number(el.dataset.index);
        if (selected !== i) {
          canvas.querySelectorAll('.fl-item.selected').forEach((x) => x.classList.remove('selected'));
          el.classList.add('selected');
          selected = i;
          tools.hidden = false;
        }
        const rect = canvas.querySelector('.flatlay').getBoundingClientRect();
        const it = state.items[i];
        const start = { x: e.clientX, y: e.clientY, ix: it.x, iy: it.y };
        el.setPointerCapture(e.pointerId);
        const move = (ev) => {
          it.x = clamp(start.ix + (ev.clientX - start.x) / rect.width, -0.15, 0.95);
          it.y = clamp(start.iy + (ev.clientY - start.y) / rect.height, -0.15, 0.95);
          el.style.left = (it.x * 100).toFixed(2) + '%';
          el.style.top = (it.y * 100).toFixed(2) + '%';
          dirty = true;
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });

      // Gereedschap voor het geselecteerde stuk
      tools.addEventListener('click', (e) => {
        const tool = e.target.closest('[data-tool]')?.dataset.tool;
        if (!tool || selected < 0) return;
        const it = state.items[selected];
        const byZ = [...state.items].sort((a, b) => (a.z || 0) - (b.z || 0));
        if (tool === 'smaller') it.w = clamp(it.w - 0.05, 0.12, 0.9);
        if (tool === 'bigger') it.w = clamp(it.w + 0.05, 0.12, 0.9);
        if (tool === 'front') byZ.filter((x) => x !== it).concat(it).forEach((x, n) => { x.z = n + 1; });
        if (tool === 'back') [it].concat(byZ.filter((x) => x !== it)).forEach((x, n) => { x.z = n + 1; });
        if (tool === 'remove') { state.items.splice(selected, 1); selected = -1; }
        changed();
      });

      // Stukken kiezen
      root.querySelector('#pick-cats')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        pickCat = btn.dataset.cat;
        root.querySelectorAll('#pick-cats [data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        renderStrip();
      });
      root.querySelector('#strip')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-piece]');
        if (!btn) return;
        const pieceId = btn.dataset.piece;
        if (state.items.some((it) => it.pieceId === pieceId)) {
          state.items = state.items.filter((it) => it.pieceId !== pieceId);
          selected = -1;
        } else {
          const n = state.items.length;
          const z = state.items.reduce((m, it) => Math.max(m, it.z || 0), 0) + 1;
          state.items.push({ pieceId, x: 0.05 + (n % 3) * 0.31, y: 0.04 + (Math.floor(n / 3) % 3) * 0.31, w: 0.3, z });
          selected = state.items.length - 1;
        }
        changed();
      });

      root.querySelector('#occasions').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-occasion]');
        if (!btn) return;
        state.occasion = btn.dataset.occasion;
        dirty = true;
        root.querySelectorAll('[data-occasion]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      });
      root.querySelectorAll('#name, #note').forEach((el) => el.addEventListener('input', () => { dirty = true; }));

      root.querySelector('#save').addEventListener('click', async () => {
        const name = root.querySelector('#name').value.trim();
        if (!name) { toast('Geef de outfit een naam'); root.querySelector('#name').focus(); return; }
        if (!state.items.length) { toast('Voeg minstens één stuk toe'); return; }
        const now = Date.now();
        await db.put('outfits', {
          ...state,
          id: existing?.id || uid(),
          name,
          note: root.querySelector('#note').value.trim(),
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        });
        dirty = false;
        toast(existing ? 'Outfit opgeslagen' : 'Outfit toegevoegd');
        location.hash = '#/atelier/outfits';
      });

      root.querySelector('[data-back]').addEventListener('click', (e) => {
        if (dirty && !confirm('Je wijzigingen zijn niet opgeslagen. Toch terug?')) e.preventDefault();
      });

      if (existing) {
        const pin = root.querySelector('#pin');
        pin.addEventListener('click', async () => {
          await db.put('board', { id: uid(), type: 'outfit', refId: existing.id, createdAt: Date.now() });
          pin.disabled = true;
          pin.innerHTML = `${icons.pin}Staat op je moodboard`;
          toast('Op je moodboard gezet');
        });
        root.querySelector('#delete').addEventListener('click', async () => {
          if (!confirm(`Outfit "${existing.name}" verwijderen? De stukken blijven in je kast.`)) return;
          await deleteOutfit(existing.id);
          toast('Outfit verwijderd');
          location.hash = '#/atelier/outfits';
        });
      }

      renderCanvas();
      renderSummary();
      renderStrip();
    },
  };
}
