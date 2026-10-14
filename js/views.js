// Schermen. Elk scherm geeft { html, mount? } terug; mount koppelt de knoppen.

import { db, getSetting } from './db.js';
import { getTheme, setTheme } from './theme.js';
import { createBackupFile, saveBackupFile, restoreBackupFile } from './backup.js';
import { VERSION, icons, fmt, greeting, toast, isStandalone, esc } from './ui.js';

// ---------- Home ----------

async function home() {
  const [wishCount, lastBackup] = await Promise.all([db.count('wishes'), getSetting('lastBackup')]);
  const month = fmt.month();

  const installCard = isStandalone() ? '' : `
    <section class="card">
      <div class="label strong">Zet Composé op je beginscherm</div>
      <p class="hint">Open deze pagina in Safari, tik op <b>Deel</b> en kies <b>Zet op beginscherm</b>. Daarna opent Composé als een echte app, ook offline.</p>
    </section>`;

  const backupNudge = lastBackup ? '' : `
    <a class="rule-row" href="#/instellingen" style="color: inherit">
      <div><div class="label strong">Back-up</div><div class="small" style="margin-top: 4px">Nog geen back-up gemaakt</div></div>
      <span style="font-size: 12px; color: var(--camel)">Instellingen</span>
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
        <div class="section-head"><div class="label">Budget ${esc(month)}</div><a href="#/budget" style="color: #D7BC97">Bekijk</a></div>
        <div class="empty-line">Nog geen budget ingesteld.</div>
      </section>

      <section class="section">
        <div class="section-head"><div class="label strong">Uit je Atelier</div><a href="#/atelier">Openen</a></div>
        <div class="tiles" aria-hidden="true"><div></div><div></div><div></div></div>
        <div class="small">Je moodboard is nog leeg.</div>
      </section>

      <a class="rule-row" href="#/wishlist" style="color: inherit">
        <div><div class="label strong">Wishlist</div><div class="small" style="margin-top: 4px">${wishCount} ${wishCount === 1 ? 'wens' : 'wensen'}</div></div>
        <span style="font-size: 12px; color: var(--camel)">Bekijk</span>
      </a>

      ${backupNudge}
    `,
  };
}

// ---------- Tabbladen die in latere fases gevuld worden ----------

function upcoming({ title, sub, numeral, line, note }) {
  return () => ({
    html: `
      <header class="page-head">
        <div class="stack"><h1 class="display">${title}</h1><p class="sub">${sub}</p></div>
      </header>
      <div class="empty">
        <div class="numeral">${numeral}</div>
        <div class="line">${line}</div>
        <p class="hint">${note}</p>
      </div>
    `,
  });
}

const atelier = upcoming({
  title: 'Atelier', sub: 'Jouw esthetiek, samengebracht.', numeral: 'II',
  line: 'Hier bouw je je eigen stijl.',
  note: 'Moodboard, outfits samenstellen en je stijlprofiel. Volgt in fase 2.',
});

const kast = upcoming({
  title: 'Kledingkast', sub: 'Wat je hebt en wat je wilt.', numeral: 'II',
  line: 'Je garderobe, stuk voor stuk.',
  note: 'Stukken toevoegen met foto, heb ik / wil ik, en wat er nog ontbreekt. Volgt in fase 2.',
});

const wishlist = upcoming({
  title: 'Wishlist', sub: 'Overzicht van wat je wilt en wat het kost.', numeral: 'III',
  line: 'Bewust kiezen, helder overzicht.',
  note: 'Kleding, camera, muziek en gadgets met prijs en prioriteit. Volgt in fase 3.',
});

const budget = upcoming({
  title: 'Budget', sub: 'Per maand, per categorie.', numeral: 'IV',
  line: 'Rust in je uitgaven.',
  note: 'Maandbudget per categorie en uitgaven bijhouden. Volgt in fase 4.',
});

// ---------- Instellingen ----------

