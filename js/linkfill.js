// Slim invullen vanaf een webshop-link, via het eigen doorgeefluik (Cloudflare Worker).
// Vult alleen aan; wat de gebruiker zelf heeft ingevuld blijft staan.

import { getSetting } from './db.js';

export async function proxyUrl() {
  const url = await getSetting('proxyUrl', '');
  return url ? url.replace(/\/+$/, '') : '';
}

async function call(path, params) {
  const base = await proxyUrl();
  if (!base) throw new Error('NO_PROXY');
  const res = await fetch(`${base}${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(15000) });
  return res;
}

export async function testProxy(base) {
  const res = await fetch(`${base.replace(/\/+$/, '')}/health`, { signal: AbortSignal.timeout(8000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Antwoord ${res.status}`);
  return data;
}

export async function fetchProduct(link) {
  const res = await call('/product', { url: link });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ophalen mislukt');
  if (data.currency && data.currency !== 'EUR') data.price = null; // geen omrekening; liever leeg dan fout
  return data;
}

export async function fetchImage(src) {
  const res = await call('/image', { url: src });
  if (!res.ok) throw new Error('Afbeelding ophalen mislukt');
  return res.blob();
}

// ---------- Raden op basis van woorden ----------

const has = (text, words) => new RegExp(`(^|[^a-zà-ÿ])(${words})([^a-zà-ÿ]|$)`, 'i').test(text);

// Volgorde telt: specifiek vóór algemeen (bijv. "t-shirt" vóór "shirt", "overshirt" vóór "jacket").
const PIECE_RULES = [
  ['schoenen', 'schoen(en)?|loafers?|instappers?|sneakers?|boots?|laarzen|laars|brogues?|derby|derbies|moccasins?|mocassins?|chelsea|suède schoen'],
  ['accessoires', 'riem|belt|horloge|watch|sjaal|scarf|stropdas|das|tie|pochet|tas|bag|sokken|socks|pet|cap|handschoenen|gloves|zonnebril|sunglasses|manchetknopen'],
  ['vesten', 'overshirt|shacket|shirt jacket|cardigan|vest|gilet|bodywarmer'],
  ['jassen', 'blazer|colbert|jasje|jacket|jas|coat|overcoat|mantel|trenchcoat|trench|bomber|parka|peacoat|caban'],
  ['knitwear', 'quarter[- ]?zip|half[- ]?zip|1/4[- ]?zip|trui|pullover|sweater|coltrui|col|rollneck|turtleneck|crewneck|v-hals|knit|gebreid|sweatshirt|hoodie'],
  ['shirts', 't-shirt|tee|polo|poloshirt'],
  ['overhemden', 'overhemd|shirt|oxford|button[- ]down'],
  ['broeken', 'broek|pantalon|chino|chinos|trousers|pants|jeans|denim|shorts'],
];

const WISH_RULES = [
  ['camera', 'camera|lens|objectief|sony|fujifilm|fuji|canon|nikon|leica|sigma|tamron|statief|tripod|flitser|sd[- ]kaart'],
  ['muziek', 'gitaar|guitar|fender|gibson|ukulele|snaren|strings|versterker|amplifier|effectpedaal|pedal|piano|synthesizer'],
  ['gadgets', 'koptelefoon|headphones|oordopjes|earbuds|airpods|iphone|ipad|macbook|laptop|smartwatch|speaker|kindle|e-reader|monitor|toetsenbord|keyboard|muis|powerbank|oplader'],
];

const COLOR_RULES = [
  ['antraciet', 'antraciet|charcoal|donkergrijs|dark grey|dark gray'],
  ['oxford', 'lichtblauw|light blue|sky blue|hemelsblauw|oxford blue'],
  ['navy', 'navy|marine|marineblauw|donkerblauw|dark blue|midnight'],
  ['ecru', 'ecru|crème|creme|cream|beige|stone|zand|sand|off[- ]white'],
  ['wit', 'wit|white'],
  ['kameel', 'camel|kameel|cognac|tan|caramel'],
  ['tabak', 'bruin|brown|tabak|tobacco|chocolate|chocolade|espresso|donkerbruin|dark brown|mocha'],
  ['flanel', 'grijs|grey|gray|flanel|flannel|mid grey'],
  ['olijf', 'olijf|olive|khaki|kaki'],
  ['groen', 'groen|green|forest|bottle green|racing green'],
  ['bordeaux', 'bordeaux|burgundy|wijnrood|wine|oxblood'],
  ['zwart', 'zwart|black'],
];

function strip(text, brand) {
  let t = ` ${text || ''} `;
  if (brand) t = t.split(brand).join(' ');
  return t.replace(/polo ralph lauren/gi, ' ');
}

const firstMatch = (rules, text) => rules.find(([, words]) => has(text, words))?.[0] || null;

export function guessPieceCategory(data) {
  return firstMatch(PIECE_RULES, strip(`${data.name || ''} ${data.category || ''} ${data.title || ''}`, data.brand));
}

export function guessWishCategory(data) {
  return firstMatch(WISH_RULES, strip(`${data.name || ''} ${data.category || ''} ${data.title || ''} ${data.brand || ''}`));
}

export function guessColor(data) {
  // Eerst de kleur die de shop zelf opgeeft, dan de naam, dan de rest.
  return firstMatch(COLOR_RULES, data.color || '')
    || firstMatch(COLOR_RULES, strip(data.name, data.brand))
    || firstMatch(COLOR_RULES, strip(data.title, data.brand));
}
