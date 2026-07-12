/**
 * @fileoverview App — Punto de entrada de FísicaHN.
 * Catálogo por nivel (MS / HS / Advanced) + motor de simulación.
 */

import { PhysicsEngine } from './physics-engine.js';
import { Renderer } from './renderer.js';
import { CATALOG, getById, getUnifiedCatalog, getSimulationCatalog, WORKS_MODULE } from './catalog.js';
import { getSession, logAudit } from './auth.js';
import { saveWork, listWorks, getWork, initWorksStorage } from './works.js';
import {
  bindWorksPanelControls,
  renderWorksSidebar,
  updateWorksCountBadges,
  openWorksModal
} from './works-panel.js';
import { ensureSessionGate, renderSessionBadge, renderUserChip } from './session-gate.js';
import { bindUserMenu } from './user-menu.js';
import { initNetworkStatusUI } from './network-status.js';
import { initPanelResize } from './panel-resize.js';

/* ============================================
   Estado
   ============================================ */
const state = {
  view: 'catalog', // 'catalog' | 'sim'
  catalogLevel: 'middle',
  catalogId: null,
  currentModule: null,
  moduleInstances: {},
  loaded: false
};

const STORAGE_KEY = 'fisicahn_progress';

/** Motores de simulación existentes (carpeta modules/) */
const ENGINE_PATHS = {
  kinematics: './modules/kinematics.js',
  dynamics: './modules/dynamics.js',
  electricity: './modules/electricity.js',
  optics: './modules/optics.js',
  whiteboard: './modules/whiteboard.js',
  momentum: './modules/momentum.js',
  oscillatory: './modules/oscillatory.js',
  sound: './modules/sound.js',
  magnetic: './modules/magnetic.js',
  gravity: './modules/gravity.js',
  atomic: './modules/atomic.js',
  particles: './modules/particles.js',
  placeholder: './modules/placeholder.js'
};

const ENGINE_TITLES = {
  kinematics: 'Cinemática',
  dynamics: 'Dinámica',
  electricity: 'Electricidad',
  optics: 'Óptica',
  whiteboard: 'Pizarra',
  momentum: 'Momentum',
  oscillatory: 'Oscilatorio',
  sound: 'Sonido',
  magnetic: 'Campos magnéticos',
  gravity: 'Gravedad',
  atomic: 'Física atómica',
  particles: 'Física de partículas',
  placeholder: 'Próximamente'
};

/** Herramientas de medición globales */
const measureState = {
  tool: 'pointer',
  rulerPoints: [],
  anglePoints: [],
  probe: null,
  stopwatchEl: null
};

/* ============================================
   DOM
   ============================================ */
const catalogView = document.getElementById('catalogView');
const simShell = document.getElementById('simShell');
const catalogBackBtn = document.getElementById('catalogBackBtn');
const sidebarNav = document.getElementById('sidebarNav');
const canvas = document.getElementById('simCanvas');
const fpsCounter = document.getElementById('fpsCounter');
const simStatus = document.getElementById('simStatus');
const moduleTitle = document.getElementById('moduleTitle');
const speedSlider = document.getElementById('speedSlider');
const speedDisplay = document.getElementById('speedDisplay');
const playPauseBtn = document.getElementById('playPauseBtn');
const playPauseLabel = document.getElementById('playPauseLabel');
const resetBtn = document.getElementById('resetBtn');
const stepBtn = document.getElementById('stepBtn');
const paramsPanel = document.getElementById('paramsPanel');
const chartSvg = document.getElementById('chartSvg');
const bottomTabs = document.querySelectorAll('.bottom-tab');
const bottomContent = document.getElementById('bottomContent');
const toolBtns = document.querySelectorAll('.tool-btn');

/** Motor / renderer se crean de forma segura (si fallan, el catálogo sigue usable) */
let engine = null;
let renderer = null;
try {
  if (canvas && typeof canvas.getContext === 'function') {
    engine = new PhysicsEngine(canvas);
    renderer = new Renderer(canvas, { worldWidth: 20, worldHeight: 15 });
  } else {
    console.error('FísicaHN: no se encontró #simCanvas');
  }
} catch (err) {
  console.error('FísicaHN: error al crear motor/renderer', err);
}

/* ============================================
   UI API para módulos
   ============================================ */
const chartPanel = document.getElementById('chartPanel');

