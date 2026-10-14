// Thema: 'auto' (volgt iPhone), 'light' of 'dark'.
// Opgeslagen in localStorage zodat index.html het vóór de eerste weergave kan toepassen.

const KEY = 'compose.theme';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch (e) {
    return 'auto';
  }
}

export function setTheme(theme) {
  try {
    if (theme === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch (e) { /* opslag niet beschikbaar: geldt dan alleen voor deze sessie */ }
  applyTheme(theme);
}

export function applyTheme(theme = getTheme()) {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  syncThemeColor();
}

function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  return t ? t === 'dark' : darkQuery.matches;
}

// Kleur van de statusbalk / browserbalk laten meelopen met het thema.
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark() ? '#12161E' : '#F4F0E8');
}

darkQuery.addEventListener('change', syncThemeColor);
