/**
 * Movimiento armónico simple — resorte.
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
const params = {
  A: 4,
  omega: 1.2,
  phi: 0,
  m: 1
};

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;
  t = 0;
  renderer.resetCamera();
  ui.setInfo('<strong>Movimiento oscilatorio</strong> — MHS en un resorte: x = A cos(ωt + φ).');
  setModuleFormulas(ui, { items: [
    { name: 'Ley de Hooke', formula: 'F = −k · x' },
    { name: 'Pulsación angular', formula: 'ω = √(k/m)', note: 'T = 2π/ω' },
    { name: 'Posición', formula: 'x = A · cos(ωt + φ)' }
  ]});

  clearChallenges(ui);
  renderParams();
}

export function destroy() {
  _engine = _renderer = _ui = null;
}
export function reset(engine) {
  t = 0;
  engine.reset();
}
export function setTool() {}

export function update(dt) {
  t += dt;
  const x = params.A * Math.cos(params.omega * t + params.phi);
  const v = -params.A * params.omega * Math.sin(params.omega * t + params.phi);
  const k = params.m * params.omega * params.omega;
  const Ec = 0.5 * params.m * v * v;
  const Ep = 0.5 * k * x * x;
  _ui?.setData(`
    <div style="font-family:var(--font-mono);font-size:0.82rem;line-height:1.7">
      <div>x = ${roundTo(x, 3)} m</div>
      <div>v = ${roundTo(v, 3)} m/s</div>
      <div>Ec = ${roundTo(Ec, 3)} J · Ep = ${roundTo(Ep, 3)} J</div>
      <div>Em = ${roundTo(Ec + Ep, 3)} J</div>
      <div>T = ${roundTo((2 * Math.PI) / params.omega, 3)} s</div>
    </div>
  `);
}

export function render(ctx) {
  if (!_renderer) return;
  const r = _renderer;
  const x = params.A * Math.cos(params.omega * t + params.phi);
  const wall = -8;
  // resorte
  const a = r.worldToCanvas(wall, 0);
  const b = r.worldToCanvas(x - 0.5, 0);
  ctx.save();
  ctx.strokeStyle = '#9aa8b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const coils = 12;
  for (let i = 0; i <= coils; i++) {
    const u = i / coils;
    const px = a.x + (b.x - a.x) * u;
    const py = a.y + (i % 2 === 0 ? -10 : 10);
    if (i === 0) ctx.moveTo(px, a.y);
    else ctx.lineTo(px, py);
  }
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();

  r.drawObject(wall, 0, { shape: 'rect', size: 0.4, color: '#555' });
  r.drawObject(x, 0, { shape: 'circle', size: 0.55, color: '#4fc3f7', label: 'm' });
  // equilibrio
  const eq = r.worldToCanvas(0, 0);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,183,77,0.4)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(eq.x, 0);
  ctx.lineTo(eq.x, ctx.canvas.height);
  ctx.stroke();
  ctx.restore();
}

function renderParams() {
  _ui.setParams(`
    <div class="control-group"><label class="control-label">Amplitud A (m)</label>
      <div class="slider-row"><input type="range" id="o_A" class="custom-slider" min="0.5" max="7" step="0.1" value="${params.A}"><span id="od_A">${params.A}</span></div></div>
    <div class="control-group"><label class="control-label">ω (rad/s)</label>
      <div class="slider-row"><input type="range" id="o_w" class="custom-slider" min="0.3" max="4" step="0.1" value="${params.omega}"><span id="od_w">${params.omega}</span></div></div>
    <div class="control-group"><label class="control-label">φ (rad)</label>
      <div class="slider-row"><input type="range" id="o_p" class="custom-slider" min="0" max="6.28" step="0.1" value="${params.phi}"><span id="od_p">${params.phi}</span></div></div>
  `);
  setTimeout(() => {
    const bind = (id, key, d) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        params[key] = parseFloat(el.value);
        const disp = document.getElementById(d);
        if (disp) disp.textContent = String(params[key]);
        t = 0;
        _engine?.reset();
      });
    };
    bind('o_A', 'A', 'od_A');
    bind('o_w', 'omega', 'od_w');
    bind('o_p', 'phi', 'od_p');
  }, 0);
}

export function getState() {
  return { t, params: { ...params } };
}
export function setState(s) {
  if (!s || typeof s !== 'object') return;
  if (s.params) Object.assign(params, s.params);
  if (s.t != null) t = s.t;
  renderParams();
}