const ui = {
  setParams(html) {
    if (paramsPanel) paramsPanel.innerHTML = html;
  },
  /** Muestra gráfica solo si enableCharts(true) o se pasa contenido no vacío con show=true */
  setChart(svgContent, opts = {}) {
    if (!chartSvg) return;
    const show = opts.show === true || (opts.show !== false && svgContent && !opts.hide);
    if (chartPanel) chartPanel.hidden = !show;
    if (show) chartSvg.innerHTML = svgContent;
  },
  showCharts(on) {
    if (chartPanel) chartPanel.hidden = !on;
  },
  setInfo(msg) {
    const infoPanel = document.getElementById('tab-info');
    if (infoPanel) {
      // Si ya viene marcado como bloque, no envolver
      if (String(msg).includes('module-info-block') || String(msg).includes('tab-text')) {
        infoPanel.innerHTML = msg;
      } else {
        infoPanel.innerHTML = `<p class="tab-text">${msg}</p>`;
      }
    }
  },
  setFormulas(html) {
    const panel = document.getElementById('tab-formulas');
    if (panel) panel.innerHTML = html;
  },
  setData(html) {
    const panel = document.getElementById('tab-data');
    if (panel) panel.innerHTML = html;
  },
  setChallenges() {
    /* Desafíos eliminados de la UI */
  },
  showTab(tabId) {
    if (tabId === 'challenges') tabId = 'info';
    bottomTabs.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    const panels = bottomContent.querySelectorAll('.tab-panel');
    panels.forEach((p) => p.classList.remove('active'));
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.classList.add('active');
  }
};

/* ============================================
   Catálogo UI
   ============================================ */

/** Enlaza clics de tarjetas del catálogo (estáticas o generadas). */
function bindCatalogCardClicks() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  grid.querySelectorAll('[data-catalog-id], [data-catalogId]').forEach((btn) => {
    if (btn.dataset.boundClick === '1') return;
    btn.dataset.boundClick = '1';
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-catalog-id') || btn.dataset.catalogId;
      if (id) openCatalogModule(id);
    });
  });
}

function renderCatalogGrids() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  let worksCount = 0;
  try {
    worksCount = listWorks().length;
  } catch {
    worksCount = 0;
  }

  // Si ya hay tarjetas estáticas en el HTML, solo actualiza badges y enlaza clics
  const existing = grid.querySelectorAll('.catalog-card');
  if (existing.length > 0) {
    existing.forEach((btn) => {
      const id = btn.getAttribute('data-catalog-id') || btn.dataset.catalogId;
      if (id === 'my-works' || btn.classList.contains('catalog-card-works')) {
        const badge = btn.querySelector('.catalog-badge');
        if (badge) {
          badge.textContent = worksCount ? `${worksCount} en caché` : 'Importar / ver';
          badge.className = 'catalog-badge works';
        }
      }
      // normalizar atributo
      if (id && !btn.getAttribute('data-catalog-id')) {
        btn.setAttribute('data-catalog-id', id);
      }
    });
    bindCatalogCardClicks();
    return;
  }

  grid.innerHTML = '';
  for (const mod of getUnifiedCatalog()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'catalog-card' + (mod.special === 'works' ? ' catalog-card-works' : '');
    btn.setAttribute('data-catalog-id', mod.id);
    btn.dataset.catalogId = mod.id;
    const statusLabel =
      mod.special === 'works'
        ? worksCount
          ? `${worksCount} en caché`
          : 'Importar / ver'
        : mod.status === 'ready'
          ? 'Disponible'
          : 'Pronto';
    btn.setAttribute(
      'aria-label',
      `${mod.title}. ${mod.special === 'works' ? 'Gestionar trabajos guardados e importados' : statusLabel}`
    );
    btn.innerHTML = `
      <div class="catalog-card-top">
        <div>
          <div class="catalog-card-title">${escapeHtml(mod.title)}</div>
          <div class="catalog-card-en">${escapeHtml(mod.titleEn || '')}</div>
        </div>
        <span class="catalog-badge ${mod.special === 'works' ? 'works' : mod.status}">${escapeHtml(
          statusLabel
        )}</span>
      </div>
      <p class="catalog-card-blurb">${escapeHtml(mod.blurb)}</p>
    `;
    grid.appendChild(btn);
  }
  bindCatalogCardClicks();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showCatalog() {
  state.view = 'catalog';
  catalogView.hidden = false;
  simShell.hidden = true;
  document.body.classList.add('view-catalog');
  document.body.classList.remove('view-sim');
  // Pausar simulación en segundo plano
  try {
    engine?.pause?.(true);
  } catch {
    /* ignore */
  }
  updatePlayPauseUI();
  renderCatalogGrids();
  bindCatalogCardClicks();
  saveProgress();
}

