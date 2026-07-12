/**
 * Física de partículas — trayectorias de cargas en campo B (espectro / detección).
 * Pedagogía: q, m, v y radio de curvatura r = mv / |q|B.
 */

import { Vector2D } from '../utils/vector2d.js';
import { roundTo } from '../utils/math-helpers.js';
import {
  setModuleInfo,
  setModuleFormulas,
  paramControl,
  bindParamControls,
  clearChallenges
} from '../module-ui.js';

let _engine = null;
let _renderer = null;
let _ui = null;

const params = {
  B: 1.2,
  q: 1,
  m: 1,
  v0: 4,
  autoFire: true
};

/** @type {Array<{pos: Vector2D, vel: Vector2D, q: number, m: number, color: string, trail: Vector2D[], life: number}>} */
let particles = [];
let fireCooldown = 0;

const SPECIES = [
  { name: 'e⁻', q: -1, m: 0.3, color: '#4fc3f7' },
  { name: 'p⁺', q: 1, m: 1.2, color: '#ef5350' },
  { name: 'α', q: 2, m: 2.4, color: '#ffb74d' },
  { name: 'μ⁻', q: -1, m: 0.7, color: '#ce93d8' }
];

function spawn(kindIndex) {
  const sp = SPECIES[kindIndex % SPECIES.length];
  const q = params.q * Math.sign(sp.q) * Math.abs(sp.q);
  const m = Math.max(0.15, params.m * sp.m);
  particles.push({
    name: sp.name,
    pos: new Vector2D(-7.5, (Math.random() - 0.5) * 1.2),
    vel: new Vector2D(params.v0, 0),
    q,
    m,
    color: sp.color,
    trail: [],
    life: 12
  });
  while (particles.length > 12) particles.shift();
}

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;
  particles = [];
  fireCooldown = 0;
  renderer.resetCamera();

  setModuleInfo(ui, {
    title: 'Física de partículas',
    blurb: 'Cargas en un campo magnético uniforme: la trayectoria curva según q, m y v (base de muchos detectores).',
    story:
      'En cámaras de burbujas y detectores modernos, el campo B curva las trayectorias: el signo de la carga y el momento p = mv se leen del radio y el sentido del giro.',
    cases: [
      'Espectrómetro de masas: separar iones por m/q.',
      'Detectores en colisionadores (curvatura → momento).',
      'Rayos cósmicos: partículas cargadas en el campo terrestre.'
    ]
  });
  setModuleFormulas(ui, {
    items: [
      { name: 'Fuerza de Lorentz', formula: 'F = q · (v × B)', note: 'Perpendicular a v y a B; no cambia |v| (solo dirección).' },
      { name: 'Radio de Larmor', formula: 'r = m·v⊥ / |q|·B', note: 'Mayor momento o menor |q|B → curva más abierta.' },
      { name: 'Periodo ciclotrón', formula: 'T = 2π·m / |q|·B', note: 'Independiente de la velocidad (no relativista).' }
    ]
  });
  clearChallenges(ui);
  renderParams();
  spawn(0);
}

export function destroy() {
  particles = [];
  _engine = _renderer = _ui = null;
}

export function reset() {
  particles = [];
  fireCooldown = 0;
  spawn(0);
  _renderer?.resetCamera();
}

export function update(dt) {
  const B = params.B; // B en z (sale de la pantalla)

  if (params.autoFire) {
    fireCooldown -= dt;
    if (fireCooldown <= 0) {
      spawn(Math.floor(Math.random() * SPECIES.length));
      fireCooldown = 1.6;
    }
  }

  for (const p of particles) {
    // F = q v × B  →  a = (q/m) v × Bẑ  → ax = (qB/m) vy, ay = -(qB/m) vx  (2D)
    const k = (p.q * B) / p.m;
    const ax = k * p.vel.y;
    const ay = -k * p.vel.x;
    p.vel = new Vector2D(p.vel.x + ax * dt, p.vel.y + ay * dt);
    p.pos = new Vector2D(p.pos.x + p.vel.x * dt, p.pos.y + p.vel.y * dt);
    p.trail.push(p.pos.clone());
    if (p.trail.length > 80) p.trail.shift();
    p.life -= dt;
  }
  particles = particles.filter(
    (p) => p.life > 0 && Math.abs(p.pos.x) < 14 && Math.abs(p.pos.y) < 12
  );

  updateData();
}

