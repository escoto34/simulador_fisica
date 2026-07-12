/**
 * Cliente ligero de Supabase para FísicaHN (solo anon key en el frontend).
 * Sin config → modo offline local (localStorage). Nunca uses la service_role aquí.
 */

const CONFIG_CANDIDATES = [
  // Servido desde website/sim/ → website/js/supabase-config.js
  '../../js/supabase-config.js',
  // Copia local opcional junto al sim (USB / dev)
  './supabase-config.js'
];

let _config = null;
let _configPromise = null;
let _lastProbe = null;

function isConfigured(cfg) {
  return Boolean(
    cfg &&
      typeof cfg.url === 'string' &&
      cfg.url.startsWith('https://') &&
      typeof cfg.anonKey === 'string' &&
      cfg.anonKey.length > 20 &&
      !cfg.anonKey.includes('YOUR_') &&
      !cfg.url.includes('YOUR_')
  );
}

/**
 * Carga config desde window.__FISICAHN_SUPABASE__ o módulos candidatos.
 */
export async function loadSupabaseConfig() {
  if (_config) return _config;
  if (_configPromise) return _configPromise;

  _configPromise = (async () => {
    if (typeof window !== 'undefined' && window.__FISICAHN_SUPABASE__) {
      _config = normalizeConfig(window.__FISICAHN_SUPABASE__);
      return _config;
    }

    for (const path of CONFIG_CANDIDATES) {
      try {
        const mod = await import(/* @vite-ignore */ path);
        const raw = mod.default || mod.config || mod;
        const cfg = normalizeConfig(raw);
        if (isConfigured(cfg) || (cfg && cfg.url)) {
          _config = cfg;
          return _config;
        }
      } catch {
        /* siguiente candidato */
      }
    }

    _config = { url: '', anonKey: '', enabled: false };
    return _config;
  })();

  return _configPromise;
}

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return { url: '', anonKey: '', enabled: false };
  }
  const url = String(raw.url || raw.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = String(raw.anonKey || raw.anon_key || raw.SUPABASE_ANON_KEY || '');
  const enabled = raw.enabled !== false && isConfigured({ url, anonKey });
  return { url, anonKey, enabled };
}

export function isSupabaseEnabled(cfg) {
  return isConfigured(cfg || _config);
}

/**
 * Comprueba red del navegador + (si hay config) alcance a Supabase REST.
 * @returns {Promise<{ browserOnline: boolean, configured: boolean, cloud: boolean, status: string, message: string, latencyMs: number|null }>}
 */
export async function probeConnectivity(opts = {}) {
  const force = Boolean(opts.force);
  const now = Date.now();
  if (!force && _lastProbe && now - _lastProbe.at < 4000) {
    return _lastProbe.result;
  }

  const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const cfg = await loadSupabaseConfig();
  const configured = isConfigured(cfg);

  if (!browserOnline) {
    const result = {
      browserOnline: false,
      configured,
      cloud: false,
      status: 'offline',
      message: 'Sin conexión a internet',
      latencyMs: null
    };
    _lastProbe = { at: now, result };
    return result;
  }

  if (!configured) {
    const result = {
      browserOnline: true,
      configured: false,
      cloud: false,
      status: 'local',
      message: 'En línea (solo local — Supabase no configurado)',
      latencyMs: null
    };
    _lastProbe = { at: now, result };
    return result;
  }

  const t0 = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 8000);
    const res = await fetch(`${cfg.url}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: 'application/json'
      },
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - t0);
    // 2xx, 3xx, 401/404 cuentan como “llegó al proyecto”
    const reachable = res.status > 0 && res.status < 500;
    const result = {
      browserOnline: true,
      configured: true,
      cloud: reachable,
      status: reachable ? 'cloud' : 'error',
      message: reachable
        ? `Conectado a Supabase (${latencyMs} ms)`
        : `Supabase respondió ${res.status}`,
      latencyMs
    };
    _lastProbe = { at: Date.now(), result };
    return result;
  } catch (err) {
    const result = {
      browserOnline: true,
      configured: true,
      cloud: false,
      status: 'error',
      message: err?.name === 'AbortError' ? 'Tiempo de espera agotado' : 'No se pudo contactar Supabase',
      latencyMs: null
    };
    _lastProbe = { at: Date.now(), result };
    return result;
  }
}

/** Headers REST para PostgREST (anon). */
export async function supabaseHeaders() {
  const cfg = await loadSupabaseConfig();
  if (!isConfigured(cfg)) return null;
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
}

/**
 * Inserta un trabajo en student_works si hay cloud. Falla en silencio si no aplica.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, data?: unknown, error?: string }>}
 */
export async function uploadWorkToCloud(work) {
  const probe = await probeConnectivity();
  if (!probe.cloud) return { ok: false, skipped: true, error: probe.message };

  const cfg = await loadSupabaseConfig();
  const headers = await supabaseHeaders();
  if (!headers) return { ok: false, skipped: true, error: 'Sin config' };

  const row = {
    local_id: work.id || null,
    student_name: work.studentName || work.student_name || null,
    school_name: work.schoolName || work.school_name || null,
    school_key: work.schoolKey || work.school_key || null,
    exam_code: work.examCode || work.exam_code || null,
    module_id: work.moduleId || work.module_id || null,
    module_title: work.moduleTitle || work.module_title || null,
    mode: work.mode || 'practice',
    payload: work,
    integrity_hash: work.hash || work.integrity_hash || null,
    created_at: work.savedAt || work.created_at || new Date().toISOString()
  };

  try {
    const res = await fetch(`${cfg.url}/rest/v1/student_works`, {
      method: 'POST',
      headers,
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json().catch(() => null);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

export function clearProbeCache() {
  _lastProbe = null;
}

/**
 * Valida un código de examen activo en Supabase (si hay config).
 * Reexportado para auth del sim vía import dinámico.
 */
export async function validateExamCode(code) {
  const cfg = await loadSupabaseConfig();
  if (!isConfigured(cfg)) return { ok: true, cloud: false };
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/exams?code=eq.${encodeURIComponent(code)}&active=eq.true&select=code,school_key,active&limit=1`,
      {
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
          Accept: 'application/json'
        }
      }
    );
    if (!res.ok) return { ok: true, cloud: false };
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) {
      return { ok: true, cloud: true, found: false };
    }
    return { ok: true, cloud: true, found: true, exam: rows[0] };
  } catch {
    return { ok: true, cloud: false };
  }
}

