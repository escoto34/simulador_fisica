/**
 * Trabajos del alumno:
 * - Web: localStorage
 * - Electron: archivo en userData vía IPC (fiable) + espejo localStorage
 */

import { sha256, getSession, logAudit, normalizeSchool } from './auth.js';

const WORKS_KEY = 'fisicahn_works_v1';

/** @type {Array|null} caché en memoria (fuente de verdad en runtime) */
let memoryList = null;
let hydrated = false;
let hydratePromise = null;

function isDesktopFile() {
  return Boolean(
    typeof window !== 'undefined' &&
      window.FisicaHNDesktop?.isDesktop &&
      typeof window.FisicaHNDesktop.loadWorks === 'function' &&
      typeof window.FisicaHNDesktop.saveWorks === 'function'
  );
}

function storageAvailable() {
  try {
    const k = '__fisicahn_ls_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readLocalStorage() {
  try {
    const raw = localStorage.getItem(WORKS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeLocalStorage(list) {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(WORKS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * Carga la caché al arrancar (imprescindible en Electron).
 * Llamar desde app.init().
 */
export async function initWorksStorage() {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    if (isDesktopFile()) {
      try {
        const fromFile = await window.FisicaHNDesktop.loadWorks();
        if (Array.isArray(fromFile) && fromFile.length) {
          memoryList = fromFile;
        } else {
          // Migrar desde localStorage si el archivo está vacío
          const fromLs = readLocalStorage();
          memoryList = fromLs;
          if (fromLs.length) {
            await window.FisicaHNDesktop.saveWorks(fromLs);
          }
        }
      } catch (e) {
        console.warn('Electron works load failed, using localStorage', e);
        memoryList = readLocalStorage();
      }
    } else {
      memoryList = readLocalStorage();
    }
    hydrated = true;
    return memoryList;
  })();
  return hydratePromise;
}

export function listWorks() {
  if (memoryList) return memoryList.slice();
  // Antes de hydrate: leer LS síncrono
  return readLocalStorage();
}

async function persistAll(list) {
  memoryList = Array.isArray(list) ? list : [];
  let ok = false;
  let detail = '';

  if (isDesktopFile()) {
    try {
      const res = await window.FisicaHNDesktop.saveWorks(memoryList);
      if (res && res.ok === false) {
        detail = res.error || 'Error al escribir archivo de trabajos';
      } else {
        ok = true;
      }
    } catch (e) {
      detail = e?.message || String(e);
    }
  }

  // Espejo localStorage (web y respaldo Electron)
  const lsOk = writeLocalStorage(memoryList);
  if (lsOk) ok = true;

  if (!ok) {
    throw new Error(
      detail ||
        'No se pudo guardar. En Electron comprueba permisos de userData; en web desactiva modo privado.'
    );
  }

  // Verificar lectura
  if (isDesktopFile()) {
    try {
      const again = await window.FisicaHNDesktop.loadWorks();
      if (Array.isArray(again) && again.length !== memoryList.length) {
        // no bloquear si el archivo se escribió pero load difiere por carrera
        console.warn('works verify length', again.length, memoryList.length);
      }
    } catch {
      /* ignore */
    }
  }
}

function saveAll(list) {
  // API síncrona legacy: actualiza memoria + best-effort LS; dispara persist async
  memoryList = Array.isArray(list) ? list : [];
  writeLocalStorage(memoryList);
  if (isDesktopFile()) {
    window.FisicaHNDesktop.saveWorks(memoryList).catch((e) =>
      console.error('saveWorks async', e)
    );
  } else if (!storageAvailable()) {
    throw new Error(
      'Este navegador bloquea localStorage (modo privado o permisos).'
    );
  }
  // Verificación LS solo en web
  if (!isDesktopFile()) {
    const check = readLocalStorage();
    if (check.length !== memoryList.length) {
      throw new Error('No se pudo verificar el guardado en localStorage.');
    }
  }
}

function payloadForHash(work) {
  return JSON.stringify({
    id: work.id,
    name: work.name,
    moduleId: work.moduleId,
    moduleTitle: work.moduleTitle,
    studentName: work.studentName,
    schoolName: work.schoolName,
    schoolKey: work.schoolKey,
    mode: work.mode,
    examCode: work.examCode || null,
    savedAt: work.savedAt,
    snapshot: work.snapshot,
    notes: work.notes || ''
  });
}

export async function computeIntegrity(work) {
  return sha256(payloadForHash(work));
}

export async function verifyWork(work) {
  if (!work || !work.integrity) return { ok: false, reason: 'Sin sello' };
  if (String(work.integrity).startsWith('unsigned_')) {
    return { ok: true, reason: 'Sello débil (cliente)' };
  }
  const expected = await computeIntegrity(work);
  return {
    ok: expected === work.integrity,
    reason: expected === work.integrity ? 'OK' : 'Sello alterado (posible edición manual)'
  };
}

/**
 * Guarda un trabajo nombrado del módulo actual.
 */
export async function saveWork(data) {
  await initWorksStorage();

  const session = getSession();
  const name = String(data.name || '').trim();
  if (name.length < 1) throw new Error('Pon un nombre al trabajo.');
  if (!data.moduleId) throw new Error('Módulo no identificado.');

  const studentName =
    session?.studentName ||
    session?.email ||
    data.studentName ||
    (session?.role === 'teacher' ? 'Docente' : 'Anónimo');
  const schoolName = session?.schoolName || data.schoolName || 'Sin colegio';
  const mode = session?.mode || 'practice';
  const examCode = session?.examCode || data.examCode || null;

  const work = {
    id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    moduleId: data.moduleId,
    moduleTitle: data.moduleTitle || data.moduleId,
    studentName,
    schoolName,
    schoolKey: normalizeSchool(schoolName),
    mode,
    examCode,
    savedAt: new Date().toISOString(),
    snapshot: data.snapshot || {},
    notes:
      data.notes ||
      (mode === 'exam'
        ? `Examen código ${examCode || '?'}`
        : isDesktopFile()
          ? 'Guardado en app de escritorio'
          : ''),
    integrity: '',
    source: 'local',
    platform: isDesktopFile() ? 'electron' : 'web'
  };

  try {
    work.integrity = await computeIntegrity(work);
  } catch (err) {
    console.warn('Integrity hash falló; se guarda sin sello fuerte:', err);
    work.integrity = `unsigned_${work.id}_${work.savedAt}`;
    work.integrityWeak = true;
  }

  const list = listWorks();
  list.unshift(work);
  while (list.length > 200) list.pop();
  await persistAll(list);
  logAudit('work_save', {
    id: work.id,
    name: work.name,
    moduleId: work.moduleId,
    mode,
    desktop: isDesktopFile()
  });

  try {
    const { uploadWorkToCloud } = await import('./supabase-client.js');
    const cloud = await uploadWorkToCloud({
      ...work,
      hash: work.integrity
    });
    if (cloud.ok) {
      work.cloudSynced = true;
      // re-persist con flag nube
      const again = listWorks().map((w) => (w.id === work.id ? { ...w, cloudSynced: true } : w));
      await persistAll(again);
      logAudit('work_cloud_sync', { id: work.id });
    } else if (!cloud.skipped) {
      logAudit('work_cloud_sync_fail', { id: work.id, error: cloud.error || 'unknown' });
    }
  } catch {
    /* sin nube */
  }

  return work;
}

export function deleteWork(id) {
  const list = listWorks().filter((w) => w.id !== id);
  saveAll(list);
  if (isDesktopFile()) {
    window.FisicaHNDesktop.saveWorks(list).catch(() => {});
  }
  logAudit('work_delete', { id });
}

export function getWork(id) {
  return listWorks().find((w) => w.id === id) || null;
}

export function worksForSchool(schoolName) {
  const key = normalizeSchool(schoolName);
  return listWorks().filter((w) => w.schoolKey === key);
}

export function exportWorksJSON(works) {
  const list = Array.isArray(works) ? works : listWorks();
  const filename = `fisicahn-trabajos-${Date.now()}.json`;
  const payload = JSON.stringify(list, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { count: list.length, filename };
}

export async function importWorksJSON(file) {
  await initWorksStorage();
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const incoming = Array.isArray(data) ? data : data?.works;
  if (!Array.isArray(incoming)) {
    throw new Error('JSON inválido: se esperaba un array de trabajos o { "works": [...] }.');
  }
  if (incoming.length === 0) {
    return { added: 0, total: listWorks().length, skipped: 0 };
  }

  const list = listWorks();
  const ids = new Set(list.map((w) => w.id));
  let added = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') {
      skipped++;
      continue;
    }
    const w = { ...raw };
    if (!w.id) {
      w.id = `w_imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    if (ids.has(w.id)) {
      skipped++;
      continue;
    }
    if (!w.name) w.name = w.moduleTitle || w.moduleId || 'Trabajo importado';
    if (!w.savedAt) w.savedAt = now;

    let check = { ok: false, reason: 'Sin sello' };
    try {
      check = await verifyWork(w);
    } catch {
      check = { ok: false, reason: 'No se pudo verificar el sello' };
    }
    w._importVerified = check.ok;
    w._importReason = check.reason;
    w.source = 'imported';
    w.importedAt = now;

    list.unshift(w);
    ids.add(w.id);
    added++;
  }

  await persistAll(list);
  logAudit('work_import', { added, skipped });
  return { added, skipped, total: list.length };
}
