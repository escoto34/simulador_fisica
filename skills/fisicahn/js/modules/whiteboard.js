import { clearChallenges } from '../module-ui.js';
/**
 * Pizarra docente — dibujo libre, selección/mover, borrador que no pinta el fondo.
 */

export const skipWorldGrid = true;

let _engine = null;
let _renderer = null;
let _ui = null;
let canvas = null;
let ctx = null;

/** @type {'pen'|'eraser'|'line'|'rect'|'circle'|'arrow'|'select'} */
let tool = 'pen';
let color = '#e8eef6';
let lineWidth = 3;
let lightBg = false;

/** @type {Array<object>} */
let strokes = [];
/** @type {object|null} */
let current = null;
/** @type {object|null} */
let selected = null;
let dragOffset = null;
let dragging = false;

const COLORS = ['#e8eef6', '#4fc3f7', '#66bb6a', '#ffb74d', '#ef5350', '#ce93d8', '#111827'];
const ERASE_RADIUS = 18;
/**
 * Densidad del lápiz: ~7× más puntos que un solo sample por pointermove.
 * Paso máximo entre puntos del trazo (px de canvas). Más bajo = trazo más suave
 * y borrado más limpio (el borrador filtra por distancia a cada punto).
 */
const PEN_SAMPLE_STEP = 1.5;
/** Pasos de borrado a lo largo del movimiento del cursor (evita saltos al arrastrar rápido). */
const ERASE_PATH_STEP = ERASE_RADIUS / 7;

function bgColor() {
  return lightBg ? '#f4f6f8' : '#0f0f1a';
}

function pointer(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function strokeBounds(s) {
  if (s.type === 'text') {
    const w = (s.text || '').length * 11;
    return { x: s.x - 4, y: s.y - 22, w: w + 8, h: 28 };
  }
  if (s.type === 'pen' || s.type === 'eraser') {
    const pts = s.points || [];
    if (!pts.length) return null;
    let minX = pts[0].x;
    let maxX = pts[0].x;
    let minY = pts[0].y;
    let maxY = pts[0].y;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const pad = (s.width || 3) + 6;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  if (s.from && s.to) {
    const minX = Math.min(s.from.x, s.to.x);
    const maxX = Math.max(s.from.x, s.to.x);
    const minY = Math.min(s.from.y, s.to.y);
    const maxY = Math.max(s.from.y, s.to.y);
    const pad = 10;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  return null;
}

function hitTest(p) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    if (s.type === 'eraser') continue;
    if (s.type === 'text') {
      const b = strokeBounds(s);
      if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return s;
      continue;
    }
    if (s.type === 'pen' && s.points) {
      for (const q of s.points) {
        if (dist(p, q) < Math.max(12, (s.width || 3) + 8)) return s;
      }
      continue;
    }
    if (s.from && s.to) {
      if (s.type === 'circle') {
        const cx = (s.from.x + s.to.x) / 2;
        const cy = (s.from.y + s.to.y) / 2;
        const rx = Math.abs(s.to.x - s.from.x) / 2;
        const ry = Math.abs(s.to.y - s.from.y) / 2;
        const nx = rx ? (p.x - cx) / rx : 0;
        const ny = ry ? (p.y - cy) / ry : 0;
        if (nx * nx + ny * ny <= 1.15) return s;
      } else if (s.type === 'rect') {
        const minX = Math.min(s.from.x, s.to.x) - 6;
        const maxX = Math.max(s.from.x, s.to.x) + 6;
        const minY = Math.min(s.from.y, s.to.y) - 6;
        const maxY = Math.max(s.from.y, s.to.y) + 6;
        if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) return s;
      } else {
        // line / arrow: distancia a segmento
        const d = distToSegment(p, s.from, s.to);
        if (d < 12) return s;
      }
    }
  }
  return null;
}

function distToSegment(p, a, b) {
  const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

function translateStroke(s, dx, dy) {
  if (s.type === 'text') {
    s.x += dx;
    s.y += dy;
    return;
  }
  if (s.points) {
    for (const p of s.points) {
      p.x += dx;
      p.y += dy;
    }
  }
  if (s.from) {
    s.from.x += dx;
    s.from.y += dy;
  }
  if (s.to) {
    s.to.x += dx;
    s.to.y += dy;
  }
}

/**
 * Añade puntos del lápiz interpolando entre el último y el actual
 * (~7 muestras por cada “salto” típico de pointermove).
 */
function appendPenPoints(stroke, p) {
  const pts = stroke.points;
  if (!pts.length) {
    pts.push({ x: p.x, y: p.y });
    return;
  }
  const last = pts[pts.length - 1];
  const d = dist(last, p);
  if (d < 0.35) {
    // Micro-movimiento: actualiza el último punto (cursor “sigue” sin saturar)
    last.x = p.x;
    last.y = p.y;
    return;
  }
  const n = Math.max(1, Math.ceil(d / PEN_SAMPLE_STEP));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push({
      x: last.x + (p.x - last.x) * t,
      y: last.y + (p.y - last.y) * t
    });
  }
}