/* ─── Auth nube (docente) y exámenes — usable desde el simulador / USB ─── */

const CLOUD_SESSION_KEY = 'fisicahn_sb_session_v1';

export function isCloudEnabled() {
  // Si aún no se cargó config, solo mira window / valor en memoria
  if (!_config && typeof window !== 'undefined' && window.__FISICAHN_SUPABASE__) {
    return isConfigured(normalizeConfig(window.__FISICAHN_SUPABASE__));
  }
  return isConfigured(_config);
}

export async function ensureCloudEnabled() {
  const cfg = await loadSupabaseConfig();
  return isConfigured(cfg);
}

export function getCloudSession() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setCloudSession(sess) {
  if (!sess) localStorage.removeItem(CLOUD_SESSION_KEY);
  else localStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(sess));
}

export function signOutCloud() {
  setCloudSession(null);
}

async function authHeaders(accessToken = null) {
  const cfg = await loadSupabaseConfig();
  if (!isConfigured(cfg)) return null;
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${accessToken || cfg.anonKey}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Inicio de sesión docente con email (verificación en la nube).
 * @returns {Promise<{ access_token: string, user: object, email: string }>}
 */
export async function signInTeacher(email, password) {
  const cfg = await loadSupabaseConfig();
  if (!isConfigured(cfg)) {
    throw new Error(
      'Acceso en línea no configurado en este equipo. Usa el sitio web o pide al administrador la config.'
    );
  }
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      email: String(email).trim(),
      password
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Credenciales incorrectas');
  }
  const sess = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: data.user,
    email: data.user?.email || email,
    expires_at: data.expires_at
  };
  setCloudSession(sess);
  return sess;
}

/**
 * Registro docente (email). Puede requerir confirmar correo.
 */
export async function signUpTeacher(email, password, schoolName) {
  const cfg = await loadSupabaseConfig();
  if (!isConfigured(cfg)) {
    throw new Error('Acceso en línea no configurado en este equipo.');
  }
  const res = await fetch(`${cfg.url}/auth/v1/signup`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      email: String(email).trim(),
      password,
      data: { school_name: schoolName, role: 'teacher' }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.error || `HTTP ${res.status}`);
  }
  if (data.access_token) {
    setCloudSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user,
      email: data.user?.email || email,
      schoolName
    });
  }
  return data;
}

/**
 * Upsert del perfil docente (necesario para RLS por school_key).
 * @param {{ schoolName: string, schoolKey: string, email?: string }} profile
 */
export async function upsertTeacherProfile(profile) {
  const cfg = await loadSupabaseConfig();
  if (!isConfigured(cfg)) return { ok: false, skipped: true };
  const sess = getCloudSession();
  if (!sess?.access_token || !sess?.user?.id) {
    return { ok: false, error: 'Sin sesión' };
  }
  const schoolKey = String(profile.schoolKey || '').trim();
  const schoolName = String(profile.schoolName || '').trim();
  if (schoolKey.length < 2) return { ok: false, error: 'school_key inválido' };

  const row = {
    id: sess.user.id,
    email: profile.email || sess.email || null,
    school_name: schoolName,
    school_key: schoolKey,
    updated_at: new Date().toISOString()
  };

  try {
    const res = await fetch(`${cfg.url}/rest/v1/teacher_profiles`, {
      method: 'POST',
      headers: {
        ...(await authHeaders(sess.access_token)),
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: t || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/** Publica un código de examen activo (requiere token de docente). */
export async function pushExam({ schoolKey, schoolName, code }) {
  const cfg = await loadSupabaseConfig();
  if (!isConfigured(cfg)) return { ok: false, skipped: true, error: 'Sin config en línea' };
  const sess = getCloudSession();
  const token = sess?.access_token;
  if (!token) return { ok: false, error: 'Sesión docente requerida' };

  try {
    await fetch(
      `${cfg.url}/rest/v1/exams?school_key=eq.${encodeURIComponent(schoolKey)}&active=eq.true`,
      {
        method: 'PATCH',
        headers: {
          ...(await authHeaders(token)),
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ active: false, ended_at: new Date().toISOString() })
      }
    );
  } catch {
    /* best-effort */
  }

  const res = await fetch(`${cfg.url}/rest/v1/exams`, {
    method: 'POST',
    headers: {
      ...(await authHeaders(token)),
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      school_key: schoolKey,
      code: String(code),
      active: true,
      created_by: sess?.user?.id || null
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return { ok: false, error: t || `HTTP ${res.status}` };
  }
  return { ok: true, data: await res.json().catch(() => null) };
}
