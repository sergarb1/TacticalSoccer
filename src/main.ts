import { createApp } from 'vue';
import App from './App.vue';
import './styles/main.css';

createApp(App).mount('#app');

/**
 * PWA: instalable y jugable sin conexión una vez cargada. En desarrollo
 * no se registra para no estorbar autorecargas.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch(() => {
      /* sin SW también se juega; solo se perdería el offline */
    });
  });
}
