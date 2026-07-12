/**
 * @fileoverview Módulo de Óptica — Reflexión y refracción de la luz.
 */

import { Vector2D } from '../utils/vector2d.js';
import {
  setModuleInfo,
  setModuleFormulas,
  paramControl,
  bindParamControls,
  clearChallenges
} from '../module-ui.js';
import { toRad, roundTo } from '../utils/math-helpers.js';

let isRunning = false;
let _engine = null;
let _renderer = null;
let _ui = null;

const params = {
  angle: 45,
  n1: 1.0,
  n2: 1.5
};

let rayOrigin = new Vector2D(-6, 0);
let rayDir = new Vector2D(1, 0);

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;

  isRunning = true;
  updateRay();

  setModuleInfo(ui, {
    title: 'Óptica',
    blurb: 'Luz al cambiar de medio: reflexión, refracción y ángulo crítico.',
    story: 'Snell formuló la refracción; las lentes de Galileo y Newton impulsaron la astronomía y la microscopia.',
    cases: [
      'Espejo plano del baño.',
      'Lápiz “roto” en un vaso con agua.',
      'Fibra óptica y reflexión total interna.'
    ]
  });
  setModuleFormulas(ui, {
    items: [
      { name: 'Reflexión', formula: 'θ<sub>i</sub> = θ<sub>r</sub>' },
      { name: 'Ley de Snell', formula: 'n₁ · sen θ₁ = n₂ · sen θ₂' },
      { name: 'Ángulo crítico', formula: 'θ<sub>c</sub> = arcsen(n₂ / n₁)', note: 'Solo si n₁ > n₂ (hacia un medio menos denso).' }
    ]
  });
  ui.setData('<p class="tab-text">Ajusta los parámetros para ver los datos.</p>');
  clearChallenges(ui);

  renderParams();
}

export function destroy() {
  isRunning = false;
  _engine = _renderer = _ui = null;
}

export function reset(engine, renderer, ui) {
  updateRay();
  engine.reset();
}

export function setTool(toolId) {}

function updateRay() {
  rayOrigin = new Vector2D(-6, 0);
  const rad = toRad(params.angle);
  rayDir = Vector2D.fromAngle(rad, 1);
}

export function update(dt) {
  if (!isRunning) return;
}

