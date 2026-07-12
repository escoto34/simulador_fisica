/**
 * Física atómica — modelo de Bohr simplificado (órbitas y saltos de nivel).
 */

import { roundTo } from '../utils/math-helpers.js';
import {
  setModuleInfo,
  setModuleFormulas,
  paramControl,
  bindParamControls,
  clearChallenges
} from '../module-ui.js';

/** Constante de Rydberg (aprox. eV para H) vía E_n = -13.6 / n² */
const RYDBERG_EV = 13.6;

let _engine = null;
let _renderer = null;
let _ui = null;

const params = {
  n: 2,
  Z: 1,
  showPhoton: true
};

let electronAngle = 0;
let flashT = 0;
let lastN = 2;
let photon = null; // { t, lambdaNm, outward }

function energyEv(n, Z = 1) {
  return (-RYDBERG_EV * Z * Z) / (n * n);
}

function radiusWorld(n) {
  // Escala pedagógica (no literal a0)
  return 0.55 * n * n;
}

function wavelengthFromDeltaE(deEv) {
  // λ (nm) ≈ 1240 / E(eV)
  const e = Math.abs(deEv);
  if (e < 1e-6) return null;
  return 1240 / e;
}

function colorFromWavelength(nm) {
  if (nm == null) return '#ce93d8';
  if (nm < 380) return '#7e57c2'; // UV
  if (nm < 450) return '#5c6bc0';
  if (nm < 495) return '#26c6da';
  if (nm < 570) return '#66bb6a';
  if (nm < 590) return '#ffee58';
  if (nm < 620) return '#ffb74d';
  if (nm < 750) return '#ef5350';
  return '#ef9a9a'; // IR
}

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;
  electronAngle = 0;
  flashT = 0;
  photon = null;
  lastN = params.n;
  renderer.resetCamera();

  setModuleInfo(ui, {
    title: 'Física atómica',
    blurb: 'Modelo de Bohr: el electrón en órbitas cuantizadas; al cambiar de nivel emite o absorbe un fotón.',
    story:
      'En 1913 Niels Bohr propuso que el electrón del hidrógeno solo puede ocupar órbitas con momento angular cuantizado. Explica las líneas espectrales del hidrógeno.',
    cases: [
      'Lámparas de vapor de sodio / mercurio (emisión en longitudes fijas).',
      'Espectro de absorción en la atmósfera solar (líneas de Fraunhofer).',
      'Láseres: transición entre niveles de energía definidos.'
    ]
  });
  setModuleFormulas(ui, {
    items: [
      { name: 'Energía del nivel', formula: 'E<sub>n</sub> = −13,6 · Z² / n²  eV', note: 'n = 1, 2, 3… número cuántico principal.' },
      { name: 'Fotón', formula: 'ΔE = |E<sub>f</sub> − E<sub>i</sub>| = h·f = hc/λ', note: 'Emisión si baja de nivel; absorción si sube.' },
      { name: 'Radio de Bohr (pedagógico)', formula: 'r<sub>n</sub> ∝ n²', note: 'Escala visual en la simulación (no a escala real).' }
    ]
  });
  clearChallenges(ui);
  renderParams();
  updateData();
}

export function destroy() {
  _engine = _renderer = _ui = null;
}

export function reset() {
  electronAngle = 0;
  flashT = 0;
  photon = null;
  lastN = params.n;
  _renderer?.resetCamera();
}

export function update(dt) {
  const n = Math.max(1, Math.min(6, Math.round(params.n)));
  params.n = n;
  // Periodo visual más rápido en órbitas internas
  const omega = 1.2 / n;
  electronAngle += omega * dt * 2 * Math.PI;

  if (n !== lastN) {
    const e0 = energyEv(lastN, params.Z);
    const e1 = energyEv(n, params.Z);
    const de = e1 - e0;
    const lambda = wavelengthFromDeltaE(de);
    flashT = 0.45;
    if (params.showPhoton && lambda) {
      photon = {
        t: 0,
        life: 1.2,
        lambdaNm: lambda,
        outward: de < 0, // emisión
        color: colorFromWavelength(lambda)
      };
    }
    lastN = n;
  }

  if (flashT > 0) flashT -= dt;
  if (photon) {
    photon.t += dt;
    if (photon.t > photon.life) photon = null;
  }

  updateData();
}

