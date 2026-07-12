/**
 * Panel y modal de trabajos (guardados + importados + evaluación).
 */

import {
  listWorks,
  deleteWork,
  importWorksJSON,
  exportWorksJSON,
  getWork
} from './works.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ICONS = {
  saved: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M17 21v-8H7v8M7 3v5h8" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  imported: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  exam: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v4M12 17h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
};

function workOrigin(w) {
  if (w.source === 'imported' || w._importVerified != null) return 'imported';
  if (w.mode === 'exam') return 'exam';
  if (w.cloudSynced) return 'cloud';
  return 'saved';
}

function categoryLabel(w) {
  const o = workOrigin(w);
  if (o === 'imported') {
    if (w._importVerified === false) return 'Importado · sello dudoso';
    if (w._importVerified === true) return 'Importado · sello OK';
    return 'Importado';
  }
  if (o === 'exam') return 'Examen';
  if (o === 'cloud') return 'Guardado · nube';
  return 'Guardado';
}

function iconFor(w) {
  const o = workOrigin(w);
  if (o === 'imported' && w._importVerified === false) return ICONS.warn;
  if (o === 'imported') return ICONS.imported;
  if (o === 'exam') return ICONS.exam;
  if (o === 'cloud') return ICONS.cloud;
  return ICONS.saved;
}

function originClass(w) {
  const o = workOrigin(w);
  if (o === 'imported' && w._importVerified === false) return 'is-warn';
  return `is-${o}`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('es-HN', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  } catch {
    return iso || '—';
  }
}

function describe(w) {
  return [
    w.moduleTitle || w.moduleId || 'Módulo',
    w.studentName || null,
    w.schoolName || null,
    formatDate(w.savedAt || w.importedAt)
  ]
    .filter(Boolean)
    .join(' · ');
}

export function renderWorksSidebar(host, opts = {}) {
  if (!host) return;
  const limit = opts.limit ?? 8;
  const works = listWorks().slice(0, limit);
  const total = listWorks().length;

  if (!works.length) {
    host.innerHTML = `
      <p class="placeholder-text">
        Aún no hay trabajos. Usa <strong>Guardar trabajo</strong> en un módulo.
      </p>`;
    return;
  }

  host.innerHTML =
    works
      .map(
        (w) => `
    <article class="work-item ${originClass(w)}" data-id="${escapeHtml(w.id)}">
      <span class="work-item-icon" aria-hidden="true">${iconFor(w)}</span>
      <div class="work-item-body">
        <div class="work-item-title">${escapeHtml(w.name)}</div>
        <div class="work-item-meta">${escapeHtml(categoryLabel(w))}</div>
        <div class="work-item-desc">${escapeHtml(describe(w))}</div>
      </div>
      <button type="button" class="work-del" data-del="${escapeHtml(w.id)}" aria-label="Eliminar trabajo">×</button>
    </article>`
      )
      .join('') +
    (total > limit
      ? `<p class="works-more-hint">${total - limit} más — “Ver mis trabajos”.</p>`
      : '');

  host.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('¿Eliminar este trabajo de la caché?')) {
        deleteWork(btn.dataset.del);
        renderWorksSidebar(host, opts);
        const modalList = document.getElementById('worksModalList');
        if (modalList) {
          const overlay = document.getElementById('worksModal');
          overlay?._paint?.();
        }
        updateWorksCountBadges();
      }
    });
  });
}