function showSimShell() {
  state.view = 'sim';
  catalogView.hidden = true;
  simShell.hidden = false;
  document.body.classList.add('view-sim');
  document.body.classList.remove('view-catalog');
}

/** Barra lateral: todos los módulos de simulación (+ acceso a trabajos). */
function fillSidebarUnified() {
  if (!sidebarNav) return;
  sidebarNav.innerHTML = '';

  // Acceso rápido a trabajos desde el lab
  const worksBtn = document.createElement('button');
  worksBtn.type = 'button';
  worksBtn.className = 'module-btn module-btn-works';
  worksBtn.dataset.catalogId = WORKS_MODULE.id;
  worksBtn.innerHTML = `<span>${escapeHtml(WORKS_MODULE.title)}</span>`;
  worksBtn.addEventListener('click', () => openWorksModal({ filter: 'saved', hub: false }));
  sidebarNav.appendChild(worksBtn);

  for (const mod of getSimulationCatalog()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'module-btn';
    btn.dataset.catalogId = mod.id;
    if (mod.id === state.catalogId) btn.classList.add('active');
    btn.innerHTML = `<span>${escapeHtml(mod.title)}</span>`;
    btn.addEventListener('click', () => openCatalogModule(mod.id));
    sidebarNav.appendChild(btn);
  }
}

/**
 * Entra a un módulo del catálogo (carga motor real o placeholder).
 * “Mis trabajos” abre el gestor sin salir del menú principal.
 */
async function openCatalogModule(catalogId) {
  const entry = getById(catalogId);
  if (!entry) return;

  // Hub Mis trabajos: import/export + evaluación + código examen online
  if (entry.special === 'works' || catalogId === WORKS_MODULE.id) {
    openWorksModal({
      hub: true,
      filter: 'all',
      onChanged: () => {
        renderCatalogGrids();
        refreshWorksList();
      }
    });
    return;
  }

  state.catalogId = catalogId;
  state.catalogLevel = entry.level || 'all';
  showSimShell();
  fillSidebarUnified();

  if (!engine || !renderer) {
    alert('No se pudo iniciar el motor de simulación. Recarga la página (Ctrl+Shift+R).');
    showCatalog();
    return;
  }

  const engineKey = entry.engineKey || 'placeholder';
  await loadEngineModule(engineKey, entry);
  saveProgress();
}

/* ============================================
   Carga de motor
   ============================================ */

async function destroyCurrentEngine() {
  const key = state.currentModule;
  if (key && state.moduleInstances[key]) {
    try {
      state.moduleInstances[key].destroy?.();
    } catch (e) {
      console.warn(`Error al destruir módulo ${key}:`, e);
    }
    delete state.moduleInstances[key];
  }
}

/**
 * @param {string} engineKey
 * @param {object|null} catalogEntry
 */
async function loadEngineModule(engineKey, catalogEntry = null) {
  await destroyCurrentEngine();

  const path = ENGINE_PATHS[engineKey] || ENGINE_PATHS.placeholder;
  const usePlaceholder = !ENGINE_PATHS[engineKey] || engineKey === 'placeholder' || !catalogEntry?.engineKey;

  const resolvedKey = usePlaceholder ? 'placeholder' : engineKey;
  state.currentModule = resolvedKey;

  const title = catalogEntry?.title || ENGINE_TITLES[resolvedKey] || resolvedKey;
  moduleTitle.textContent = title;

  document.querySelectorAll('.module-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.catalogId === state.catalogId);
  });

  paramsPanel.innerHTML = '<p class="placeholder-text">Cargando módulo...</p>';
  chartSvg.innerHTML =
    '<text x="150" y="90" text-anchor="middle" fill="var(--text-secondary)" font-size="11">Cargando...</text>';

  try {
    const mod = await import(path);
    state.moduleInstances[resolvedKey] = mod;
    engine?.reset?.();
    renderer?.resetCamera?.();
    renderer?.clearOverlays?.();
    measureState.rulerPoints = [];
    measureState.anglePoints = [];
    measureState.probe = null;
    ui.showCharts(false);
    if (typeof mod.init === 'function') {
      if (resolvedKey === 'placeholder') {
        mod.init(engine, renderer, ui, {
          title,
          blurb: catalogEntry?.blurb || ''
        });
      } else {
        mod.init(engine, renderer, ui);
      }
    }
    // Activar panel de gráficas solo si el módulo lo pide
    if (mod.useCharts === true) ui.showCharts(true);
    // Pizarra se queda pausada; resto corre
    if (resolvedKey === 'whiteboard') {
      engine?.pause?.(true);
      updatePlayPauseUI();
    } else {
      ensureRunning();
    }
  } catch (err) {
    console.error(`Error cargando motor ${resolvedKey}:`, err);
    if (paramsPanel) {
      paramsPanel.innerHTML = `<p class="placeholder-text" style="color: var(--danger)">Error al cargar ${escapeHtml(
        title
      )}. Verifica la consola.</p>`;
    }
  }
}

