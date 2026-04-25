/**
 * Loader that injects the DGG uploader userscript into the chat-gui dev build
 * and wires up native hovercards. Runs after chat is initialized so
 * window.chat is available.
 */
import { setupHovercards } from './chat/js/hovercards.js';
import './chat/css/hovercards.scss';

const USERSCRIPT_URL = '/userscript/dgg-image-uploader.user.js';

function injectScript() {
  const script = document.createElement('script');
  script.src = USERSCRIPT_URL;
  script.onload = () => console.log("[rooyal's tweaks] userscript injected");
  script.onerror = () =>
    console.error(
      `[rooyal's tweaks] Failed to load userscript from ${USERSCRIPT_URL}`,
    );
  document.body.appendChild(script);
}

const check = setInterval(() => {
  if (window.chat) {
    clearInterval(check);
    setupHovercards();
    setTimeout(injectScript, 500);
  }
}, 200);