export function render(ctx) {
  if (!_renderer) return;
  const r = _renderer;
  r.drawGrid({ spacing: 1 });

  const Z = params.Z;
  const nMax = 6;

  // Órbitas
  for (let n = 1; n <= nMax; n++) {
    const rad = radiusWorld(n);
    const active = n === params.n;
    ctx.save();
    const c0 = r.worldToCanvas(0, 0);
    const c1 = r.worldToCanvas(rad, 0);
    const pxR = Math.abs(c1.x - c0.x);
    ctx.beginPath();
    ctx.arc(c0.x, c0.y, pxR, 0, Math.PI * 2);
    ctx.strokeStyle = active ? 'rgba(79,195,247,0.85)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.setLineDash(active ? [] : [4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    r.drawLabel(rad * 0.72, rad * 0.72, `n=${n}`, {
      color: active ? '#4fc3f7' : 'rgba(255,255,255,0.35)',
      fontSize: 11
    });
  }

  // Núcleo
  r.drawObject(0, 0, {
    shape: 'circle',
    size: 0.28 + 0.06 * Z,
    color: '#ff8a65',
    label: Z === 1 ? 'p⁺' : `Z=${Z}`
  });

  // Electrón
  const re = radiusWorld(params.n);
  const ex = re * Math.cos(electronAngle);
  const ey = re * Math.sin(electronAngle);
  r.drawObject(ex, ey, {
    shape: 'circle',
    size: 0.22,
    color: '#4fc3f7',
    label: 'e⁻'
  });

  // Fotón
  if (photon) {
    const k = photon.t / photon.life;
    const dir = photon.outward ? 1 : -1;
    const pr = re + dir * k * 3.5;
    const px = pr * Math.cos(electronAngle + 0.4);
    const py = pr * Math.sin(electronAngle + 0.4);
    r.drawObject(px, py, {
      shape: 'circle',
      size: 0.16,
      color: photon.color,
      label: photon.outward ? 'γ emitido' : 'γ absorbido',
      glow: true
    });
  }

  if (flashT > 0) {
    const a = Math.min(1, flashT / 0.45) * 0.25;
    const c0 = r.worldToCanvas(0, 0);
    ctx.save();
    ctx.fillStyle = `rgba(255,235,59,${a})`;
    ctx.beginPath();
    ctx.arc(c0.x, c0.y, 40 + (0.45 - flashT) * 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // HUD
  const e = energyEv(params.n, params.Z);
  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  [
    `n = ${params.n}`,
    `E_n = ${roundTo(e, 2)} eV`,
    photon ? `λ ≈ ${roundTo(photon.lambdaNm, 0)} nm` : 'Cambia n para ver un fotón'
  ].forEach((line, i) => ctx.fillText(line, 10, 10 + i * 18));
  ctx.restore();
}

function updateData() {
  if (!_ui) return;
  const e = energyEv(params.n, params.Z);
  _ui.setData(`
    <div class="data-grid">
      <div><span class="data-label">Nivel n</span><span class="data-value">${params.n}</span></div>
      <div><span class="data-label">Z</span><span class="data-value">${params.Z}</span></div>
      <div><span class="data-label">E<sub>n</sub></span><span class="data-value">${roundTo(e, 3)} eV</span></div>
      <div><span class="data-label">r (visual)</span><span class="data-value">∝ n² = ${params.n * params.n}</span></div>
    </div>
  `);
}

function renderParams() {
  _ui.setParams(`
    ${paramControl({ id: 'n', label: 'Nivel n', min: 1, max: 6, step: 1, value: params.n, unit: '' })}
    ${paramControl({ id: 'Z', label: 'Z (carga nuclear)', min: 1, max: 3, step: 1, value: params.Z, unit: '' })}
    <div class="control-group">
      <label class="gate-check">
        <input type="checkbox" id="param_showPhoton" ${params.showPhoton ? 'checked' : ''}>
        Mostrar fotón en saltos de nivel
      </label>
    </div>
    <p class="tab-text" style="margin-top:8px;opacity:.8">Sube o baja <strong>n</strong> para emitir (bajar) o absorber (subir) un fotón.</p>
  `);
  bindParamControls(['n', 'Z'], (id, value) => {
    params[id] = Math.round(value);
    updateData();
  });
  document.getElementById('param_showPhoton')?.addEventListener('change', (e) => {
    params.showPhoton = e.target.checked;
  });
}

export function getState() {
  return { params: { ...params }, electronAngle, lastN };
}
export function setState(s) {
  if (!s || typeof s !== 'object') return;
  if (s.params) {
    Object.assign(params, s.params);
    params.n = Math.round(params.n);
    params.Z = Math.round(params.Z);
  }
  if (s.electronAngle != null) electronAngle = s.electronAngle;
  if (s.lastN != null) lastN = s.lastN;
  else lastN = params.n;
  renderParams();
  updateData();
}
