/**
 * Gravedad universal simplificada — un cuerpo central fijo + satélite.
 */

import { Vector2D } from '../utils/vector2d.js';
import {
  setModuleInfo,
  setModuleFormulas,
  paramControl,
  bindParamControls,
  clearChallenges
} from '../module-ui.js';
import { roundTo } from '../utils/math-helpers.js';

let _engine, _renderer, _ui;
let pos, vel;
let trail = [];
let unbounded = true;

const params = {
  GM: 40, // G*M central
  r0: 5,
  v0: 2.8
};

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;
  resetState();
  renderer.resetCamera();
  ui.setInfo('<strong>Gravedad universal</strong> — Órbita 2D alrededor de una masa central fija (GM).');
  setModuleFormulas(ui, { items: [
    { name: 'Gravedad (magnitud)', formula: 'F = G·m₁·m₂ / r²' },
    { name: 'Velocidad circular', formula: 'v = √(GM / r)' }
  ]});

  clearChallenges(ui);
  renderParams();
}

function resetState() {
  pos = new Vector2D(params.r0, 0);
  vel = new Vector2D(0, params.v0);
  trail = [];
}

export function destroy() {
  if (_renderer) _renderer.resetCamera();
  _engine = _renderer = _ui = null;
}
export function reset(engine, renderer) {
  resetState();
  if (renderer) renderer.resetCamera();
  engine.reset();
}
export function setTool(id) {
  if (id === 'unbounded') setUnbounded(!unbounded);
}
export function setUnbounded(on) {
  unbounded = !!on;
  const btn = document.getElementById('param_unbounded');
  if (btn) {
    btn.textContent = unbounded ? 'Espacio infinito: ON' : 'Espacio infinito: OFF';
    btn.classList.toggle('active', unbounded);
  }
  if (!unbounded) _renderer?.resetCamera();
}
export function getUnbounded() {
  return unbounded;
}

export function update(dt) {
  const r = Math.hypot(pos.x, pos.y) || 1e-6;
  const aMag = params.GM / (r * r);
  const ax = (-aMag * pos.x) / r;
  const ay = (-aMag * pos.y) / r;
  vel = vel.add(new Vector2D(ax, ay).scale(dt));
  pos = pos.add(vel.scale(dt));

  // soft bound if not unbounded
  if (!unbounded) {
    if (Math.abs(pos.x) > 12 || Math.abs(pos.y) > 9) {
      resetState();
    }
  } else if (_renderer) {
    _renderer.follow(pos.x * 0.35, pos.y * 0.35); // partial follow keeps star in view
  }

  trail.push(pos.clone());
  if (trail.length > 400) trail.shift();

  const speed = vel.magnitude();
  const E = 0.5 * speed * speed - params.GM / r;
  _ui?.setData(`
    <div style="font-family:var(--font-mono);font-size:0.82rem;line-height:1.7">
      <div>r = ${roundTo(r, 3)} m</div>
      <div>|v| = ${roundTo(speed, 3)} m/s</div>
      <div>v_circ ≈ ${roundTo(Math.sqrt(params.GM / r), 3)}</div>
      <div>E/m ≈ ${roundTo(E, 3)} (negativo = ligada)</div>
    </div>
  `);
}

export function render(ctx) {
  if (!_renderer) return;
  const r = _renderer;
  r.drawObject(0, 0, { shape: 'circle', size: 0.7, color: '#ffb74d', label: 'M' });

  if (trail.length > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(79,195,247,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const p = r.worldToCanvas(trail[i].x, trail[i].y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  r.drawObject(pos.x, pos.y, { shape: 'circle', size: 0.3, color: '#4fc3f7', label: 'm' });
  r.drawVector(pos.x, pos.y, vel.x * 0.3, vel.y * 0.3, { color: '#66bb6a', label: 'v' });
}

function renderParams() {
  _ui.setParams(`
    <div class="control-group">
      <button type="button" class="ctrl-btn unbounded-btn active" id="param_unbounded">Espacio infinito: ON</button>
    </div>
    <div class="control-group"><label class="control-label">GM</label>
      <div class="slider-row"><input type="range" id="g_GM" class="custom-slider" min="10" max="80" step="1" value="${params.GM}"><span id="gd_GM">${params.GM}</span></div></div>
    <div class="control-group"><label class="control-label">r₀</label>
      <div class="slider-row"><input type="range" id="g_r" class="custom-slider" min="2" max="9" step="0.2" value="${params.r0}"><span id="gd_r">${params.r0}</span></div></div>
    <div class="control-group"><label class="control-label">v₀ tangencial</label>
      <div class="slider-row"><input type="range" id="g_v" class="custom-slider" min="0.5" max="6" step="0.1" value="${params.v0}"><span id="gd_v">${params.v0}</span></div></div>
    <p class="placeholder-text" style="font-size:0.75rem">v_circ = √(GM/r) ≈ ${roundTo(Math.sqrt(params.GM / params.r0), 2)}</p>
  `);
  setTimeout(() => {
    document.getElementById('param_unbounded')?.addEventListener('click', () =>
      setUnbounded(!unbounded)
    );
    const bind = (id, key, d) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => {
        params[key] = parseFloat(el.value);
        const disp = document.getElementById(d);
        if (disp) disp.textContent = String(params[key]);
        resetState();
        _engine?.reset();
        renderParams();
      });
    };
    bind('g_GM', 'GM', 'gd_GM');
    bind('g_r', 'r0', 'gd_r');
    bind('g_v', 'v0', 'gd_v');
  }, 0);
}

export function getState() {
  return {
    pos: pos ? { x: pos.x, y: pos.y } : null,
    vel: vel ? { x: vel.x, y: vel.y } : null,
    unbounded,
    params: { ...params }
  };
}
export function setState(s) {
  if (!s || typeof s !== 'object') return;
  if (s.params) Object.assign(params, s.params);
  if (s.pos) pos = new Vector2D(s.pos.x, s.pos.y);
  if (s.vel) vel = new Vector2D(s.vel.x, s.vel.y);
  if (typeof s.unbounded === 'boolean') unbounded = s.unbounded;
  trail = [];
  renderParams();
}
