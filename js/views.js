// Routetabel: welk scherm hoort bij welk adres (#/...), en welk tabblad dan actief is.

import { home } from './views/home.js';
import { kast, pieceEditor } from './views/kast.js';
import { board, outfitsList, profile } from './views/atelier.js';
import { outfitEditor } from './views/outfit.js';
import { settings } from './views/settings.js';
import { wishlist, wishEditor, boughtList } from './views/wishlist.js';
import { upcoming } from './views/common.js';

const budget = upcoming({
  title: 'Budget', sub: 'Per maand, per categorie.', numeral: 'IV',
  line: 'Rust in je uitgaven.',
  note: 'Maandbudget per categorie en uitgaven bijhouden. Volgt in fase 4.',
});

export const routes = [
  { path: /^home$/, tab: 'home', view: home },
  { path: /^instellingen$/, tab: 'home', view: settings },
  { path: /^atelier$/, tab: 'atelier', view: board },
  { path: /^atelier\/outfits$/, tab: 'atelier', view: outfitsList },
  { path: /^atelier\/profiel$/, tab: 'atelier', view: profile },
  { path: /^outfit\/nieuw$/, tab: 'atelier', view: () => outfitEditor(null) },
  { path: /^outfit\/([\w-]+)$/, tab: 'atelier', view: (m) => outfitEditor(m[1]) },
  { path: /^kast$/, tab: 'kast', view: kast },
  { path: /^kast\/nieuw(?:\/(want|consider))?$/, tab: 'kast', view: (m) => pieceEditor(null, m[1]) },
  { path: /^kast\/([\w-]+)$/, tab: 'kast', view: (m) => pieceEditor(m[1]) },
  { path: /^wishlist$/, tab: 'wishlist', view: wishlist },
  { path: /^wishlist\/nieuw$/, tab: 'wishlist', view: () => wishEditor(null) },
  { path: /^wishlist\/gekocht$/, tab: 'wishlist', view: boughtList },
  { path: /^wishlist\/([\w-]+)$/, tab: 'wishlist', view: (m) => wishEditor(m[1]) },
  { path: /^budget$/, tab: 'budget', view: budget },
];
