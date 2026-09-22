import { renderApp } from './app.js';
import './styles/variables.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';

const root = document.getElementById('app');
if (!root) {
  throw new Error('#app tidak ditemukan di index.html');
}
renderApp(root);