function ensureRunning() {
  engine?.pause?.(false);
  updatePlayPauseUI();
}

/* ============================================
   Persistencia
   ============================================ */

function saveProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data.lastCatalogId = state.catalogId;
    data.lastLevel = state.catalogLevel;
    data.lastView = state.view;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/* ============================================
   Controles
   ============================================ */

function togglePause() {
  engine?.pause?.();
  updatePlayPauseUI();
}

function updatePlayPauseUI() {
  if (!playPauseBtn || !playPauseLabel || !simStatus) return;
  const paused = engine?.isPaused?.() ?? true;
  const icon = playPauseBtn.querySelector('svg');
  playPauseLabel.textContent = paused ? 'Reproducir' : 'Pausa';
  simStatus.textContent = paused ? 'Pausado' : 'En ejecución';
  if (!icon) return;
  if (paused) {
    icon.innerHTML = '<polygon points="6 4 20 12 6 20"/>';
  } else {
    icon.innerHTML =
      '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
  }
}

speedSlider?.addEventListener('input', () => {
  const val = parseFloat(speedSlider.value);
  if (speedDisplay) speedDisplay.textContent = val.toFixed(1) + '×';
  engine?.setSpeed?.(val);
});

playPauseBtn?.addEventListener('click', togglePause);

resetBtn?.addEventListener('click', () => {
  engine?.reset?.();
  const inst = state.moduleInstances[state.currentModule];
  if (inst && typeof inst.reset === 'function') {
    inst.reset(engine, renderer, ui);
  }
});

stepBtn?.addEventListener('click', () => {
  if (engine && !engine.isPaused()) engine.pause();
  engine?.step?.();
  updatePlayPauseUI();
});

document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.body.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

document.getElementById('settingsBtn')?.addEventListener('click', () => {
  ui.showTab('info');
  ui.setInfo('Configuración global próximamente. Usa el catálogo para cambiar de módulo.');
});

catalogBackBtn?.addEventListener('click', () => {
  showCatalog();
});

bottomTabs.forEach((btn) => {
  btn.addEventListener('click', () => ui.showTab(btn.dataset.tab));
});

toolBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool || 'pointer';
    if (tool === 'unbounded') {
      const inst = state.moduleInstances[state.currentModule];
      if (inst && typeof inst.setUnbounded === 'function') {
        inst.setUnbounded(!inst.getUnbounded?.());
      } else if (inst && typeof inst.setTool === 'function') {
        inst.setTool('unbounded');
      }
      return;
    }
    if (tool === 'stopwatch') {
      toggleStopwatchPanel();
      return;
    }
    if (tool === 'erase') {
      measureState.rulerPoints = [];
      measureState.anglePoints = [];
      measureState.probe = null;
      renderer.clearOverlays();
      return;
    }

    toolBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    measureState.tool = tool;
    measureState.rulerPoints = [];
    measureState.anglePoints = [];

    const inst = state.moduleInstances[state.currentModule];
    if (inst && typeof inst.setTool === 'function') {
      inst.setTool(tool);
    }
  });
});

canvas.addEventListener('pointerdown', (e) => {
  if (state.view !== 'sim') return;
  if (state.currentModule === 'whiteboard') return;
  const world = renderer.getMousePos(e);
  if (measureState.tool === 'probe') {
    measureState.probe = world;
    ui.setData(
      `<div style="font-family:var(--font-mono)">Sonda: x=${world.x.toFixed(3)} m, y=${world.y.toFixed(3)} m</div>`
    );
  } else if (measureState.tool === 'ruler') {
    measureState.rulerPoints.push(world);
    if (measureState.rulerPoints.length > 2) measureState.rulerPoints = [world];
  } else if (measureState.tool === 'angle') {
    measureState.anglePoints.push(world);
    if (measureState.anglePoints.length > 3) measureState.anglePoints = [world];
  }
});

