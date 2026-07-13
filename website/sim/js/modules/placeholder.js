import { clearChallenges, setModuleInfo, setModuleFormulas } from '../module-ui.js';
/**
 * Módulo placeholder para entradas del catálogo aún sin simulación dedicada.
 */

let title = 'Próximamente';
let blurb = '';
let t = 0;

export function init(engine, renderer, ui, meta = {}) {
  title = meta.title || title;
  blurb = meta.blurb || '';
  t = 0;

  ui.setParams(`
    <p class="placeholder-text">Esta simulación está en el catálogo pero aún no tiene motor propio.</p>
    <p class="placeholder-text" style="margin-top:8px;opacity:.8">Mientras tanto puedes explorar módulos marcados como <strong>Disponible</strong> en el catálogo.</p>
  `);
  ui.setChart('<text x="150" y="90" text-anchor="middle" fill="var(--text-secondary)" font-size="11">Sin gráfica</text>');
  ui.setInfo(`<strong>${title}</strong><br>${blurb}<br><br>Estado: <em>próximamente</em>.`);
  ui.setFormulas('<p class="tab-text placeholder-text">Fórmulas cuando la simulación esté implementada.</p>');
  ui.setData('<p class="tab-text placeholder-text">Sin datos en vivo.</p>');
  clearChallenges(ui);
}

export function update(dt) {
  t += dt;
}

export function render(ctx) {
  // Usar coordenadas CSS (el motor ya aplicó setTransform(dpr))
  const canvas = ctx.canvas;
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const w = canvas.clientWidth || canvas.width / dpr || 320;
  const h = canvas.clientHeight || canvas.height / dpr || 240;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 15, 20, 0.35)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#9aa8b8';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, h / 2 - 12);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#6b7a8c';
  ctx.fillText('Simulación en desarrollo', w / 2, h / 2 + 16);
  ctx.restore();
}

export function reset() {
  t = 0;
}

export function destroy() {}