/**
 * Parte un trazo de lápiz en segmentos contiguos (tras borrar en el medio).
 * Evita que lineTo cruce el hueco borrado y se vea “raro”.
 */
function splitPenStroke(s, keepMask) {
  const pts = s.points || [];
  const out = [];
  let run = [];
  for (let i = 0; i < pts.length; i++) {
    if (keepMask[i]) {
      run.push(pts[i]);
    } else if (run.length) {
      if (run.length >= 2) out.push({ ...s, points: run });
      run = [];
    }
  }
  if (run.length >= 2) out.push({ ...s, points: run });
  return out;
}

/** Borrador: elimina o recorta trazos cercanos al puntero (no pinta el fondo). */
function eraseAt(p) {
  const r = Math.max(ERASE_RADIUS, lineWidth * 3);
  const next = [];
  for (const s of strokes) {
    if (s.type === 'eraser') continue;
    if (s.type === 'text') {
      if (dist(p, { x: s.x, y: s.y }) > r + 20) next.push(s);
      continue;
    }
    if (s.type === 'pen' && s.points?.length) {
      const keepMask = s.points.map((q) => dist(p, q) > r);
      // También quita puntos cuyo segmento al vecino pasa por el borrador
      for (let i = 0; i < s.points.length - 1; i++) {
        if (!keepMask[i] || !keepMask[i + 1]) continue;
        if (distToSegment(p, s.points[i], s.points[i + 1]) <= r) {
          // recorta el tramo: marca el más cercano al centro del borrador
          const d0 = dist(p, s.points[i]);
          const d1 = dist(p, s.points[i + 1]);
          if (d0 <= d1) keepMask[i] = false;
          else keepMask[i + 1] = false;
        }
      }
      const parts = splitPenStroke(s, keepMask);
      for (const part of parts) next.push(part);
      continue;
    }
    if (s.from && s.to) {
      const d1 = dist(p, s.from);
      const d2 = dist(p, s.to);
      const dm = distToSegment(p, s.from, s.to);
      if (Math.min(d1, d2, dm) > r) next.push(s);
      continue;
    }
    next.push(s);
  }
  strokes = next;
  if (selected && !strokes.includes(selected)) selected = null;
}