export function renderWorksList2(host, opts = {}) {
  if (!host) return;
  const filter = opts.filter || 'all';
  const evaluate = opts.evaluate !== false;
  let works = listWorks();
  if (filter === 'saved') {
    works = works.filter((w) => workOrigin(w) !== 'imported');
  } else if (filter === 'imported') {
    works = works.filter((w) => workOrigin(w) === 'imported');
  }

  if (!works.length) {
    host.innerHTML = `
      <div class="works-list2-empty">
        <p>No hay trabajos${filter === 'imported' ? ' importados' : filter === 'saved' ? ' guardados' : ''}.</p>
        <p class="placeholder-text">Guarda un trabajo en un módulo de simulación.</p>
      </div>`;
    return;
  }

  host.innerHTML = `
    <div class="works-list2" role="list">
      <div class="works-list2-sep" aria-hidden="true"></div>
      ${works
        .map(
          (w) => `
        <div class="works-list2-row ${originClass(w)}" role="listitem" data-id="${escapeHtml(w.id)}">
          <div class="works-list2-meta">
            <span class="works-list2-icon">${iconFor(w)}</span>
            <div>
              <h3 class="works-list2-title">${escapeHtml(w.name)}</h3>
              <p class="works-list2-cat">${escapeHtml(categoryLabel(w))}</p>
            </div>
          </div>
          <p class="works-list2-desc">${escapeHtml(describe(w))}${
            w.notes ? ` — ${escapeHtml(String(w.notes).slice(0, 80))}` : ''
          }</p>
          <div class="works-list2-actions">
            <button type="button" class="works-list2-btn primary" data-open="${escapeHtml(w.id)}" title="Abrir en el módulo con parámetros guardados">
              Abrir en módulo
            </button>
            ${
              evaluate
                ? `<button type="button" class="works-list2-btn" data-eval="${escapeHtml(w.id)}">
              Detalles
            </button>`
                : ''
            }
            <button type="button" class="works-list2-btn danger" data-del="${escapeHtml(w.id)}">Eliminar</button>
          </div>
        </div>
        <div class="works-list2-sep" aria-hidden="true"></div>`
        )
        .join('')}
    </div>`;

  host.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.open;
      if (typeof window.FisicaHNOpenWork === 'function') {
        window.FisicaHNOpenWork(id);
      } else {
        alert('No se pudo abrir el módulo. Recarga la app.');
      }
    });
  });
  host.querySelectorAll('[data-eval]').forEach((btn) => {
    btn.addEventListener('click', () => showWorkEvaluation(btn.dataset.eval));
  });
  host.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('¿Eliminar este trabajo?')) {
        deleteWork(btn.dataset.del);
        renderWorksList2(host, opts);
        const side = document.getElementById('worksList');
        if (side) renderWorksSidebar(side, opts);
        updateWorksCountBadges();
        openWorksModal._onChanged?.();
      }
    });
  });
}

/** Vista de evaluación del trabajo (para docentes / revisión). */
export function showWorkEvaluation(id) {
  const w = getWork(id);
  if (!w) {
    alert('Trabajo no encontrado.');
    return;
  }
  const lines = [
    '—— Evaluación del trabajo ——',
    `Nombre: ${w.name}`,
    `Módulo: ${w.moduleTitle || w.moduleId}`,
    `Origen: ${categoryLabel(w)}`,
    `Alumno: ${w.studentName || '—'}`,
    `Colegio: ${w.schoolName || '—'}`,
    `Modo: ${w.mode || 'practice'}`,
    w.examCode ? `Código examen: ${w.examCode}` : null,
    `Guardado: ${formatDate(w.savedAt)}`,
    w.importedAt ? `Importado: ${formatDate(w.importedAt)}` : null,
    w._importReason ? `Verificación sello: ${w._importReason}` : null,
    w.integrityWeak ? 'Aviso: sello débil en este navegador' : null,
    w.notes ? `Notas: ${w.notes}` : null,
    w.cloudSynced ? 'Sincronizado en la nube: sí' : null,
    `ID: ${w.id}`,
    w.integrity ? `Sello: ${String(w.integrity).slice(0, 40)}…` : null
  ].filter(Boolean);

  if (w.snapshot && typeof w.snapshot === 'object') {
    try {
      const snap = JSON.stringify(w.snapshot, null, 2);
      lines.push('', '—— Estado del módulo (snapshot) ——', snap.slice(0, 1200) + (snap.length > 1200 ? '\n…' : ''));
    } catch {
      /* ignore */
    }
  }

  alert(lines.join('\n'));
}

export function updateWorksCountBadges() {
  const works = listWorks();
  const imported = works.filter((w) => workOrigin(w) === 'imported').length;
  const saved = works.length - imported;
  document.querySelectorAll('[data-works-count]').forEach((el) => {
    el.textContent = String(works.length);
  });
  document.querySelectorAll('[data-works-saved]').forEach((el) => {
    el.textContent = String(saved);
  });
  document.querySelectorAll('[data-works-imported]').forEach((el) => {
    el.textContent = String(imported);
  });
}