function toggleStopwatchPanel() {
  let panel = document.getElementById('stopwatchDock');
  if (panel) {
    panel.remove();
    return;
  }
  panel = document.createElement('div');
  panel.id = 'stopwatchDock';
  panel.className = 'stopwatch-dock';
  panel.innerHTML = `
    <strong>Cronómetro</strong>
    <div id="swDisplay" class="sw-display">0.00 s</div>
    <div class="btn-row">
      <button type="button" class="ctrl-btn primary" id="swStart">Iniciar</button>
      <button type="button" class="ctrl-btn" id="swReset">Reiniciar</button>
    </div>
  `;
  document.querySelector('.right-panel')?.prepend(panel);
  let running = false;
  let start = 0;
  let elapsed = 0;
  let raf = 0;
  const display = panel.querySelector('#swDisplay');
  const tick = () => {
    if (!running) return;
    elapsed = performance.now() - start;
    display.textContent = (elapsed / 1000).toFixed(2) + ' s';
    raf = requestAnimationFrame(tick);
  };
  panel.querySelector('#swStart').addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!running) {
      running = true;
      start = performance.now() - elapsed;
      b.textContent = 'Pausar';
      tick();
    } else {
      running = false;
      cancelAnimationFrame(raf);
      b.textContent = 'Iniciar';
    }
  });
  panel.querySelector('#swReset').addEventListener('click', () => {
    running = false;
    cancelAnimationFrame(raf);
    elapsed = 0;
    display.textContent = '0.00 s';
    panel.querySelector('#swStart').textContent = 'Iniciar';
  });
}

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (state.view === 'catalog') {
    return;
  }

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePause();
      break;
    case 'KeyR':
      e.preventDefault();
      resetBtn.click();
      break;
    case 'Escape':
      e.preventDefault();
      showCatalog();
      break;
    case 'KeyI': {
      const inst = state.moduleInstances[state.currentModule];
      if (inst?.setUnbounded) {
        e.preventDefault();
        inst.setUnbounded(!(inst.getUnbounded?.() ?? false));
      }
      break;
    }
  }
});

/* ============================================
   Loop
   ============================================ */

function onEngineUpdate(dt) {
  if (state.view !== 'sim') return;
  const inst = state.moduleInstances[state.currentModule];
  if (inst && typeof inst.update === 'function') inst.update(dt);
  // Solo módulos que declaran useCharts = true
  try {
    if (inst && inst.useCharts === true && typeof inst.getCharts === 'function') {
      const charts = inst.getCharts();
      if (charts != null) applyModuleCharts(charts);
    }
  } catch {
    /* no bloquear el loop */
  }
}

if (engine) {
  engine.onUpdate = onEngineUpdate;
}

