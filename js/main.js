// Point d'entrée : démarre l'interface et enregistre le service worker (mode hors-ligne).
import { boot } from './ui/app.js';
import { unlockOnFirstGesture } from './audio.js';

boot();
unlockOnFirstGesture();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* hors-ligne indisponible */ });
  });
}