/**
 * @param {{
 *   filter?: 'all'|'saved'|'imported',
 *   hub?: boolean,
 *   onChanged?: () => void
 * }} opts
 * hub=true: módulo Mis trabajos (import/export + código examen online)
 * filter default from sidebar: 'saved'
 */
export function openWorksModal(opts = {}) {
  const initialFilter = opts.filter || (opts.hub ? 'all' : 'saved');
  const hub = Boolean(opts.hub);

  let overlay = document.getElementById('worksModal');
  if (opts.onChanged) openWorksModal._onChanged = opts.onChanged;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'worksModal';
    overlay.className = 'works-modal';
    overlay.innerHTML = `
      <div class="works-modal-card" role="dialog" aria-labelledby="worksModalTitle" aria-modal="true">
        <header class="works-modal-header">
          <div>
            <h2 id="worksModalTitle">Mis trabajos</h2>
            <p class="works-modal-lead">
              <span class="works-modal-counts">
                Total <strong data-works-count>0</strong> ·
                Guardados <strong data-works-saved>0</strong> ·
                Importados <strong data-works-imported>0</strong>
              </span>
            </p>
          </div>
          <button type="button" class="works-modal-close" id="worksModalClose" aria-label="Cerrar">×</button>
        </header>
        <div id="worksExamBar" class="works-exam-bar" hidden>
          <div>
            <strong>Código de examen</strong>
            <p class="works-exam-hint">Solo docentes verificados pueden generar. Alumnos: unirse desde Cuenta.</p>
            <div class="works-exam-code" id="worksExamCode">———</div>
            <p class="works-exam-msg" id="worksExamMsg" hidden></p>
          </div>
          <div class="works-exam-actions">
            <button type="button" class="ctrl-btn primary" id="worksGenExamBtn">Generar código</button>
            <button type="button" class="ctrl-btn" id="worksEndExamBtn">Finalizar</button>
          </div>
        </div>
        <div class="works-modal-filters" role="tablist">
          <button type="button" class="works-filter" data-filter="all">Todos</button>
          <button type="button" class="works-filter" data-filter="saved">Guardados</button>
          <button type="button" class="works-filter" data-filter="imported">Importados</button>
        </div>
        <div id="worksModalList" class="works-modal-body"></div>
        <footer class="works-modal-footer">
          <button type="button" class="ctrl-btn" id="worksModalImport" hidden>Importar JSON</button>
          <button type="button" class="ctrl-btn" id="worksModalExport" hidden>Exportar JSON</button>
          <button type="button" class="ctrl-btn primary" id="worksModalDone">Cerrar</button>
        </footer>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.hidden = true;
      document.body.classList.remove('works-modal-open');
    };
    overlay.querySelector('#worksModalClose').addEventListener('click', close);
    overlay.querySelector('#worksModalDone').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    overlay._filter = 'saved';
    overlay._hub = false;

    const listEl = () => overlay.querySelector('#worksModalList');
    const paint = () => {
      renderWorksList2(listEl(), {
        filter: overlay._filter,
        evaluate: true
      });
      updateWorksCountBadges();
      // filtros UI
      overlay.querySelectorAll('.works-filter').forEach((b) => {
        b.classList.toggle('active', b.dataset.filter === overlay._filter);
      });
      // hub: import/export visibles
      const imp = overlay.querySelector('#worksModalImport');
      const exp = overlay.querySelector('#worksModalExport');
      if (imp) imp.hidden = !overlay._hub;
      if (exp) exp.hidden = !overlay._hub;
      refreshExamBar(overlay);
    };
    overlay._paint = paint;

    overlay.querySelectorAll('.works-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        overlay._filter = btn.dataset.filter || 'all';
        paint();
      });
    });

    overlay.querySelector('#worksModalImport')?.addEventListener('click', () => {
      document.getElementById('importWorksFile')?.click();
    });
    overlay.querySelector('#worksModalExport')?.addEventListener('click', () => {
      const works = listWorks();
      if (!works.length) {
        alert('No hay trabajos para exportar.');
        return;
      }
      const { count, filename } = exportWorksJSON(works);
      alert(`Se descargaron ${count} trabajo(s):\n${filename}`);
    });

    overlay.querySelector('#worksGenExamBtn')?.addEventListener('click', () => generateExamFromHub(overlay));
    overlay.querySelector('#worksEndExamBtn')?.addEventListener('click', () => endExamFromHub(overlay));
  }

  overlay._filter = initialFilter;
  overlay._hub = hub;
  overlay.hidden = false;
  document.body.classList.add('works-modal-open');
  overlay._paint?.();
}

async function refreshExamBar(overlay) {
  const bar = overlay.querySelector('#worksExamBar');
  if (!bar) return;
  if (!overlay._hub) {
    bar.hidden = true;
    return;
  }

  try {
    const { getSession } = await import('./auth.js');
    const session = getSession();
    // Solo docentes ven la barra de crear código
    if (!session || session.role !== 'teacher') {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const { getExamStatus } = await import('./auth.js');
    const st = getExamStatus();
    const codeEl = overlay.querySelector('#worksExamCode');
    if (codeEl) {
      codeEl.textContent =
        st.active && st.code
          ? st.code
          : session.examCode && session.mode === 'exam'
            ? session.examCode
            : '———';
    }
    const hint = overlay.querySelector('.works-exam-hint');
    if (hint) {
      hint.textContent =
        'Solo docentes verificados. Genera un código (en línea) o únete a uno desde Cuenta.';
    }
  } catch {
    bar.hidden = true;
  }
}

async function generateExamFromHub(overlay) {
  const msg = overlay.querySelector('#worksExamMsg');
  const setMsg = (t, ok) => {
    if (!msg) return;
    msg.hidden = !t;
    msg.textContent = t || '';
    msg.className = 'works-exam-msg' + (ok ? ' ok' : ' err');
  };
  setMsg('');

  try {
    const auth = await import('./auth.js');
    const session = auth.getSession();
    if (!session || session.role !== 'teacher') {
      throw new Error('Solo un docente verificado puede crear códigos. Entra en Cuenta → Docente.');
    }
    const code = await auth.createExamCodeOnline();
    const codeEl = overlay.querySelector('#worksExamCode');
    if (codeEl) codeEl.textContent = code;
    setMsg(`Código ${code} activo. Compártelo con la clase (pizarra).`, true);
    window.dispatchEvent(new CustomEvent('fisicahn:session', { detail: auth.getSession() }));
  } catch (e) {
    setMsg(e.message || 'Error al generar código', false);
  }
}

async function endExamFromHub(overlay) {
  try {
    const auth = await import('./auth.js');
    auth.endExamSession();
    const codeEl = overlay.querySelector('#worksExamCode');
    if (codeEl) codeEl.textContent = '———';
    const msg = overlay.querySelector('#worksExamMsg');
    if (msg) {
      msg.hidden = false;
      msg.textContent = 'Examen finalizado.';
      msg.className = 'works-exam-msg ok';
    }
  } catch {
    /* ignore */
  }
}

export function bindWorksPanelControls(handlers = {}) {
  const fileInput = document.getElementById('importWorksFile');
  const viewBtn = document.getElementById('viewWorksListBtn');
  const side = document.getElementById('worksList');

  const refresh = () => {
    if (side) renderWorksSidebar(side);
    updateWorksCountBadges();
    const overlay = document.getElementById('worksModal');
    if (overlay && !overlay.hidden) overlay._paint?.();
    handlers.onChanged?.();
  };

  // Botón opcional (panel derecho eliminado; queda el hub y la barra lateral)
  viewBtn?.addEventListener('click', () => openWorksModal({ filter: 'saved', hub: false }));

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const result = await importWorksJSON(file);
      refresh();
      openWorksModal._onChanged?.();
      if (result.added === 0) {
        alert(`No se añadió ningún trabajo nuevo.\nTotal: ${result.total}`);
      } else {
        alert(`Importados: ${result.added}.\nTotal: ${result.total}`);
        openWorksModal({ filter: 'imported', hub: true });
      }
    } catch (e) {
      console.error(e);
      alert(e?.message || 'No se pudo importar el JSON.');
    }
  });

  refresh();
  return { refresh };
}
