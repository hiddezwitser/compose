// Instellingen: thema, back-up, opslag.

import { getSetting, setSetting } from '../db.js';
import { testProxy } from '../linkfill.js';
import { getTheme, setTheme } from '../theme.js';
import { createBackupFile, saveBackupFile, restoreBackupFile } from '../backup.js';
import { VERSION, icons, fmt, toast, isStandalone, esc } from '../ui.js';
import { backLink } from './common.js';

export async function settings() {
  const theme = getTheme();
  const lastBackup = await getSetting('lastBackup');
  const proxy = await getSetting('proxyUrl', '');
  const choice = (value, label) =>
    `<button type="button" role="radio" aria-checked="${theme === value}" data-theme-choice="${value}">${label}</button>`;

  return {
    html: `
      <header class="page-head">
        <div class="stack">
          ${backLink('#/home', 'Home')}
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
        <div class="label strong">Slim invullen</div>
        <p class="hint">Plak een webshop-link bij een wens of kledingstuk, en Composé vult naam, prijs, merk en foto zelf in. Daarvoor is je eigen Cloudflare-koppeling nodig.</p>
        <label class="field">
          <span class="label">Adres van je koppeling</span>
          <input id="proxy" type="url" inputmode="url" autocomplete="off" placeholder="https://compose.jouwnaam.workers.dev" value="${esc(proxy)}">
        </label>
        <button type="button" class="btn block" id="proxy-save">Opslaan en testen</button>
        <p class="small" id="proxy-status">${proxy ? 'Ingesteld.' : 'Nog niet ingesteld.'}</p>
      </section>

      <section class="group">
        <div class="label strong">Over</div>
        <div class="meta-list">
          <div><span>Versie</span><span class="v">${VERSION}</span></div>
          <div><span>Geïnstalleerd als app</span><span class="v">${isStandalone() ? 'Ja' : 'Nee'}</span></div>
        </div>
      </section>
    `,
    mount(root, { rerender }) {
      root.querySelectorAll('[data-theme-choice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTheme(btn.dataset.themeChoice);
          root.querySelectorAll('[data-theme-choice]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
        });
      });

      // Back-up maken. iOS staat het deelmenu alleen toe kort na een tik; duurt het samenstellen
      // te lang, dan vragen we om nog één tik.
      const exportBtn = root.querySelector('#export');
      const done = () => {
        root.querySelector('#last-backup').textContent = fmt.date(new Date());
        toast('Back-up bewaard');
      };
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

      const proxyInput = root.querySelector('#proxy');
      const proxyStatus = root.querySelector('#proxy-status');
      root.querySelector('#proxy-save').addEventListener('click', async () => {
        let url = proxyInput.value.trim().replace(/\/+$/, '');
        if (!url) {
          await setSetting('proxyUrl', '');
          proxyStatus.textContent = 'Uitgezet.';
          return;
        }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        proxyInput.value = url;
        proxyStatus.textContent = 'Testen…';
        try {
          await testProxy(url);
          await setSetting('proxyUrl', url);
          proxyStatus.innerHTML = '<span class="ok">Werkt. Slim invullen staat aan.</span>';
        } catch (err) {
          proxyStatus.textContent = err.name === 'TypeError' || err.name === 'TimeoutError'
            ? 'Geen verbinding. Klopt het adres, en staat je GitHub-adres in de Worker-code?'
            : `Mislukt: ${err.message}`;
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
