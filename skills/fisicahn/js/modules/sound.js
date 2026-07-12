/**
 * Sonido y efecto Doppler (fuente móvil, observador fijo).
 */

import { roundTo } from '../utils/math-helpers.js';
import {
  setModuleInfo,
  setModuleFormulas,
  paramControl,
  bindParamControls,
  clearChallenges
} from '../module-ui.js';

let _engine, _renderer, _ui;
let t = 0;
let sourceX = -8;
const waves = []; // {x, born, r}

const params = {
  tempC: 20,
  f: 2, // Hz visual (lento para ver frentes)
  vSource: 2 // m/s (+ hacia +x, acercándose al observador en x=6)
};

function soundSpeed() {
  return 331 + 0.6 * params.tempC;
}

function observedF() {
  const v = soundSpeed();
  // fuente hacia observador a la derecha: v_s > 0 reduce denominador
  const vs = params.vSource;
  const den = v - vs;
  if (Math.abs(den) < 1e-6) return Infinity;
  return params.f * v / den;
}

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;
  t = 0;
  sourceX = -8;
  waves.length = 0;
  renderer.resetCamera();
  ui.setInfo('<strong>Sonido / Doppler</strong> — Frentes de onda y frecuencia percibida con fuente en movimiento.');
  setModuleFormulas(ui, { items: [
    { name: 'Velocidad de onda', formula: 'v = f · λ' },
    { name: 'Doppler (fuente móvil)', formula: "f′ = f · v / (v ± v<sub>s</sub>)", note: 'El signo depende de si se acerca o se aleja.' }
  ]});

  clearChallenges(ui);
  renderParams();
}

export function destroy() {
  _engine = _renderer = _ui = null;
}
export function reset(engine) {
  t = 0;
  sourceX = -8;
  waves.length = 0;
  engine.reset();
}
export function setTool() {}

export function update(dt) {
  t += dt;
  sourceX += params.vSource * dt;
  if (sourceX > 12) sourceX = -10;
  if (sourceX < -12) sourceX = 10;

  const period = 1 / Math.max(params.f, 0.1);
  if (waves.length === 0 || t - waves[waves.length - 1].born >= period) {
    waves.push({ x: sourceX, born: t });
    if (waves.length > 40) waves.shift();
  }

  const v = soundSpeed();
  for (const w of waves) {
    w.r = (t - w.born) * v * 0.15; // escala visual
  }

  _ui?.setData(`
    <div style="font-family:var(--font-mono);font-size:0.82rem;line-height:1.7">
      <div>v<sub>sonido</sub> = ${roundTo(soundSpeed(), 1)} m/s</div>
      <div>f fuente = ${params.f} Hz (demo)</div>
      <div>v fuente = ${params.vSource} m/s</div>
      <div>f observada ≈ ${roundTo(observedF(), 3)} Hz</div>
    </div>
  `);
}

export function render(ctx) {
  if (!_renderer) return;
  const r = _renderer;
  const obsX = 6;

  // frentes
  ctx.save();
  for (const w of waves) {
    const c = r.worldToCanvas(w.x, 0);
    const rx = w.r * (ctx.canvas.width / r.worldWidth);
    ctx.strokeStyle = 'rgba(79,195,247,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(rx, 1), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  r.drawObject(sourceX, 0, { shape: 'triangle', size: 0.5, color: '#ef5350', label: 'fuente' });
  r.drawObject(obsX, 0, { shape: 'circle', size: 0.4, color: '#66bb6a', label: 'obs' });
}

function renderParams() {
  _ui.setParams(`
    <div class="control-group"><label class="control-label">Temperatura (°C)</label>
      <div class="slider-row"><input type="range" id="s_T" class="custom-slider" min="-10" max="40" step="1" value="${params.tempC}"><span id="sd_T">${params.tempC}</span></div></div>
    <div class="control-group"><label class="control-label">f fuente (Hz demo)</label>
      <div class="slider-row"><input type="range" id="s_f" class="custom-slider" min="0.5" max="5" step="0.1" value="${params.f}"><span id="sd_f">${params.f}</span></div></div>
    <div class="control-group"><label class="control-label">v fuente (m/s)</label>
      <div class="slider-row"><input type="range" id="s_vs" class="custom-slider" min="-6" max="6" step="0.2" value="${params.vSource}"><span id="sd_vs">${params.vSource}</span></div></div>
  `);
  setTimeout(() => {
    const bind = (id, key, d) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        params[key] = parseFloat(el.value);
        const disp = document.getElementById(d);
        if (disp) disp.textContent = String(params[key]);
      });
    };
    bind('s_T', 'tempC', 'sd_T');
    bind('s_f', 'f', 'sd_f');
    bind('s_vs', 'vSource', 'sd_vs');
  }, 0);
}

export function getState() {
  return { params: { ...params } };
}
export function setState(s) {
  if (!s?.params) return;
  Object.assign(params, s.params);
  renderParams();
}
