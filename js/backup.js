// Back-up: alle gegevens (inclusief foto's) in één JSON-bestand,
// te bewaren in iCloud Drive via het deelmenu, en weer terug te zetten.

import { dumpAll, replaceAll, setSetting } from './db.js';
import { VERSION } from './ui.js';
import { images } from './images.js';

const FORMAT = 'compose-backup';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function createBackupFile() {
  const data = await dumpAll();
  data.images = await Promise.all(
    data.images.map(async ({ blob, ...rest }) => ({ ...rest, data: await blobToDataUrl(blob) })),
  );
  const payload = { format: FORMAT, formatVersion: 1, appVersion: VERSION, exportedAt: new Date().toISOString(), data };
  const stamp = new Date().toISOString().slice(0, 10);
  return new File([JSON.stringify(payload)], `compose-backup-${stamp}.json`, { type: 'application/json' });
}

// Probeert het deelmenu (Bewaar in Bestanden → iCloud Drive), anders een gewone download.
// Gooit 'NotAllowedError' als iOS het deelmenu weigert omdat de tik te lang geleden is.
export async function saveBackupFile(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Composé back-up' });
    } catch (err) {
      if (err.name === 'AbortError') return false; // gebruiker sloot het deelmenu
      throw err;
    }
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  await setSetting('lastBackup', new Date().toISOString());
  return true;
}

export async function restoreBackupFile(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (e) {
    throw new Error('Dit bestand is geen geldige back-up.');
  }
  if (payload?.format !== FORMAT || !payload.data) throw new Error('Dit bestand is geen Composé-back-up.');

  const data = { ...payload.data };
  data.images = await Promise.all(
    (data.images || []).map(async ({ data: url, ...rest }) => ({ ...rest, blob: await dataUrlToBlob(url) })),
  );
  await replaceAll(data);
  images.reset();
  return payload.exportedAt;
}
