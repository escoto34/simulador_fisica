/**
 * Panel docente: acceso con email (en línea).
 */
import {
  getTeacherRecord,
  registerTeacher,
  loginTeacher,
  logoutSession,
  getSession,
  startExamSession,
  endExamSession,
  getExamStatus,
  normalizeSchool
} from './auth.js';
import { listWorks, worksForSchool, exportWorksJSON, importWorksJSON, verifyWork, getWork } from './works.js';
import {
  isCloudEnabled,
  signInTeacher,
  signUpTeacher,
  signOutCloud,
  getCloudSession,
  pushExam,
  fetchSchoolWorks,
  upsertTeacherProfile
} from './supabase-api.js';

const authPanel = document.getElementById('authPanel');
const dashPanel = document.getElementById('dashPanel');
const authMsg = document.getElementById('authMsg');
const dashMsg = document.getElementById('dashMsg');
const examMsg = document.getElementById('examMsg');

function setMsg(el, text, ok) {
  if (!el) return;
  el.textContent = text || '';
  el.className = 'form-msg' + (text ? (ok ? ' ok' : ' err') : '');
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showDash() {
  const session = getSession();
  const cloud = getCloudSession();
  const ok = cloud?.access_token && session?.role === 'teacher';
  if (!ok) {
    authPanel.classList.remove('hidden');
    dashPanel.classList.add('hidden');
    return;
  }
  authPanel.classList.add('hidden');
  dashPanel.classList.remove('hidden');
  const school = session?.schoolName || cloud?.schoolName || '—';
  document.getElementById('dashSchool').textContent = `Colegio: ${school}`;
  document.getElementById('dashEmail').textContent = `Email: ${cloud.email || '—'}`;
  refreshExam();
  refreshWorks();
}

function refreshExam() {
  const st = getExamStatus();
  document.getElementById('examCodeDisplay').textContent =
    st.active && st.code ? st.code : '———';
}

function formatWorkDetail(w, sealText) {
  return [
    `Alumno: ${w.studentName || '—'}`,
    `Trabajo: ${w.name || '—'}`,
    `Módulo: ${w.moduleTitle || w.moduleId || '—'}`,
    `Colegio: ${w.schoolName || '—'}`,
    `Modo: ${w.mode || 'practice'}${w.examCode ? ` · código ${w.examCode}` : ''}`,
    `Fecha: ${w.savedAt ? new Date(w.savedAt).toLocaleString() : '—'}`,
    `Sello: ${sealText || '—'}`,
    w.notes ? `Notas: ${w.notes}` : null,
    w.snapshot ? `Snapshot: ${JSON.stringify(w.snapshot).slice(0, 400)}…` : null
  ]
    .filter(Boolean)
    .join('\n');
}

async function refreshWorks() {
  const session = getSession();
  const cloud = getCloudSession();
  const body = document.getElementById('worksBody');
  let works = listWorks();
  const schoolKey =
    session?.schoolKey ||
    normalizeSchool(session?.schoolName || getTeacherRecord()?.schoolName || '');

  if (schoolKey) {
    const schoolWorks = worksForSchool(session?.schoolName || getTeacherRecord()?.schoolName);
    works = works.filter(
      (w) => w.schoolKey === schoolKey || w._importVerified !== undefined
    );
    if (!works.length) works = schoolWorks;
  }

  if (cloud?.access_token && schoolKey) {
    try {
      const remote = await fetchSchoolWorks(schoolKey);
      for (const row of remote) {
        const payload = row.payload || {};
        const id = payload.id || row.local_id || row.id;
        if (!works.some((w) => w.id === id)) {
          works.push({
            id,
            name: payload.name || 'Trabajo nube',
            studentName: row.student_name || payload.studentName,
            moduleTitle: row.module_title || payload.moduleTitle,
            mode: row.mode || payload.mode,
            examCode: row.exam_code,
            savedAt: row.created_at,
            integrity: row.integrity_hash,
            schoolKey: row.school_key,
            notes: payload.notes,
            snapshot: payload.snapshot,
            _fromCloud: true
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!works.length) {
    body.innerHTML =
      '<tr><td colspan="7" class="muted">Sin trabajos. Los alumnos guardan con el código de examen en línea.</td></tr>';
    return;
  }

  const rows = [];
  for (const w of works.slice(0, 100)) {
    let sealText = 'ok';
    let seal = '<span class="badge ok">ok</span>';
    if (w._fromCloud) {
      sealText = 'nube';
      seal = '<span class="badge ok">nube</span>';
    } else {
      const check = await verifyWork(w);
      sealText = w._importReason || check.reason || 'ok';
      seal =
        w._importVerified === false || !check.ok
          ? `<span class="badge warn">${esc(sealText)}</span>`
          : `<span class="badge ok">válido</span>`;
    }
    rows.push(`
      <tr>
        <td>${esc(w.studentName)}</td>
        <td>${esc(w.name)}</td>
        <td>${esc(w.moduleTitle || w.moduleId)}</td>
        <td>${
          w.mode === 'exam'
            ? `<span class="badge exam">examen ${esc(w.examCode || '')}</span>`
            : 'práctica'
        }</td>
        <td class="mono">${esc(new Date(w.savedAt).toLocaleString())}</td>
        <td>${seal}</td>
        <td><button type="button" class="btn btn-secondary btn-sm" data-eval="${esc(w.id)}" data-seal="${esc(sealText)}">Ver</button></td>
      </tr>
    `);
  }
  body.innerHTML = rows.join('');
  body.querySelectorAll('[data-eval]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = works.find((x) => x.id === btn.dataset.eval) || getWork(btn.dataset.eval);
      if (!w) {
        alert('Trabajo no encontrado');
        return;
      }
      alert('Evaluación del trabajo\n\n' + formatWorkDetail(w, btn.dataset.seal));
    });
  });
}

document.getElementById('authForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg(authMsg, '');
  if (!isCloudEnabled()) {
    setMsg(
      authMsg,
      'El acceso en línea no está configurado en este despliegue. ' +
        'El administrador debe definir SUPABASE_URL y SUPABASE_ANON_KEY ' +
        '(GitHub → Settings → Secrets and variables → Actions) y volver a publicar, ' +
        'o crear website/js/supabase-config.js en local y servir desde website/.',
      false
    );
    return;
  }
  const school = document.getElementById('tSchool').value;
  const pass = document.getElementById('tPass').value;
  const email = document.getElementById('tEmail').value;
  try {
    await signInTeacher(email, pass);
    try {
      await loginTeacher(school, pass);
    } catch {
      await registerTeacher(school, pass);
      await loginTeacher(school, pass);
    }
    const cs = getCloudSession();
    if (cs) {
      cs.schoolName = school;
      localStorage.setItem('fisicahn_sb_session_v1', JSON.stringify(cs));
    }
    try {
      const rec = getTeacherRecord();
      await upsertTeacherProfile({
        email: cs?.email,
        schoolName: school,
        schoolKey: rec?.schoolKey || normalizeSchool(school)
      });
    } catch {
      /* ignore */
    }
    setMsg(authMsg, 'Sesión iniciada.', true);
    showDash();
  } catch (err) {
    setMsg(authMsg, err.message, false);
  }
});

document.getElementById('btnRegister')?.addEventListener('click', async () => {
  setMsg(authMsg, '');
  if (!isCloudEnabled()) {
    setMsg(
      authMsg,
      'El acceso en línea no está configurado en este despliegue. ' +
        'Faltan las claves del backend (SUPABASE_URL + SUPABASE_ANON_KEY en secrets de GitHub Actions, ' +
        'o supabase-config.js en desarrollo local).',
      false
    );
    return;
  }
  const school = document.getElementById('tSchool').value;
  const pass = document.getElementById('tPass').value;
  const email = document.getElementById('tEmail').value;
  try {
    if (pass.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    await signUpTeacher(email, pass, school);
    await registerTeacher(school, pass);
    await loginTeacher(school, pass);
    try {
      const rec = getTeacherRecord();
      const cs = getCloudSession();
      await upsertTeacherProfile({
        email: cs?.email || email,
        schoolName: school,
        schoolKey: rec?.schoolKey || normalizeSchool(school)
      });
    } catch {
      /* ignore */
    }
    setMsg(
      authMsg,
      'Cuenta creada. Si debes confirmar el email, revisa tu bandeja antes de generar códigos de examen.',
      true
    );
    showDash();
  } catch (err) {
    setMsg(authMsg, err.message, false);
  }
});

document.getElementById('btnLogout')?.addEventListener('click', () => {
  logoutSession();
  signOutCloud();
  showDash();
});

document.getElementById('btnStartExam')?.addEventListener('click', async () => {
  setMsg(examMsg, '');
  const cloud = getCloudSession();
  if (!cloud?.access_token) {
    setMsg(examMsg, 'Debes iniciar sesión con email para generar un código en línea.', false);
    return;
  }
  try {
    if (!getSession() || getSession().role !== 'teacher') {
      const rec = getTeacherRecord();
      if (!rec) throw new Error('Falta el colegio en la sesión. Vuelve a iniciar sesión.');
      localStorage.setItem(
        'fisicahn_session_v1',
        JSON.stringify({
          role: 'teacher',
          schoolName: rec.schoolName,
          schoolKey: rec.schoolKey,
          loggedAt: new Date().toISOString()
        })
      );
    }
    const code = startExamSession();
    const rec = getTeacherRecord();
    const cloudPush = await pushExam({
      schoolKey: rec.schoolKey,
      schoolName: rec.schoolName,
      code
    });
    refreshExam();
    if (!cloudPush.ok) {
      endExamSession();
      refreshExam();
      throw new Error(
        cloudPush.error ||
          'No se pudo publicar el código en la nube. Revisa la conexión e inténtalo de nuevo.'
      );
    }
    setMsg(
      examMsg,
      `Código ${code} activo en la nube. Escríbelo en la pizarra; los alumnos lo usan en modo Examen.`,
      true
    );
  } catch (err) {
    setMsg(examMsg, err.message, false);
  }
});

document.getElementById('btnEndExam')?.addEventListener('click', () => {
  endExamSession();
  refreshExam();
  setMsg(examMsg, 'Examen finalizado en este equipo.', true);
});

document.getElementById('btnRefresh')?.addEventListener('click', () => refreshWorks());
document.getElementById('btnExport')?.addEventListener('click', () => {
  exportWorksJSON(listWorks());
});
document.getElementById('importFile')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const r = await importWorksJSON(file);
    setMsg(dashMsg, `Importados: ${r.added}. Total: ${r.total}`, true);
    refreshWorks();
  } catch (err) {
    setMsg(dashMsg, err.message, false);
  }
});

showDash();
