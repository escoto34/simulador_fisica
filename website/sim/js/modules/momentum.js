/**
 * Momentum y colisiones 1D.
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
let collided = false;
let x1, x2, v1, v2;
const y = 0;

const params = {
  m1: 2,
  m2: 3,
  v1i: 4,
  v2i: -1,
  tipo: 'elastico', // elastico | inelastico | perfecto
  e: 0.5
};

function resolveCollision() {
  const m1 = params.m1;
  const m2 = params.m2;
  const u1 = v1;
  const u2 = v2;

  if (params.tipo === 'perfecto') {
    const vf = (m1 * u1 + m2 * u2) / (m1 + m2);
    v1 = vf;
    v2 = vf;
  } else if (params.tipo === 'elastico') {
    v1 = ((m1 - m2) * u1 + 2 * m2 * u2) / (m1 + m2);
    v2 = ((m2 - m1) * u2 + 2 * m1 * u1) / (m1 + m2);
  } else {
    const e = params.e;
    v1 = ((m1 - e * m2) * u1 + m2 * (1 + e) * u2) / (m1 + m2);
    v2 = ((m2 - e * m1) * u2 + m1 * (1 + e) * u1) / (m1 + m2);
  }
}

function energy() {
  return 0.5 * params.m1 * v1 * v1 + 0.5 * params.m2 * v2 * v2;
}

function momentum() {
  return params.m1 * v1 + params.m2 * v2;
}

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;
  renderer.resetCamera();
  resetState();

  setModuleInfo(ui, {
    title: 'Momentum',
    blurb: 'Momento lineal y colisiones en una dimensión.',
    story: 'La conservación del momento es central en choques y propulsión (cohetes).',
    cases: ['Bolas de billar.', 'Vagones que se acoplan.', 'Retroceso de un arma.']
  });

  setModuleFormulas(ui, { items: [
    { name: 'Momento lineal', formula: 'p = m · v' },
    { name: 'Conservación', formula: 'Σ p<sub>i</sub> = Σ p<sub>f</sub>', note: 'En un sistema aislado de fuerzas externas netas.' }
  ]});

  clearChallenges(ui);
  renderParams();
}

function resetState() {
  t = 0;
  collided = false;
  x1 = -6;
  x2 = 4;
  v1 = params.v1i;
  v2 = params.v2i;
}

export function destroy() {
  _engine = _renderer = _ui = null;
}

export function reset(engine) {
  resetState();
  engine.reset();
}

export function setTool() {}

export function update(dt) {
  t += dt;
  if (!collided) {
    x1 += v1 * dt;
    x2 += v2 * dt;
    const r1 = 0.35 + params.m1 * 0.08;
    const r2 = 0.35 + params.m2 * 0.08;
    if (x1 + r1 >= x2 - r2 && v1 > v2) {
      resolveCollision();
      collided = true;
      x1 = x2 - r1 - r2 - 0.01;
    }
  } else {
    x1 += v1 * dt;
    x2 += v2 * dt;
  }
  updateData();
}

export function render(ctx) {
  if (!_renderer) return;
  const r = _renderer;

  // riel
  const a = r.worldToCanvas(-10, y - 0.6);
  const b = r.worldToCanvas(10, y - 0.6);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();

  const s1 = 0.35 + params.m1 * 0.08;
  const s2 = 0.35 + params.m2 * 0.08;
  r.drawObject(x1, y, { shape: 'rect', size: s1, color: '#4fc3f7', label: `m1=${params.m1}` });
  r.drawObject(x2, y, { shape: 'rect', size: s2, color: '#ffb74d', label: `m2=${params.m2}` });
  r.drawVector(x1, y + s1, v1 * 0.25, 0, { color: '#66bb6a', label: `v1=${roundTo(v1, 2)}` });
  r.drawVector(x2, y + s2, v2 * 0.25, 0, { color: '#66bb6a', label: `v2=${roundTo(v2, 2)}` });

  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(collided ? 'Después del choque' : 'Antes del choque', 10, 16);
  ctx.fillText(`p total = ${roundTo(momentum(), 3)}`, 10, 34);
  ctx.fillText(`Ec = ${roundTo(energy(), 3)} J`, 10, 52);
  ctx.restore();

  // barras Ec en chart area via setChart is heavy; simple canvas bars
  const maxE = Math.max(energy(), 0.5 * params.m1 * params.v1i ** 2 + 0.5 * params.m2 * params.v2i ** 2, 1);
  const barH = (energy() / maxE) * 80;
  ctx.fillStyle = 'rgba(102,187,106,0.5)';
  ctx.fillRect(ctx.canvas.width - 40, 100 - barH, 24, barH);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px sans-serif';
  ctx.fillText('Ec', ctx.canvas.width - 38, 112);
}

function updateData() {
  _ui?.setData(`
    <div style="font-family:var(--font-mono);font-size:0.82rem;line-height:1.7">
      <div>v1 = ${roundTo(v1, 3)} m/s · v2 = ${roundTo(v2, 3)} m/s</div>
      <div>p = ${roundTo(momentum(), 3)} kg·m/s</div>
      <div>Ec = ${roundTo(energy(), 3)} J</div>
      <div>${collided ? 'Choque resuelto' : 'En aproximación'}</div>
    </div>
  `);
}

function renderParams() {
  _ui.setParams(`
    <div class="control-group">
      <label class="control-label">Tipo de choque</label>
      <select id="param_tipo" class="custom-select" style="width:100%;padding:8px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:6px">
        <option value="elastico" ${params.tipo === 'elastico' ? 'selected' : ''}>Elástico</option>
        <option value="inelastico" ${params.tipo === 'inelastico' ? 'selected' : ''}>Inelástico (e)</option>
        <option value="perfecto" ${params.tipo === 'perfecto' ? 'selected' : ''}>Perfectamente inelástico</option>
      </select>
    </div>
    <div class="control-group">
      <label class="control-label">m1 (kg)</label>
      <div class="slider-row"><input type="range" id="p_m1" class="custom-slider" min="0.5" max="10" step="0.5" value="${params.m1}"><span id="d_m1">${params.m1}</span></div>
    </div>
    <div class="control-group">
      <label class="control-label">m2 (kg)</label>
      <div class="slider-row"><input type="range" id="p_m2" class="custom-slider" min="0.5" max="10" step="0.5" value="${params.m2}"><span id="d_m2">${params.m2}</span></div>
    </div>
    <div class="control-group">
      <label class="control-label">v1 inicial</label>
      <div class="slider-row"><input type="range" id="p_v1" class="custom-slider" min="-8" max="8" step="0.5" value="${params.v1i}"><span id="d_v1">${params.v1i}</span></div>
    </div>
    <div class="control-group">
      <label class="control-label">v2 inicial</label>
      <div class="slider-row"><input type="range" id="p_v2" class="custom-slider" min="-8" max="8" step="0.5" value="${params.v2i}"><span id="d_v2">${params.v2i}</span></div>
    </div>
    <div class="control-group">
      <label class="control-label">e (inelástico)</label>
      <div class="slider-row"><input type="range" id="p_e" class="custom-slider" min="0" max="1" step="0.05" value="${params.e}"><span id="d_e">${params.e}</span></div>
    </div>
  `);
  setTimeout(() => {
    const re = () => {
      resetState();
      _engine?.reset();
    };
    document.getElementById('param_tipo')?.addEventListener('change', (e) => {
      params.tipo = e.target.value;
      re();
    });
    const bind = (id, key, disp) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        params[key] = parseFloat(el.value);
        const d = document.getElementById(disp);
        if (d) d.textContent = String(params[key]);
        re();
      });
    };
    bind('p_m1', 'm1', 'd_m1');
    bind('p_m2', 'm2', 'd_m2');
    bind('p_v1', 'v1i', 'd_v1');
    bind('p_v2', 'v2i', 'd_v2');
    bind('p_e', 'e', 'd_e');
  }, 0);
}

export function getState() {
  return { x1, x2, v1, v2, collided, t, params: { ...params } };
}
export function setState(s) {
  if (!s || typeof s !== 'object') return;
  if (s.params) Object.assign(params, s.params);
  if (s.x1 != null) x1 = s.x1;
  if (s.x2 != null) x2 = s.x2;
  if (s.v1 != null) v1 = s.v1;
  if (s.v2 != null) v2 = s.v2;
  if (typeof s.collided === 'boolean') collided = s.collided;
  if (s.t != null) t = s.t;
  renderParams();
}