export function render(ctx) {
  if (!_renderer) return;
  const r = _renderer;
  r.drawGrid({ spacing: 1 });

  // Región de campo B
  ctx.save();
  const a = r.worldToCanvas(-8, 6);
  const b = r.worldToCanvas(8, -6);
  ctx.fillStyle = 'rgba(79, 195, 247, 0.06)';
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.25)';
  ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.restore();
  r.drawLabel(0, 6.6, `B = ${roundTo(params.B, 2)} T (⊙ o ⊗ según convención 2D)`, {
    color: 'rgba(79,195,247,0.7)',
    fontSize: 11
  });

  for (const p of particles) {
    if (p.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < p.trail.length; i++) {
        const c = r.worldToCanvas(p.trail[i].x, p.trail[i].y);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    r.drawObject(p.pos.x, p.pos.y, {
      shape: 'circle',
      size: 0.2 + p.m * 0.05,
      color: p.color,
      label: p.name
    });
  }

  // Emisor
  r.drawObject(-8.2, 0, { shape: 'rect', size: 0.25, color: '#90a4ae', label: 'fuente', glow: false });
}

function updateData() {
  if (!_ui) return;
  const p = particles[particles.length - 1];
  const rLar =
    p && Math.abs(p.q * params.B) > 1e-6
      ? (p.m * p.vel.magnitude()) / Math.abs(p.q * params.B)
      : 0;
  _ui.setData(`
    <div class="data-grid">
      <div><span class="data-label">Partículas</span><span class="data-value">${particles.length}</span></div>
      <div><span class="data-label">B</span><span class="data-value">${roundTo(params.B, 2)} T</span></div>
      <div><span class="data-label">Última</span><span class="data-value">${p ? p.name : '—'}</span></div>
      <div><span class="data-label">r ≈</span><span class="data-value">${p ? roundTo(rLar, 2) + ' m' : '—'}</span></div>
    </div>
  `);
}

function renderParams() {
  _ui.setParams(`
    ${paramControl({ id: 'B', label: 'Campo B', min: 0.2, max: 3, step: 0.1, value: params.B, unit: 'T' })}
    ${paramControl({ id: 'v0', label: 'Velocidad inicial', min: 1, max: 8, step: 0.5, value: params.v0, unit: 'm/s' })}
    ${paramControl({ id: 'm', label: 'Factor de masa', min: 0.5, max: 2, step: 0.1, value: params.m, unit: '×' })}
    ${paramControl({ id: 'q', label: 'Factor de carga', min: 0.5, max: 2, step: 0.1, value: params.q, unit: '×' })}
    <div class="control-group">
      <label class="gate-check">
        <input type="checkbox" id="param_autoFire" ${params.autoFire ? 'checked' : ''}>
        Disparo automático
      </label>
    </div>
    <div class="btn-row" style="flex-wrap:wrap;gap:6px;margin-top:8px">
      ${SPECIES.map(
        (s, i) =>
          `<button type="button" class="ctrl-btn" data-spawn="${i}">Disparar ${s.name}</button>`
      ).join('')}
    </div>
  `);
  bindParamControls(['B', 'v0', 'm', 'q'], (id, value) => {
    params[id] = value;
    updateData();
  });
  document.getElementById('param_autoFire')?.addEventListener('change', (e) => {
    params.autoFire = e.target.checked;
  });
  document.querySelectorAll('[data-spawn]').forEach((btn) => {
    btn.addEventListener('click', () => spawn(parseInt(btn.dataset.spawn, 10)));
  });
}

export function getState() {
  return { params: { ...params } };
}
export function setState(s) {
  if (!s?.params) return;
  Object.assign(params, s.params);
  renderParams();
  updateData();
}
