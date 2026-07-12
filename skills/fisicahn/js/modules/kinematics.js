/**
 * Cinemática — MRU / MRUV + espacio infinito.
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

export const useCharts = true;

let pos = new Vector2D(0, 0);
let vel = new Vector2D(2, 0);
let accel = new Vector2D(0, 0);
let trail = [];
const MAX_TRAIL = 200;
let isRunning = false;
let unbounded = false;
let _engine = null;
let _renderer = null;
let _ui = null;
let tSamples = [];

const params = { vx: 2, vy: 0, ax: 0, ay: 0 };

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;

  pos = new Vector2D(-8, 0);
  vel = new Vector2D(params.vx, params.vy);
  accel = new Vector2D(params.ax, params.ay);
  trail = [];
  tSamples = [];
  unbounded = false;
  isRunning = true;
  renderer.resetCamera();
  ui.showCharts?.(true);

  setModuleInfo(ui, {
    title: 'Cinemática',
    blurb: 'Movimiento rectilíneo uniforme (MRU) y uniformemente variado (MRUV) en el plano.',
    story:
      'Galileo estudió la caída de cuerpos y el movimiento en planos inclinados; Newton unificó estas ideas en leyes del movimiento. Hoy la cinemática describe trayectorias en vehículos, satélites y animaciones.',
    cases: [
      'Un auto en carretera a velocidad casi constante (MRU).',
      'Un avión acelerando en la pista de despegue (MRUV).',
      'Un cohete que sube y luego cae (a y v en direcciones distintas).'
    ]
  });

  setModuleFormulas(ui, {
    title: 'Ecuaciones del movimiento',
    items: [
      {
        name: 'MRU (velocidad constante)',
        formula: 'x = x<sub>0</sub> + v · t',
        note: 'La posición cambia de forma proporcional al tiempo.'
      },
      {
        name: 'MRUV (aceleración constante)',
        formula: 'x = x<sub>0</sub> + v<sub>0</sub>·t + ½·a·t²',
        note: 'La velocidad también cambia: v = v<sub>0</sub> + a·t'
      },
      {
        name: 'Velocidad media',
        formula: 'v<sub>med</sub> = Δx / Δt',
        note: 'Desplazamiento sobre el intervalo de tiempo.'
      }
    ]
  });
  clearChallenges(ui);
  ui.setData('<p class="tab-text">Los datos aparecerán al iniciar la simulación.</p>');
  renderParams();
}

export function destroy() {
  isRunning = false;
  if (_renderer) _renderer.resetCamera();
  _engine = _renderer = _ui = null;
}

export function reset(engine, renderer) {
  pos = new Vector2D(-8, 0);
  vel = new Vector2D(params.vx, params.vy);
  accel = new Vector2D(params.ax, params.ay);
  trail = [];
  tSamples = [];
  if (renderer) {
    if (unbounded) renderer.follow(pos.x, pos.y);
    else renderer.resetCamera();
  }
  engine?.reset?.();
}

export function setTool(toolId) {
  if (toolId === 'unbounded') setUnbounded(!unbounded);
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

export function getUnbounded() {
  return unbounded;
}

export function getState() {
  return {
    pos: { x: pos.x, y: pos.y },
    vel: { x: vel.x, y: vel.y },
    accel: { x: accel.x, y: accel.y },
    unbounded,
    params: { ...params }
  };
}

export function setState(s) {
  if (!s || typeof s !== 'object') return;
  if (s.params) Object.assign(params, s.params);
  if (s.pos) pos = new Vector2D(s.pos.x, s.pos.y);
  if (s.vel) vel = new Vector2D(s.vel.x, s.vel.y);
  if (s.accel) accel = new Vector2D(s.accel.x, s.accel.y);
  if (typeof s.unbounded === 'boolean') setUnbounded(s.unbounded);
  trail = [];
  tSamples = [];
  if (typeof renderParams === 'function') {
    try {
      renderParams();
    } catch {
      /* ignore */
    }
  }
}