/** Acepta string SVG o { series: [{label, points:[{x,y}]}] } */
function applyModuleCharts(charts) {
  if (typeof charts === 'string') {
    ui.setChart(charts, { show: true });
    return;
  }
  if (!charts || !Array.isArray(charts.series)) return;
  const W = 300;
  const H = 180;
  const pad = { l: 36, r: 12, t: 16, b: 28 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of charts.series) {
    for (const p of s.points || []) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = 1;
    minY = 0;
    maxY = 1;
  }
  if (maxX === minX) maxX = minX + 1;
  if (maxY === minY) maxY = minY + 1;
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const sx = (x) => pad.l + ((x - minX) / (maxX - minX)) * pw;
  const sy = (y) => pad.t + ph - ((y - minY) / (maxY - minY)) * ph;
  const colors = ['#4fc3f7', '#66bb6a', '#ffb74d', '#ef5350'];
  let paths = '';
  charts.series.forEach((s, i) => {
    const pts = s.points || [];
    if (pts.length < 2) return;
    const d = pts.map((p, j) => `${j ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    paths += `<path d="${d}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="2"/>`;
  });
  const title = charts.title
    ? `<text x="${W / 2}" y="12" text-anchor="middle" fill="var(--text-secondary)" font-size="10">${escapeHtml(
        charts.title
      )}</text>`
    : '';
  ui.setChart(
    `${title}<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + ph}" stroke="var(--border-color)"/><line x1="${pad.l}" y1="${pad.t + ph}" x2="${pad.l + pw}" y2="${pad.t + ph}" stroke="var(--border-color)"/>${paths}`,
    { show: true }
  );
}

function onEngineRender(ctx, alpha, elapsed) {
  if (state.view !== 'sim' || !renderer || !engine) return;
  renderer.clear();
  const inst = state.moduleInstances[state.currentModule];
  const skipGrid = inst && inst.skipWorldGrid === true;
  if (!skipGrid) {
    renderer.drawGrid({ spacing: 1 });
  }
  if (inst && typeof inst.render === 'function') {
    inst.render(ctx, alpha, elapsed);
  }
  drawMeasureOverlays(ctx);
  renderer.drawOverlays();
  if (fpsCounter) fpsCounter.textContent = `${engine.getFps()} FPS`;
  if (!engine.isPaused() && simStatus) {
    simStatus.textContent = `En ejecución · ${elapsed.toFixed(1)}s`;
  }
}

if (engine) {
  engine.onRender = onEngineRender;
  engine.onPauseChanged = () => updatePlayPauseUI();
}

function drawMeasureOverlays(ctx) {
  if (!renderer) return;
  if (measureState.probe) {
    const p = measureState.probe;
    renderer.drawTooltip(p.x, p.y, `x=${p.x.toFixed(2)}  y=${p.y.toFixed(2)}`);
  }
  if (measureState.rulerPoints.length === 1) {
    const a = measureState.rulerPoints[0];
    const pa = renderer.worldToCanvas(a.x, a.y);
    ctx.save();
    ctx.fillStyle = '#ffb74d';
    ctx.beginPath();
    ctx.arc(pa.x, pa.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (measureState.rulerPoints.length === 2) {
    const [a, b] = measureState.rulerPoints;
    const pa = renderer.worldToCanvas(a.x, a.y);
    const pb = renderer.worldToCanvas(b.x, b.y);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.save();
    ctx.strokeStyle = '#ffb74d';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.fillStyle = '#ffb74d';
    ctx.font = '12px monospace';
    ctx.fillText(`${dist.toFixed(2)} m`, (pa.x + pb.x) / 2, (pa.y + pb.y) / 2 - 8);
    ctx.restore();
  }
  if (measureState.anglePoints.length >= 1) {
    ctx.save();
    ctx.fillStyle = '#ce93d8';
    for (const pt of measureState.anglePoints) {
      const p = renderer.worldToCanvas(pt.x, pt.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (measureState.anglePoints.length === 3) {
      const [A, O, B] = measureState.anglePoints;
      const po = renderer.worldToCanvas(O.x, O.y);
      const pa = renderer.worldToCanvas(A.x, A.y);
      const pb = renderer.worldToCanvas(B.x, B.y);
      ctx.strokeStyle = '#ce93d8';
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(po.x, po.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      const ang1 = Math.atan2(A.y - O.y, A.x - O.x);
      const ang2 = Math.atan2(B.y - O.y, B.x - O.x);
      let deg = Math.abs((ang2 - ang1) * 180 / Math.PI);
      if (deg > 180) deg = 360 - deg;
      ctx.fillText(`${deg.toFixed(1)}°`, po.x + 10, po.y - 10);
    }
    ctx.restore();
  }
}

/* ============================================
   Init
   ============================================ */

function collectUiParams() {
  const out = {};
  document.querySelectorAll('#paramsPanel input[type="range"], #paramsPanel input.param-number').forEach((el) => {
    const id = (el.id || '').replace(/^(param_|num_)/, '');
    if (!id) return;
    const v = parseFloat(el.value);
    if (Number.isFinite(v)) out[id] = v;
  });
  document.querySelectorAll('#paramsPanel input[type="checkbox"]').forEach((el) => {
    const id = (el.id || '').replace(/^param_/, '');
    if (id) out[id] = el.checked;
  });
  return out;
}

function collectModuleSnapshot() {
  const inst = state.moduleInstances[state.currentModule];
  const snap = {
    catalogId: state.catalogId,
    engineKey: state.currentModule,
    simTime: engine?._elapsed ?? 0,
    paused: engine?.isPaused?.() ?? false,
    speed: engine?.getSpeed?.() ?? 1,
    tools: {
      tool: measureState.tool
    },
    uiParams: collectUiParams()
  };
  if (inst && typeof inst.getState === 'function') {
    try {
      const s = inst.getState();
      snap.moduleState = JSON.parse(
        JSON.stringify(s, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v))
      );
    } catch {
      snap.moduleState = null;
    }
  }
  return snap;
}

/** Modal HTML (prompt falla o no existe en Electron). */
function askWorkName(defaultName) {
  return new Promise((resolve) => {
    const prev = document.getElementById('saveWorkModal');
    if (prev) prev.remove();
    const overlay = document.createElement('div');
    overlay.id = 'saveWorkModal';
    overlay.className = 'session-gate';
    overlay.innerHTML = `
      <div class="session-gate-card" role="dialog" aria-labelledby="saveWorkTitle">
        <h2 id="saveWorkTitle">Guardar trabajo</h2>
        <p class="session-gate-lead">Se guardará el módulo, parámetros y herramientas actuales en la caché de este equipo${
          window.FisicaHNDesktop?.isDesktop ? ' (app de escritorio)' : ''
        }.</p>
        <label class="gate-label">Nombre del trabajo
          <input type="text" id="saveWorkName" maxlength="120" value="">
        </label>
        <p class="gate-error" id="saveWorkErr" hidden></p>
        <div class="gate-actions">
          <button type="button" class="gate-btn primary" id="saveWorkOk">Guardar</button>
          <button type="button" class="gate-btn secondary" id="saveWorkCancel">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#saveWorkName');
    if (input) input.value = defaultName;
    input?.focus();
    input?.select();
    const finish = (val) => {
      overlay.remove();
      resolve(val);
    };
    overlay.querySelector('#saveWorkCancel')?.addEventListener('click', () => finish(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });
    const submit = () => {
      const name = String(input?.value || '').trim();
      const err = overlay.querySelector('#saveWorkErr');
      if (!name) {
        if (err) {
          err.textContent = 'Escribe un nombre.';
          err.hidden = false;
        }
        return;
      }
      finish(name);
    };
    overlay.querySelector('#saveWorkOk')?.addEventListener('click', submit);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  });
}

async function handleSaveWork() {
  let session = getSession();
  if (!session) {
    try {
      await ensureSessionGate();
    } catch {
      /* ignore */
    }
    session = getSession();
    if (!session) {
      alert('Inicia sesión (Alumno o Docente) para guardar en este equipo.');
      return;
    }
  }

  await initWorksStorage();

  const defaultName = `${state.catalogId || state.currentModule || 'modulo'}-${new Date()
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ')}`;
  const name = await askWorkName(defaultName);
  if (name == null) return;

  try {
    const entry = getById(state.catalogId);
    const work = await saveWork({
      name,
      moduleId: state.catalogId || state.currentModule || 'unknown',
      moduleTitle: entry?.title || moduleTitle?.textContent || state.currentModule,
      snapshot: collectModuleSnapshot(),
      notes:
        getSession()?.mode === 'exam'
          ? 'Modo examen'
          : window.FisicaHNDesktop?.isDesktop
            ? 'Guardado en app de escritorio'
            : ''
    });
    refreshWorksList();
    const total = listWorks().length;
    const where = window.FisicaHNDesktop?.isDesktop
      ? 'archivo de la app (userData) + caché local'
      : 'caché local de este navegador';
    const cloudNote = work.cloudSynced ? '\nTambién se envió a la nube.' : '';
    const weakNote = work.integrityWeak ? '\n(Aviso: sello de integridad débil.)' : '';
    alert(
      `Trabajo guardado: “${work.name}”\n` +
        `Total: ${total}\n` +
        `Queda en ${where}.${weakNote}${cloudNote}\n\n` +
        `Ábrelo desde Mis trabajos → Abrir en módulo.`
    );
  } catch (e) {
    console.error('Guardar trabajo:', e);
    alert(e?.message || String(e) || 'No se pudo guardar.');
  }
}

/**
 * Abre un trabajo guardado: carga el módulo y restaura parámetros / estado.
 * @param {string} workId
 */
export async function openWorkInModule(workId) {
  await initWorksStorage();
  const w = getWork(workId);
  if (!w) {
    alert('Trabajo no encontrado en la caché.');
    return;
  }
  const catalogId = w.snapshot?.catalogId || w.moduleId;
  const entry = getById(catalogId);
  if (!entry || entry.special === 'works') {
    alert(`No se puede abrir el módulo “${catalogId || '?'}”.`);
    return;
  }

  // Cerrar modal de trabajos
  const modal = document.getElementById('worksModal');
  if (modal) {
    modal.hidden = true;
    document.body.classList.remove('works-modal-open');
  }

  await openCatalogModule(catalogId);

  // Esperar un frame a que el módulo pinte params
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));

  const inst = state.moduleInstances[state.currentModule];
  const snap = w.snapshot || {};

  if (inst && typeof inst.setState === 'function' && snap.moduleState) {
    try {
      inst.setState(snap.moduleState);
    } catch (e) {
      console.warn('setState módulo', e);
    }
  } else if (snap.uiParams && typeof snap.uiParams === 'object') {
    // Fallback: aplicar sliders del panel
    for (const [id, val] of Object.entries(snap.uiParams)) {
      const range = document.getElementById(`param_${id}`);
      const num = document.getElementById(`num_${id}`);
      if (range && typeof val === 'number') {
        range.value = String(val);
        range.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (num && typeof val === 'number') {
        num.value = String(val);
        num.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof val === 'boolean') {
        const cb = document.getElementById(`param_${id}`);
        if (cb && cb.type === 'checkbox') {
          cb.checked = val;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  }

  if (snap.tools?.tool) {
    measureState.tool = snap.tools.tool;
    document.querySelectorAll('.tool-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === snap.tools.tool);
    });
  }
  if (typeof snap.speed === 'number' && speedSlider) {
    speedSlider.value = String(snap.speed);
    speedSlider.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (snap.paused && engine && !engine.isPaused()) {
    engine.pause(true);
    updatePlayPauseUI();
  }

  logAudit('work_open', { id: w.id, moduleId: catalogId });
}

// API global para el panel de trabajos
window.FisicaHNOpenWork = openWorkInModule;

function refreshWorksList() {
  // Lista de trabajos solo en el hub / barra lateral, no en panel derecho
  updateWorksCountBadges();
}

// Enlazar tarjetas del HTML estático en cuanto el módulo carga
try {
  bindCatalogCardClicks();
  renderCatalogGrids();
} catch (e) {
  console.error('Catálogo bootstrap:', e);
}

async function init() {
  // App de escritorio (Electron / NetSupport): ocultar enlaces web
  if (window.FisicaHNDesktop?.isDesktop) {
    document.documentElement.dataset.desktop = '1';
    document.body.classList.add('is-desktop');
  }

  // Mostrar catálogo YA (antes del gate) para que la app no quede en blanco
  try {
    showCatalog();
    renderCatalogGrids();
    bindCatalogCardClicks();
  } catch (e) {
    console.error('Catálogo inicial:', e);
  }

  // Indicador Wi‑Fi Online/Offline + Reconectar
  try {
    initNetworkStatusUI();
  } catch (e) {
    console.warn('Network UI:', e);
  }

  try {
    await initWorksStorage();
  } catch (e) {
    console.warn('Works storage:', e);
  }

  try {
    await ensureSessionGate();
  } catch (e) {
    console.warn('Session gate:', e);
  }
  try {
    bindUserMenu();
  } catch (e) {
    console.warn('User menu:', e);
    renderSessionBadge(document.getElementById('sessionBadgeHost'));
    renderUserChip(document.getElementById('userChipHost'));
  }

  try {
    initPanelResize({
      onResize: () => {
        try {
          engine?.resizeCanvas?.();
        } catch {
          /* ignore */
        }
      }
    });
  } catch (e) {
    console.warn('Panel resize:', e);
  }
  logAudit('app_start', {
    modules: CATALOG.length,
    desktop: !!window.FisicaHNDesktop?.isDesktop
  });

  bindWorksPanelControls({
    onChanged: () => {
      refreshWorksList();
      if (state.view === 'catalog') renderCatalogGrids();
    }
  });
  refreshWorksList();

  document.getElementById('openWhiteboardBtn')?.addEventListener('click', () => {
    openCatalogModule('whiteboard');
  });
  document.getElementById('sidebarBrandBtn')?.addEventListener('click', () => {
    showCatalog();
  });
  document.getElementById('saveWorkBtn')?.addEventListener('click', () => handleSaveWork());

  const saved = loadProgress();
  if (canvas && engine) {
    engine.start();
  } else {
    console.error('Canvas o motor no disponible');
  }

  // No restaurar "my-works" como vista sim
  const resumeId = saved.lastCatalogId;
  if (
    saved.lastView === 'sim' &&
    resumeId &&
    resumeId !== WORKS_MODULE.id &&
    getById(resumeId) &&
    getById(resumeId).special !== 'works'
  ) {
    try {
      await openCatalogModule(resumeId);
    } catch (e) {
      console.error('Reabrir módulo:', e);
      showCatalog();
    }
  } else {
    showCatalog();
  }

  const session = getSession();
  if (session?.mode === 'exam') {
    document.body.classList.add('exam-mode');
  }

  state.loaded = true;
  console.log('FísicaHN: listo —', CATALOG.length, 'módulos');
}

init().catch((err) => {
  console.error('Init falló:', err);
  try {
    showCatalog();
    renderCatalogGrids();
  } catch {
    /* último recurso */
  }
  alert(
    'Hubo un error al iniciar FísicaHN. Recarga la página.\nSi persiste, abre la consola (F12) y reporta el mensaje.'
  );
});
