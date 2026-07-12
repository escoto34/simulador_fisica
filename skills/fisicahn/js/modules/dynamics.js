/**
 * @fileoverview Dinámica — F = m·a + espacio infinito.
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

let pos = new Vector2D(0, 0);
let vel = new Vector2D(0, 0);
let accel = new Vector2D(0, 0);
let force = new Vector2D(0, 0);

let trail = [];
const MAX_TRAIL = 120;
let isRunning = false;
let unbounded = false;
let _engine = null;
let _renderer = null;
let _ui = null;

const params = {
  mass: 2,
  fx: 5,
  fy: 0
};

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;

  pos = new Vector2D(-6, 0);
  vel = new Vector2D(0, 0);
  isRunning = true;
  unbounded = false;
  trail = [];
  renderer.resetCamera();
  applyForce();

  setModuleInfo(ui, {
    title: 'Dinámica',
    blurb: 'Segunda ley de Newton: la fuerza neta determina la aceleración (F = m·a).',
    story: 'Newton relacionó fuerza, masa y aceleración en el siglo XVII. Es la base del diseño de vehículos, elevadores y estructuras.',
    cases: [
      'Empujar un carrito de supermercado (más masa → menos aceleración).',
      'Frenar un camión vs una bicicleta con la misma fuerza de freno.',
      'Cohete: empuje del motor menos el peso.'
    ]
  });
  setModuleFormulas(ui, {
    items: [
      { name: 'Segunda ley', formula: 'F = m · a', note: 'Fuerza neta en newtons (N), masa en kg, a en m/s².' },
      { name: 'Aceleración', formula: 'a = F / m', note: 'A mayor masa, menor aceleración para la misma F.' },
      { name: 'Velocidad con a constante', formula: 'v = v<sub>0</sub> + a · t' }
    ]
  });
  clearChallenges(ui);
  ui.setData('<p class="tab-text">Ajusta los parámetros para ver los datos.</p>');

  renderParams();
}

export function destroy() {
  isRunning = false;
  if (_renderer) _renderer.resetCamera();
  _engine = _renderer = _ui = null;
}

export function reset(engine, renderer, ui) {
  pos = new Vector2D(-6, 0);
  vel = new Vector2D(0, 0);
  trail = [];
  applyForce();
  if (renderer) {
    if (unbounded) renderer.follow(pos.x, pos.y);
    else renderer.resetCamera();
  }
  engine.reset();
}

export function setTool(toolId) {
  if (toolId === 'unbounded') setUnbounded(!unbounded);
}

export function getState() {
  return {
    pos: { x: pos.x, y: pos.y },
    vel: { x: vel.x, y: vel.y },
    accel: { x: accel.x, y: accel.y },
    force: { x: force.x, y: force.y },
    unbounded,
    params: { ...params }
  };
}

export function setState(s) {
  if (!s || typeof s !== 'object') return;
  if (s.params) {
    if (s.params.mass != null) params.mass = s.params.mass;
    if (s.params.fx != null) params.fx = s.params.fx;
    if (s.params.fy != null) params.fy = s.params.fy;
  }
  applyForce();
  if (s.pos) pos = new Vector2D(s.pos.x, s.pos.y);
  if (s.vel) vel = new Vector2D(s.vel.x, s.vel.y);
  if (typeof s.unbounded === 'boolean') setUnbounded(s.unbounded);
  trail = [];
  renderParams();
  updateData();
}

export function setUnbounded(on) {
  unbounded = !!on;
  if (_renderer) {
    if (unbounded) _renderer.follow(pos.x, pos.y);
    else _renderer.resetCamera();
  }
  const btn = document.getElementById('param_unbounded');
  if (btn) {
    btn.setAttribute('aria-pressed', unbounded ? 'true' : 'false');
    btn.classList.toggle('active', unbounded);
    btn.textContent = unbounded ? 'Espacio infinito: ON' : 'Espacio infinito: OFF';
  }
}

function applyForce() {
  const m = params.mass;
  force = new Vector2D(params.fx, params.fy);
  accel = new Vector2D(force.x / m, force.y / m);
}

export function update(dt) {
  if (!isRunning) return;
  applyForce();
  vel = vel.add(accel.scale(dt));
  pos = pos.add(vel.scale(dt));

  trail.push(pos.clone());
  if (trail.length > MAX_TRAIL) trail.shift();

  if (!unbounded) {
    if (pos.x > 9.5) {
      pos.x = 9.5;
      vel.x *= -0.8;
    }
    if (pos.x < -9.5) {
      pos.x = -9.5;
      vel.x *= -0.8;
    }
    if (pos.y > 7) {
      pos.y = 7;
      vel.y *= -0.8;
    }
    if (pos.y < -7) {
      pos.y = -7;
      vel.y *= -0.8;
    }
  } else if (_renderer) {
    _renderer.follow(pos.x, pos.y);
  }

  updateData();
}

export function render(ctx, alpha, elapsed) {
  if (!_renderer) return;
  const r = _renderer;

  if (trail.length > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 183, 77, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const p = r.worldToCanvas(trail[i].x, trail[i].y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  const size = 0.3 + params.mass * 0.06;
  r.drawObject(pos.x, pos.y, {
    shape: 'circle',
    size: Math.min(size, 0.8),
    color: '#ffb74d',
    label: `m = ${params.mass} kg`
  });

  // Fuerza y velocidad: etiquetas en lados opuestos del vector para no solaparse
  if (force.magnitude() > 0.01) {
    r.drawVector(pos.x, pos.y, force.x * 0.15, force.y * 0.15, {
      color: '#ef5350',
      width: 2.5,
      label: `F = ${roundTo(force.magnitude(), 1)} N`,
      labelSide: 1,
      labelPad: 16
    });
  }

  if (vel.magnitude() > 0.01) {
    r.drawVector(pos.x, pos.y, vel.x * 0.2, vel.y * 0.2, {
      color: '#66bb6a',
      width: 2.5,
      label: `v = ${roundTo(vel.magnitude(), 2)} m/s`,
      labelSide: -1,
      labelPad: 16
    });
  }

  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  [
    `m = ${params.mass} kg`,
    `F = ${roundTo(force.magnitude(), 1)} N`,
    `a = ${roundTo(accel.magnitude(), 2)} m/s²`,
    `v = ${roundTo(vel.magnitude(), 2)} m/s`,
    unbounded ? 'espacio infinito' : 'con paredes'
  ].forEach((line, i) => ctx.fillText(line, 10, 10 + i * 18));
  ctx.restore();
}

function updateData() {
  if (!_ui) return;
  _ui.setData(`
    <div style="font-family:var(--font-mono);font-size:0.82rem;line-height:1.8">
      <div>m = ${params.mass} kg</div>
      <div>F<sub>x</sub> = ${params.fx} N · F<sub>y</sub> = ${params.fy} N</div>
      <div>a = ${roundTo(accel.magnitude(), 3)} m/s²</div>
      <div>v = ${roundTo(vel.magnitude(), 3)} m/s</div>
      <div>x = ${roundTo(pos.x, 2)} m · y = ${roundTo(pos.y, 2)} m</div>
    </div>
  `);
}

function renderParams() {
  if (!_ui) return;
  _ui.setParams(`
    <div class="control-group">
      <button type="button" class="ctrl-btn unbounded-btn" id="param_unbounded" aria-pressed="false">
        Espacio infinito: OFF
      </button>
    </div>
    ${paramControl({ id: 'mass', label: 'Masa', min: 0.5, max: 10, step: 0.5, value: params.mass, unit: 'kg' })}
    ${paramControl({ id: 'fx', label: 'Fuerza X', min: -20, max: 20, step: 0.5, value: params.fx, unit: 'N' })}
    ${paramControl({ id: 'fy', label: 'Fuerza Y', min: -20, max: 20, step: 0.5, value: params.fy, unit: 'N' })}
  `);

  setTimeout(() => {
    document.getElementById('param_unbounded')?.addEventListener('click', () =>
      setUnbounded(!unbounded)
    );
    bindParamControls(['mass', 'fx', 'fy'], (id, val) => {
      params[id] = val;
      applyForce();
      reset(_engine, _renderer, _ui);
    });
  }, 0);
}