export function update(dt) {
  if (!isRunning) return;
  vel = vel.add(accel.scale(dt));
  pos = pos.add(vel.scale(dt));
  trail.push(pos.clone());
  if (trail.length > MAX_TRAIL) trail.shift();
  tSamples.push({ t: (_engine?._elapsed ?? tSamples.length * dt), x: pos.x, y: pos.y, v: vel.magnitude() });
  if (tSamples.length > 120) tSamples.shift();

  if (!unbounded) {
    if (pos.x > 9.5) {
      pos.x = 9.5;
      vel.x *= -1;
    }
    if (pos.x < -9.5) {
      pos.x = -9.5;
      vel.x *= -1;
    }
    if (pos.y > 7) {
      pos.y = 7;
      vel.y *= -1;
    }
    if (pos.y < -7) {
      pos.y = -7;
      vel.y *= -1;
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
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.25)';
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
  r.drawObject(pos.x, pos.y, {
    shape: 'circle',
    size: 0.4,
    color: '#4fc3f7',
    label: `t = ${roundTo(elapsed, 2)} s`
  });
  if (vel.magnitude() > 0.01) {
    r.drawVector(pos.x, pos.y, vel.x * 0.3, vel.y * 0.3, {
      color: '#66bb6a',
      label: `v = ${roundTo(vel.magnitude(), 2)} m/s`
    });
  }
  if (accel.magnitude() > 0.01) {
    r.drawVector(pos.x, pos.y, accel.x * 0.5, accel.y * 0.5, {
      color: '#ef5350',
      label: `a = ${roundTo(accel.magnitude(), 2)} m/s²`
    });
  }
}

function updateData() {
  if (!_ui) return;
  _ui.setData(`
    <div class="data-grid">
      <div>x = <strong>${roundTo(pos.x, 2)}</strong> m</div>
      <div>y = <strong>${roundTo(pos.y, 2)}</strong> m</div>
      <div>v<sub>x</sub> = <strong>${roundTo(vel.x, 2)}</strong> m/s</div>
      <div>v<sub>y</sub> = <strong>${roundTo(vel.y, 2)}</strong> m/s</div>
      <div>|v| = <strong>${roundTo(vel.magnitude(), 2)}</strong> m/s</div>
      <div>a<sub>x</sub> = <strong>${roundTo(accel.x, 2)}</strong> m/s²</div>
      <div>a<sub>y</sub> = <strong>${roundTo(accel.y, 2)}</strong> m/s²</div>
      <div>${unbounded ? 'Espacio infinito ON' : 'Con paredes'}</div>
    </div>
  `);
}

export function getCharts() {
  const points = tSamples.map((s) => ({ x: s.t, y: s.x }));
  if (points.length < 2) {
    return { title: 'x (m) frente al tiempo (s)', series: [{ label: 'x', points: [{ x: 0, y: pos.x }, { x: 1, y: pos.x }] }] };
  }
  return {
    title: 'x (m) frente al tiempo (s)',
    series: [{ label: 'x', points }]
  };
}

function renderParams() {
  if (!_ui) return;
  _ui.setParams(`
    <div class="control-group">
      <button type="button" class="ctrl-btn unbounded-btn" id="param_unbounded" aria-pressed="false">
        Espacio infinito: OFF
      </button>
    </div>
    ${paramControl({ id: 'vx', label: 'Velocidad X', min: -5, max: 5, step: 0.1, value: params.vx, unit: 'm/s' })}
    ${paramControl({ id: 'vy', label: 'Velocidad Y', min: -5, max: 5, step: 0.1, value: params.vy, unit: 'm/s' })}
    ${paramControl({ id: 'ax', label: 'Aceleración X', min: -2, max: 2, step: 0.1, value: params.ax, unit: 'm/s²' })}
    ${paramControl({ id: 'ay', label: 'Aceleración Y', min: -2, max: 2, step: 0.1, value: params.ay, unit: 'm/s²' })}
  `);
  setTimeout(() => {
    document.getElementById('param_unbounded')?.addEventListener('click', () => setUnbounded(!unbounded));
    bindParamControls(['vx', 'vy', 'ax', 'ay'], (id, val) => {
      params[id] = val;
      reset(_engine, _renderer);
    });
  }, 0);
}