async function settings() {
  const theme = getTheme();
  const lastBackup = await getSetting('lastBackup');
  const choice = (value, label) =>
    `<button type="button" role="radio" aria-checked="${theme === value}" data-theme-choice="${value}">${label}</button>`;

  return {
    html: `
      <header class="page-head">
        <div class="stack">
          <a class="back" href="#/home">${icons.back}Home</a>
          <h1 class="display">Instellingen</h1>
        </div>
      </header>

      <section class="group">
        <div class="label strong">Weergave</div>
        <div class="segmented" role="radiogroup" aria-label="Thema">
          ${choice('auto', 'Automatisch')}${choice('light', 'Licht')}${choice('dark', 'Donker')}
        </div>
        <p class="hint">Automatisch volgt de licht/donker-instelling van je iPhone.</p>
      </section>

      <section class="group">
        <div class="label strong">Gegevens</div>
        <p class="hint">Alles wat je invoert staat alleen op deze telefoon. Maak regelmatig een back-up en bewaar die in iCloud Drive, dan raak je niets kwijt als de app verdwijnt.</p>
        <div class="btn-row">
          <button type="button" class="btn primary block" id="export">${icons.share}Back-up maken</button>
          <button type="button" class="btn block" id="import">Back-up terugzetten</button>
          <input type="file" id="import-file" accept="application/json,.json" hidden>
        </div>
        <div class="meta-list">
          <div><span>Laatste back-up</span><span class="v" id="last-backup">${lastBackup ? esc(fmt.date(lastBackup)) : 'Nog nooit'}</span></div>
          <div><span>Opslag in gebruik</span><span class="v" id="usage">…</span></div>
          <div><span>Beschermd tegen opschonen</span><span class="v" id="persisted">…</span></div>
        </div>
      </section>

      <section class="group">
        <div class="label strong">Over</div>
        <div class="meta-list">
          <div><span>Versie</span><span class="v">${VERSION}</span></div>
          <div><span>Geïnstalleerd als app</span><span class="v">${isStandalone() ? 'Ja' : 'Nee'}</span></div>
        </div>
      </section>
    `,
    mount(root, rerender) {
      root.querySelectorAll('[data-theme-choice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTheme(btn.dataset.themeChoice);
          root.querySelectorAll('[data-theme-choice]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
        });
      });

      // Back-up maken. iOS staat het deelmenu alleen toe kort na een tik; duurt het samenstellen
      // te lang, dan vragen we om nog één tik.
      const exportBtn = root.querySelector('#export');
      exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        try {
          const file = await createBackupFile();
          try {
            if (await saveBackupFile(file)) done();
          } catch (err) {
            if (err.name !== 'NotAllowedError') throw err;
            toast('Back-up is klaar', { label: 'Bewaren', sticky: true, run: () => saveBackupFile(file).then((ok) => ok && done()) });
          }
        } catch (err) {
          toast('Back-up mislukt: ' + err.message);
        } finally {
          exportBtn.disabled = false;
        }
      });
      function done() {
        root.querySelector('#last-backup').textContent = fmt.date(new Date());
        toast('Back-up bewaard');
      }

      const fileInput = root.querySelector('#import-file');
      root.querySelector('#import').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        if (!confirm('Dit vervangt alle gegevens in de app door die uit de back-up. Doorgaan?')) return;
        try {
          const when = await restoreBackupFile(file);
          toast('Back-up van ' + fmt.date(when) + ' teruggezet');
          rerender();
        } catch (err) {
          toast(err.message);
        }
      });

      showStorage(root);
    },
  };
}

async function showStorage(root) {
  const usage = root.querySelector('#usage');
  const persisted = root.querySelector('#persisted');
  if (navigator.storage?.estimate) {
    const { usage: bytes = 0 } = await navigator.storage.estimate();
    usage.textContent = (bytes / 1024 / 1024).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + ' MB';
  } else {
    usage.textContent = 'Onbekend';
  }
  if (navigator.storage?.persisted) {
    const yes = await navigator.storage.persisted();
    persisted.textContent = yes ? 'Ja' : 'Nee';
    persisted.classList.toggle('ok', yes);
  } else {
    persisted.textContent = 'Onbekend';
  }
}

export const routes = { home, atelier, kast, wishlist, budget, instellingen: settings };