/** Aplica borrador en varios puntos entre `from` y `to` (movimiento denso). */
function eraseAlongPath(from, to) {
  if (!from) {
    eraseAt(to);
    return;
  }
  const d = dist(from, to);
  const step = Math.max(2, ERASE_PATH_STEP);
  const n = Math.max(1, Math.ceil(d / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    eraseAt({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t
    });
  }
}

function onPointerDown(e) {
  if (!canvas) return;
  canvas.setPointerCapture?.(e.pointerId);
  const p = pointer(e);

  if (tool === 'select') {
    selected = hitTest(p);
    if (selected) {
      dragging = true;
      const b = strokeBounds(selected);
      dragOffset = b
        ? { x: p.x - (b.x + b.w / 2), y: p.y - (b.y + b.h / 2), last: p }
        : { x: 0, y: 0, last: p };
    } else {
      selected = null;
      dragging = false;
    }
    return;
  }

  if (tool === 'eraser') {
    eraseAt(p);
    current = { type: 'erasing', last: { x: p.x, y: p.y } };
    return;
  }

  if (tool === 'pen') {
    current = {
      type: 'pen',
      color,
      width: lineWidth,
      points: [{ x: p.x, y: p.y }]
    };
  } else {
    current = {
      type: tool,
      color,
      width: lineWidth,
      from: { ...p },
      to: { ...p }
    };
  }
}

function onPointerMove(e) {
  const p = pointer(e);
  if (tool === 'select' && dragging && selected && dragOffset) {
    const dx = p.x - dragOffset.last.x;
    const dy = p.y - dragOffset.last.y;
    translateStroke(selected, dx, dy);
    dragOffset.last = p;
    return;
  }
  if (tool === 'eraser' && current?.type === 'erasing') {
    eraseAlongPath(current.last, p);
    current.last = { x: p.x, y: p.y };
    return;
  }
  if (!current || current.type === 'erasing') return;
  if (current.points) {
    appendPenPoints(current, p);
  } else {
    current.to = p;
  }
}

function onPointerUp() {
  if (tool === 'select') {
    dragging = false;
    dragOffset = null;
    return;
  }
  if (current?.type === 'erasing') {
    current = null;
    return;
  }
  if (!current) return;
  if (current.type !== 'eraser') {
    strokes.push(current);
    if (strokes.length > 300) strokes.shift();
  }
  current = null;
}

function drawStroke(s) {
  if (!ctx || s.type === 'erasing') return;
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.type === 'pen') {
    const pts = s.points || [];
    if (pts.length < 2) {
      if (pts[0]) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, s.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  } else if (s.type === 'line' || s.type === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(s.from.x, s.from.y);
    ctx.lineTo(s.to.x, s.to.y);
    ctx.stroke();
    if (s.type === 'arrow') {
      const ang = Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x);
      const hl = 14;
      ctx.beginPath();
      ctx.moveTo(s.to.x, s.to.y);
      ctx.lineTo(s.to.x - hl * Math.cos(ang - 0.4), s.to.y - hl * Math.sin(ang - 0.4));
      ctx.lineTo(s.to.x - hl * Math.cos(ang + 0.4), s.to.y - hl * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();
    }
  } else if (s.type === 'rect') {
    ctx.strokeRect(s.from.x, s.from.y, s.to.x - s.from.x, s.to.y - s.from.y);
  } else if (s.type === 'circle') {
    const rx = (s.to.x - s.from.x) / 2;
    const ry = (s.to.y - s.from.y) / 2;
    const cx = s.from.x + rx;
    const cy = s.from.y + ry;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.abs(rx) || 1, Math.abs(ry) || 1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function clearBoard() {
  strokes = [];
  current = null;
  selected = null;
}

function undo() {
  if (!strokes.length) return;
  strokes.pop();
  selected = null;
}

function exportPng() {
  if (!canvas) return;
  const a = document.createElement('a');
  a.download = `pizarra-fisicahn-${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

function addText() {
  const text = prompt('Texto para la pizarra:');
  if (!text) return;
  const w = canvas.width;
  const h = canvas.height;
  strokes.push({
    type: 'text',
    color,
    width: lineWidth,
    text,
    x: w * 0.15,
    y: h * 0.2 + strokes.filter((s) => s.type === 'text').length * 28
  });
}

export function init(engine, renderer, ui) {
  _engine = engine;
  _renderer = renderer;
  _ui = ui;
  canvas = engine.canvas;
  ctx = canvas.getContext('2d');
  strokes = [];
  current = null;
  selected = null;
  tool = 'pen';
  color = '#e8eef6';
  lightBg = false;
  renderer.resetCamera();

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  ui.setInfo(`
    <strong>Pizarra</strong> — dibujo libre para la clase.<br>
    <strong>Mover</strong>: herramienta Seleccionar y arrastra formas o texto.<br>
    <strong>Borrador</strong>: elimina trazos sin borrar el fondo ni la cuadrícula.
  `);
  ui.setFormulas('<p class="tab-text">Herramienta de enseñanza (sin fórmulas).</p>');
  ui.setData('<p class="tab-text">Dibuja en el canvas. Usa Seleccionar para mover objetos.</p>');
  clearChallenges(ui);
  ui.setChart(
    '<text x="150" y="90" text-anchor="middle" fill="var(--text-secondary)" font-size="11">Sin gráfica</text>'
  );

  renderParams();
  engine.pause(true);
}

export function destroy() {
  if (canvas) {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.style.touchAction = '';
    canvas.style.cursor = '';
  }
  strokes = [];
  current = null;
  selected = null;
  _engine = _renderer = _ui = null;
  canvas = ctx = null;
}

export function reset() {
  clearBoard();
}

export function setTool(toolId) {
  const map = {
    pen: 'pen',
    eraser: 'eraser',
    line: 'line',
    rect: 'rect',
    circle: 'circle',
    arrow: 'arrow',
    select: 'select',
    pointer: 'select'
  };
  if (map[toolId]) {
    tool = map[toolId];
    highlightTool();
    if (canvas) canvas.style.cursor = tool === 'select' ? 'move' : 'crosshair';
  }
}

export function update() {}

export function render(ctxDraw) {
  if (!ctx || !canvas) return;
  const w = canvas.width;
  const h = canvas.height;

  // Siempre repinta fondo + cuadrícula (el borrador nunca los elimina)
  ctxDraw.save();
  ctxDraw.setTransform(1, 0, 0, 1, 0, 0);
  ctxDraw.fillStyle = bgColor();
  ctxDraw.fillRect(0, 0, w, h);

  ctxDraw.strokeStyle = lightBg ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
  ctxDraw.lineWidth = 1;
  const step = 40;
  for (let x = 0; x < w; x += step) {
    ctxDraw.beginPath();
    ctxDraw.moveTo(x, 0);
    ctxDraw.lineTo(x, h);
    ctxDraw.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctxDraw.beginPath();
    ctxDraw.moveTo(0, y);
    ctxDraw.lineTo(w, y);
    ctxDraw.stroke();
  }

  for (const s of strokes) {
    if (s.type === 'text') {
      ctxDraw.fillStyle = s.color;
      ctxDraw.font = '20px system-ui, sans-serif';
      ctxDraw.fillText(s.text, s.x, s.y);
    } else {
      drawStroke(s);
    }
    if (s === selected) {
      const b = strokeBounds(s);
      if (b) {
        ctxDraw.save();
        ctxDraw.strokeStyle = '#4fc3f7';
        ctxDraw.lineWidth = 1.5;
        ctxDraw.setLineDash([4, 3]);
        ctxDraw.strokeRect(b.x, b.y, b.w, b.h);
        ctxDraw.restore();
      }
    }
  }
  if (current && current.type !== 'erasing') drawStroke(current);

  ctxDraw.fillStyle = lightBg ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.4)';
  ctxDraw.font = '12px system-ui';
  ctxDraw.textAlign = 'left';
  ctxDraw.fillText(`Herramienta: ${labelTool(tool)} · ${strokes.length} objetos`, 12, h - 12);
  ctxDraw.restore();
}

function highlightTool() {
  document.querySelectorAll('[data-wb-tool]').forEach((b) => {
    b.classList.toggle('active', b.dataset.wbTool === tool);
  });
}

function renderParams() {
  _ui.setParams(`
    <div class="control-group">
      <label class="control-label">Herramienta</label>
      <div class="btn-row" style="flex-wrap:wrap;gap:6px">
        ${['select', 'pen', 'eraser', 'line', 'arrow', 'rect', 'circle']
          .map(
            (t) =>
              `<button type="button" class="ctrl-btn ${t === tool ? 'active' : ''}" data-wb-tool="${t}">${labelTool(t)}</button>`
          )
          .join('')}
      </div>
    </div>
    <div class="control-group">
      <label class="control-label">Color</label>
      <div class="btn-row" style="flex-wrap:wrap;gap:6px">
        ${COLORS.map(
          (c) =>
            `<button type="button" class="color-swatch" data-color="${c}" style="background:${c};width:28px;height:28px;border-radius:6px;border:2px solid ${c === color ? 'var(--accent)' : 'transparent'}" aria-label="Color"></button>`
        ).join('')}
      </div>
    </div>
    <div class="control-group">
      <label class="control-label" for="wb_width">Grosor</label>
      <div class="slider-row">
        <input type="range" id="wb_width" class="custom-slider" min="1" max="16" step="1" value="${lineWidth}">
        <span class="slider-value" id="wb_width_v">${lineWidth}</span>
      </div>
    </div>
    <div class="control-group btn-row" style="flex-wrap:wrap;gap:6px">
      <button type="button" class="ctrl-btn" id="wb_undo">Deshacer</button>
      <button type="button" class="ctrl-btn" id="wb_text">Texto</button>
      <button type="button" class="ctrl-btn" id="wb_theme">${lightBg ? 'Fondo oscuro' : 'Fondo claro'}</button>
      <button type="button" class="ctrl-btn" id="wb_export">Exportar PNG</button>
      <button type="button" class="ctrl-btn" id="wb_clear" style="color:var(--danger)">Limpiar</button>
    </div>
  `);

  setTimeout(() => {
    document.querySelectorAll('[data-wb-tool]').forEach((b) => {
      b.addEventListener('click', () => {
        tool = b.dataset.wbTool;
        highlightTool();
        if (canvas) canvas.style.cursor = tool === 'select' ? 'move' : 'crosshair';
      });
    });
    document.querySelectorAll('[data-color]').forEach((b) => {
      b.addEventListener('click', () => {
        color = b.dataset.color;
        renderParams();
      });
    });
    const wEl = document.getElementById('wb_width');
    const wV = document.getElementById('wb_width_v');
    wEl?.addEventListener('input', () => {
      lineWidth = parseInt(wEl.value, 10);
      if (wV) wV.textContent = String(lineWidth);
    });
    document.getElementById('wb_undo')?.addEventListener('click', undo);
    document.getElementById('wb_text')?.addEventListener('click', addText);
    document.getElementById('wb_clear')?.addEventListener('click', clearBoard);
    document.getElementById('wb_export')?.addEventListener('click', exportPng);
    document.getElementById('wb_theme')?.addEventListener('click', () => {
      lightBg = !lightBg;
      renderParams();
    });
  }, 0);
}

function labelTool(t) {
  return (
    {
      select: 'Mover',
      pen: 'Lápiz',
      eraser: 'Borrador',
      line: 'Línea',
      arrow: 'Flecha',
      rect: 'Rectángulo',
      circle: 'Círculo'
    }[t] || t
  );
}