export function render(ctx, alpha, elapsed) {
  if (!_renderer) return;
  const r = _renderer;

  const w = r.canvas.width;
  const h = r.canvas.height;

  // Línea de interfaz (eje Y = 0)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  const interfaceP = r.worldToCanvas(0, 0);
  ctx.beginPath();
  ctx.moveTo(0, interfaceP.y);
  ctx.lineTo(w, interfaceP.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Etiqueta de medios
  ctx.font = '13px ' + (getComputedStyle(r.canvas).fontFamily || 'sans-serif');
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.textAlign = 'center';
  const labelN1 = r.worldToCanvas(5, 4);
  ctx.fillText(`n₁ = ${params.n1}`, labelN1.x, labelN1.y);
  const labelN2 = r.worldToCanvas(5, -4);
  ctx.fillText(`n₂ = ${params.n2}`, labelN2.x, labelN2.y);

  // Rayo incidente
  const angleRad = toRad(params.angle);
  const endX = rayOrigin.x + 6 * Math.cos(angleRad);
  const endY = rayOrigin.y + 6 * Math.sin(angleRad);

  // Encontrar intersección con interfaz (y=0)
  const tHit = -rayOrigin.y / (endY - rayOrigin.y);
  const hitX = rayOrigin.x + tHit * (endX - rayOrigin.x);
  const hitPoint = new Vector2D(hitX, 0);

  // Rayo incidente
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  const p1 = r.worldToCanvas(rayOrigin.x, rayOrigin.y);
  const pHit = r.worldToCanvas(hitPoint.x, hitPoint.y);
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(pHit.x, pHit.y);
  ctx.stroke();

  // Ángulo incidente
  ctx.strokeStyle = '#ffb74d';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  const arcR = 30;
  ctx.arc(pHit.x, pHit.y, arcR, -Math.PI / 2, -Math.PI / 2 + angleRad);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffb74d';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  const labelPos = r.worldToCanvas(hitPoint.x + 0.8, hitPoint.y + 0.5);
  ctx.fillText(`θ₁ = ${params.angle}°`, labelPos.x, labelPos.y);

  // Calcular rayo refractado (Ley de Snell)
  const sinTheta2 = (params.n1 / params.n2) * Math.sin(angleRad);
  let refracted = null;
  let reflectedAngle = -angleRad;
  let showReflection = true;

  if (sinTheta2 <= 1) {
    const theta2 = Math.asin(sinTheta2);
    refracted = new Vector2D(
      hitPoint.x - 6 * Math.cos(Math.PI - theta2),
      hitPoint.y - 6 * Math.sin(Math.PI - theta2)
    );

    // Rayo refractado
    ctx.strokeStyle = '#66bb6a';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    const pRefr = r.worldToCanvas(refracted.x, refracted.y);
    ctx.moveTo(pHit.x, pHit.y);
    ctx.lineTo(pRefr.x, pRefr.y);
    ctx.stroke();

    // Etiqueta ángulo refractado
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#66bb6a';
    ctx.beginPath();
    ctx.arc(pHit.x, pHit.y, arcR, Math.PI / 2, Math.PI / 2 + (Math.PI - theta2));
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#66bb6a';
    const labelPos2 = r.worldToCanvas(hitPoint.x - 0.8, hitPoint.y - 0.5);
    ctx.fillText(`θ₂ = ${roundTo(toDeg(theta2), 1)}°`, labelPos2.x, labelPos2.y);
  } else {
    // Reflexión total interna
    ctx.fillStyle = '#ef5350';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    const warnPos = r.worldToCanvas(0, -2);
    ctx.fillText('⚡ Reflexión total interna', warnPos.x, warnPos.y);
  }

  // Rayo reflejado
  if (showReflection) {
    const refStart = hitPoint.clone();
    const refEnd = new Vector2D(
      hitPoint.x + 6 * Math.cos(reflectedAngle),
      hitPoint.y + 6 * Math.sin(reflectedAngle)
    );

    ctx.strokeStyle = '#ffb74d';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const pRefl = r.worldToCanvas(refEnd.x, refEnd.y);
    ctx.moveTo(pHit.x, pHit.y);
    ctx.lineTo(pRefl.x, pRefl.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  // Info
  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`θ₁ = ${params.angle}°`, 10, 10);
  ctx.fillText(`n₁ = ${params.n1}`, 10, 28);
  ctx.fillText(`n₂ = ${params.n2}`, 10, 46);
  ctx.restore();
}

function renderParams() {
  if (!_ui) return;
  _ui.setParams(`
    <div class="control-group">
      <label class="control-label">Ángulo de incidencia (°)</label>
      <input type="range" class="custom-slider" id="param_angle" min="0" max="89" step="1" value="${params.angle}">
      <span class="slider-value" style="display:inline-block;width:auto">${params.angle}°</span>
    </div>
    <div class="control-group">
      <label class="control-label">Índice de refracción n₁</label>
      <input type="range" class="custom-slider" id="param_n1" min="1" max="2.5" step="0.05" value="${params.n1}">
      <span class="slider-value" style="display:inline-block;width:auto">${params.n1}</span>
    </div>
    <div class="control-group">
      <label class="control-label">Índice de refracción n₂</label>
      <input type="range" class="custom-slider" id="param_n2" min="1" max="2.5" step="0.05" value="${params.n2}">
      <span class="slider-value" style="display:inline-block;width:auto">${params.n2}</span>
    </div>
  `);

  setTimeout(() => {
    ['angle', 'n1', 'n2'].forEach(id => {
      const el = document.getElementById(`param_${id}`);
      if (!el) return;
      const display = el.nextElementSibling;
      el.addEventListener('input', () => {
        params[id] = parseFloat(el.value);
        if (display) display.textContent = params[id] + (id === 'angle' ? '°' : '');
        updateRay();
      });
    });
  }, 50);
}

export function getState() {
  return { params: { ...params } };
}
export function setState(s) {
  if (!s?.params) return;
  Object.assign(params, s.params);
  if (typeof renderParams === 'function') renderParams();
}
