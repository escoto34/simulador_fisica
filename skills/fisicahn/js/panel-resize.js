/**
 * Drag-to-resize de columnas del laboratorio (sidebar | canvas | panel derecho | inferior).
 * Persiste anchos/alturas en localStorage.
 */

const KEY = 'fisicahn_layout_v1';
const MIN_SIDE = 160;
const MAX_SIDE = 420;
const MIN_RIGHT = 220;
const MAX_RIGHT = 520;
const MIN_BOTTOM = 100;
const MAX_BOTTOM = 360;

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function save(partial) {
  const next = { ...load(), ...partial };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function applyLayout(layout) {
  const root = document.documentElement;
  if (layout.sidebar != null) {
    root.style.setProperty('--sidebar-width', `${layout.sidebar}px`);
  }
  if (layout.right != null) {
    root.style.setProperty('--right-panel-width', `${layout.right}px`);
  }
  if (layout.bottom != null) {
    root.style.setProperty('--bottom-panel-height', `${layout.bottom}px`);
  }
}

function makeHandle(side) {
  const el = document.createElement('div');
  el.className = `panel-resize-handle panel-resize-${side}`;
  el.setAttribute('role', 'separator');
  el.setAttribute('aria-orientation', side === 'bottom' ? 'horizontal' : 'vertical');
  el.title =
    side === 'bottom'
      ? 'Arrastra para redimensionar el panel inferior'
      : side === 'left'
        ? 'Arrastra para redimensionar la barra lateral'
        : 'Arrastra para redimensionar el panel derecho';
  return el;
}

/**
 * @param {{ onResize?: () => void }} [opts]
 */
export function initPanelResize(opts = {}) {
  const body = document.body;
  if (!body || body.dataset.panelResize === '1') return;
  body.dataset.panelResize = '1';

  const layout = load();
  applyLayout(layout);

  const left = makeHandle('left');
  const right = makeHandle('right');
  const bottom = makeHandle('bottom');
  body.appendChild(left);
  body.appendChild(right);
  body.appendChild(bottom);

  const bind = (handle, kind) => {
    let startX = 0;
    let startY = 0;
    let startVal = 0;
    let dragging = false;

    const onMove = (e) => {
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      let next = startVal;
      if (kind === 'left') {
        next = Math.min(MAX_SIDE, Math.max(MIN_SIDE, startVal + (clientX - startX)));
        applyLayout({ sidebar: next });
        save({ sidebar: next });
      } else if (kind === 'right') {
        next = Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, startVal - (clientX - startX)));
        applyLayout({ right: next });
        save({ right: next });
      } else {
        next = Math.min(MAX_BOTTOM, Math.max(MIN_BOTTOM, startVal - (clientY - startY)));
        applyLayout({ bottom: next });
        save({ bottom: next });
      }
      opts.onResize?.();
      e.preventDefault?.();
    };

    const onUp = () => {
      dragging = false;
      body.classList.remove('is-resizing-panels');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      opts.onResize?.();
    };

    handle.addEventListener('pointerdown', (e) => {
      if (!body.classList.contains('view-sim')) return;
      dragging = true;
      body.classList.add('is-resizing-panels');
      startX = e.clientX;
      startY = e.clientY;
      const cs = getComputedStyle(document.documentElement);
      if (kind === 'left') {
        startVal = parseFloat(cs.getPropertyValue('--sidebar-width')) || 240;
      } else if (kind === 'right') {
        startVal = parseFloat(cs.getPropertyValue('--right-panel-width')) || 320;
      } else {
        startVal = parseFloat(cs.getPropertyValue('--bottom-panel-height')) || 160;
      }
      handle.setPointerCapture?.(e.pointerId);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.preventDefault();
    });
  };

  bind(left, 'left');
  bind(right, 'right');
  bind(bottom, 'bottom');

  // Solo visibles en vista simulación (CSS)
}
