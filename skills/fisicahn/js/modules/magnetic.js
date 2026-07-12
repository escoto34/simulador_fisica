/**
 * Campos magnéticos intro — carga con velocidad en B uniforme (F = q v × B).
 * B sale de la página (+z); movimiento en plano xy.
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
  q: 1,
  m: 1,
  B: 1.2,
  v0: 3
};

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;
  resetState();
  renderer.resetCamera();
  setModuleInfo(ui, {
    title: 'Campos magnéticos',
    blurb: 'Carga en un campo B uniforme: fuerza de Lorentz y órbita circular.',
    story: 'La fuerza de Lorentz describe cómo un campo magnético desvía cargas en movimiento. Es la base de motores y espectrómetros.',
    cases: ['Haz de electrones en un tubo.', 'Partícula en un ciclotrón.', 'Iones en un espectrómetro de masa.']
  });

  setModuleFormulas(ui, { items: [
    { name: 'Fuerza (B ⊥ v)', formula: 'F = q · v · B' },
    { name: 'Radio de órbita', formula: 'r = m·v / (q·B)', note: 'Mayor B → menor radio.' }
  ]});

  clearChallenges(ui);
  renderParams();
}

function resetState() {
  pos = new Vector2D(0, 0);
  vel = new Vector2D(params.v0, 0);
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
  // F = q (v × Bẑ) = q B (vy, -vx) wait: v × z-hat = (vx,vy,0)×(0,0,1) = (vy, -vx, 0)
  // a = (q/m) B (vy, -vx)
  const k = (params.q * params.B) / params.m;
  const ax = k * vel.y;
  const ay = -k * vel.x;
  vel = vel.add(new Vector2D(ax, ay).scale(dt));
  // renorm soft to reduce numerical energy drift
  const speed = vel.magnitude();
  if (speed > 1e-6) {
    const target = params.v0;
    vel = vel.scale(target / speed);
  }
  pos = pos.add(vel.scale(dt));
  trail.push(pos.clone());
  if (trail.length > 300) trail.shift();

  if (unbounded && _renderer) _renderer.follow(pos.x, pos.y);

  const R = (params.m * params.v0) / (Math.abs(params.q * params.B) || 1e-9);
  _ui?.setData(`
    <div style="font-family:var(--font-mono);font-size:0.82rem;line-height:1.7">
      <div>q = ${params.q} · B = ${params.B} T</div>
      <div>v = ${roundTo(vel.magnitude(), 3)} m/s</div>
      <div>R ≈ ${roundTo(R, 3)} m</div>
      <div>x,y = (${roundTo(pos.x, 2)}, ${roundTo(pos.y, 2)})</div>
    </div>
  `);
}

export function render(ctx) {
  if (!_renderer) return;
  const r = _renderer;
  // símbolos B (× o ·)
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = '14px sans-serif';
  for (let i = -8; i <= 8; i += 2) {
    for (let j = -6; j <= 6; j += 2) {
      const p = r.worldToCanvas(i + r.camera.x, j + r.camera.y);
      ctx.fillText('·', p.x, p.y);
    }
  }
  ctx.restore();

  if (trail.length > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(206,147,216,0.45)';
    ctx.lineWidth = 2;
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
    size: 0.35,
    color: params.q >= 0 ? '#ef5350' : '#4fc3f7',
    label: params.q >= 0 ? '+q' : '−q'
  });
  r.drawVector(pos.x, pos.y, vel.x * 0.25, vel.y * 0.25, { color: '#66bb6a', label: 'v' });
}

function renderParams() {
  _ui.setParams(`
    <div class="control-group">
      <button type="button" class="ctrl-btn unbounded-btn active" id="param_unbounded">Espacio infinito: ON</button>
    </div>
    <div class="control-group"><label class="control-label">q (signo/magnitud)</label>
      <div class="slider-row"><input type="range" id="m_q" class="custom-slider" min="-3" max="3" step="0.5" value="${params.q}"><span id="md_q">${params.q}</span></div></div>
    <div class="control-group"><label class="control-label">B (T)</label>
      <div class="slider-row"><input type="range" id="m_B" class="custom-slider" min="0.2" max="3" step="0.1" value="${params.B}"><span id="md_B">${params.B}</span></div></div>
    <div class="control-group"><label class="control-label">v₀ (m/s)</label>
      <div class="slider-row"><input type="range" id="m_v" class="custom-slider" min="0.5" max="6" step="0.1" value="${params.v0}"><span id="md_v">${params.v0}</span></div></div>
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
      });
    };
    bind('m_q', 'q', 'md_q');
    bind('m_B', 'B', 'md_B');
    bind('m_v', 'v0', 'md_v');
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
  if (typeof s.unbounded === 'boolean') setUnbounded(s.unbounded);
  trail = [];
  renderParams();
}
