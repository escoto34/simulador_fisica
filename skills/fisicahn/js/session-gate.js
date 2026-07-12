/**
 * Modal de entrada: alumno (USB / local) o docente (email verificado).
 * Los datos de verificación se reutilizan en la sesión del simulador.
 */

import {
  getSession,
  startStudentSession,
  startTeacherSessionVerified,
  getStudentProfile,
  getTeacherRecord,
  getExamStatus,
  getDisplayName,
  logoutSession
} from './auth.js';
import {
  ensureCloudEnabled,
  signInTeacher,
  signUpTeacher,
  getCloudSession,
  signOutCloud
} from './supabase-client.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isDesktopApp() {
  return (
    typeof window !== 'undefined' &&
    (window.FisicaHNDesktop?.isDesktop || document.documentElement.dataset.desktop === '1')
  );
}

/**
 * Abre el gate si no hay sesión. Si force=true, cierra la sesión y vuelve a pedir login.
 * @param {{ force?: boolean }} opts
 * @returns {Promise<object|null>}
 */
export function ensureSessionGate(opts = {}) {
  if (opts.force) {
    logoutSession();
  } else {
    const existing = getSession();
    if (existing && (existing.role === 'student' || existing.role === 'teacher')) {
      return Promise.resolve(existing);
    }
  }

  return new Promise((resolve) => {
    const prev = document.getElementById('sessionGate');
    if (prev) prev.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sessionGate';
    overlay.className = 'session-gate';
    overlay.innerHTML = `
      <div class="session-gate-card" role="dialog" aria-labelledby="gateTitle" aria-modal="true">
        <h2 id="gateTitle">Entrar a FísicaHN</h2>
        <p class="session-gate-lead">
          Identifícate en este equipo. En USB cada alumno inicia sesión aquí con su nombre.
          Los docentes usan el email de verificación (en línea) para crear códigos de examen.
        </p>

        <div class="gate-tabs" role="tablist">
          <button type="button" class="gate-tab active" data-role="student" role="tab" aria-selected="true">Alumno</button>
          <button type="button" class="gate-tab" data-role="teacher" role="tab" aria-selected="false">Docente</button>
        </div>

        <div id="gatePanelStudent" class="gate-panel" data-panel="student">
          <label class="gate-label">Tu nombre
            <input type="text" id="gateName" autocomplete="name" maxlength="80" placeholder="Nombre y apellido">
          </label>
          <label class="gate-label">Colegio
            <input type="text" id="gateSchool" autocomplete="organization" maxlength="120" placeholder="Nombre del colegio">
          </label>
          <fieldset class="gate-mode">
            <legend>Modo</legend>
            <label><input type="radio" name="gateMode" value="practice" checked> Práctica</label>
            <label><input type="radio" name="gateMode" value="exam"> Examen (unirse con código)</label>
          </fieldset>
          <label class="gate-label gate-code" id="gateCodeWrap" hidden>Código de examen
            <input type="text" id="gateCode" inputmode="numeric" maxlength="8" placeholder="Ej. 482910" autocomplete="one-time-code">
          </label>
          <label class="gate-check">
            <input type="checkbox" id="gateRemember" checked>
            Recordarme en este equipo (útil en USB personal)
          </label>
        </div>

        <div id="gatePanelTeacher" class="gate-panel" data-panel="teacher" hidden>
          <p class="gate-teacher-note">
            Requiere internet. Se usan el email y el colegio de tu verificación para crear códigos de examen.
            Los alumnos no pueden crear códigos.
          </p>
          <label class="gate-label">Email
            <input type="email" id="gateEmail" autocomplete="username" maxlength="120" placeholder="docente@colegio.edu">
          </label>
          <label class="gate-label">Contraseña
            <input type="password" id="gatePass" autocomplete="current-password" maxlength="100" placeholder="Mínimo 6 caracteres">
          </label>
          <label class="gate-label">Colegio
            <input type="text" id="gateTeacherSchool" autocomplete="organization" maxlength="120" placeholder="Nombre del colegio">
          </label>
        </div>

        <p class="gate-error" id="gateError" hidden></p>
        <div class="gate-actions">
          <button type="button" class="gate-btn primary" id="gateEnter">Entrar</button>
          <button type="button" class="gate-btn secondary" id="gateRegisterTeacher" hidden>Crear cuenta docente</button>
          <a class="gate-link" href="../index.html" id="gateHomeLink">Volver al sitio</a>
        </div>
        <p class="gate-hint" id="gateHint"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    // Prefill alumno (USB / última sesión)
    const profile = getStudentProfile();
    if (profile?.studentName) {
      overlay.querySelector('#gateName').value = profile.studentName;
    }
    if (profile?.schoolName) {
      overlay.querySelector('#gateSchool').value = profile.schoolName;
    }
    const rec = getTeacherRecord();
    if (rec?.schoolName) {
      const schoolEl = overlay.querySelector('#gateSchool');
      if (schoolEl && !schoolEl.value) schoolEl.value = rec.schoolName;
      overlay.querySelector('#gateTeacherSchool').value = rec.schoolName;
    }
    if (rec?.email) {
      overlay.querySelector('#gateEmail').value = rec.email;
    }
    const cloud = getCloudSession();
    if (cloud?.email && !overlay.querySelector('#gateEmail').value) {
      overlay.querySelector('#gateEmail').value = cloud.email;
    }

    const exam = getExamStatus();
    if (exam.active) {
      overlay.querySelector('#gateHint').textContent =
        `Hay un examen activo en este navegador${exam.schoolName ? ` (“${exam.schoolName}”)` : ''}.`;
    }

    const codeWrap = overlay.querySelector('#gateCodeWrap');
    overlay.querySelectorAll('input[name="gateMode"]').forEach((r) => {
      r.addEventListener('change', () => {
        codeWrap.hidden =
          overlay.querySelector('input[name="gateMode"]:checked')?.value !== 'exam';
      });
    });

    let activeRole = 'student';
    const setRole = (role) => {
      activeRole = role;
      overlay.querySelectorAll('.gate-tab').forEach((t) => {
        const on = t.dataset.role === role;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      overlay.querySelector('#gatePanelStudent').hidden = role !== 'student';
      overlay.querySelector('#gatePanelTeacher').hidden = role !== 'teacher';
      overlay.querySelector('#gateRegisterTeacher').hidden = role !== 'teacher';
      overlay.querySelector('#gateEnter').textContent =
        role === 'teacher' ? 'Entrar como docente' : 'Entrar';
    };
    overlay.querySelectorAll('.gate-tab').forEach((tab) => {
      tab.addEventListener('click', () => setRole(tab.dataset.role || 'student'));
    });

    const home = overlay.querySelector('#gateHomeLink');
    if (isDesktopApp()) {
      home.hidden = true;
      home.removeAttribute('href');
    }

    const err = overlay.querySelector('#gateError');
    const showErr = (msg) => {
      err.textContent = msg || 'No se pudo entrar.';
      err.hidden = false;
    };

    const finish = (session) => {
      overlay.remove();
      window.dispatchEvent(new CustomEvent('fisicahn:session', { detail: session }));
      resolve(session);
    };

    const enterStudent = async () => {
      const mode =
        overlay.querySelector('input[name="gateMode"]:checked')?.value || 'practice';
      return startStudentSession({
        studentName: overlay.querySelector('#gateName').value,
        schoolName: overlay.querySelector('#gateSchool').value,
        mode,
        examCode: overlay.querySelector('#gateCode').value,
        remember: overlay.querySelector('#gateRemember')?.checked !== false
      });
    };

    const enterTeacher = async ({ register }) => {
      const online = await ensureCloudEnabled();
      if (!online) {
        throw new Error(
          'El acceso docente requiere internet y configuración del sitio. Sin red, entra como alumno o usa el panel web cuando haya conexión.'
        );
      }
      const email = overlay.querySelector('#gateEmail').value;
      const pass = overlay.querySelector('#gatePass').value;
      const school = overlay.querySelector('#gateTeacherSchool').value;
      if (!pass || pass.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }
      if (register) {
        await signUpTeacher(email, pass, school);
      } else {
        await signInTeacher(email, pass);
      }
      const cloud = getCloudSession();
      if (!cloud?.access_token) {
        throw new Error(
          'Cuenta creada o pendiente de confirmar email. Revisa tu bandeja y vuelve a entrar.'
        );
      }
      // Guardar colegio en la sesión nube
      cloud.schoolName = school;
      try {
        localStorage.setItem('fisicahn_sb_session_v1', JSON.stringify(cloud));
      } catch {
        /* ignore */
      }
      const session = await startTeacherSessionVerified({
        email: cloud.email || email,
        schoolName: school,
        userId: cloud.user?.id || null
      });
      // Perfil en nube para RLS (school_key del docente)
      try {
        const { upsertTeacherProfile } = await import('./supabase-client.js');
        await upsertTeacherProfile({
          email: session.email,
          schoolName: session.schoolName,
          schoolKey: session.schoolKey
        });
      } catch {
        /* offline / sin tabla */
      }
      return session;
    };

    overlay.querySelector('#gateEnter').addEventListener('click', async () => {
      err.hidden = true;
      try {
        const session =
          activeRole === 'teacher'
            ? await enterTeacher({ register: false })
            : await enterStudent();
        finish(session);
      } catch (e) {
        showErr(e.message);
      }
    });

    overlay.querySelector('#gateRegisterTeacher').addEventListener('click', async () => {
      err.hidden = true;
      try {
        const session = await enterTeacher({ register: true });
        finish(session);
      } catch (e) {
        showErr(e.message);
      }
    });
  });
}

/**
 * Badge compacto de sesión (canvas header).
 */
export function renderSessionBadge(container) {
  const s = getSession();
  if (!container) return;
  if (!s) {
    container.innerHTML = '';
    return;
  }
  const modeLabel =
    s.mode === 'exam' ? 'EXAMEN' : s.role === 'teacher' ? 'DOCENTE' : 'Práctica';
  const name = getDisplayName(s);
  container.innerHTML = `
    <span class="session-badge ${s.mode === 'exam' ? 'exam' : ''} ${s.role === 'teacher' ? 'teacher' : ''}">
      ${escapeHtml(name)} · ${modeLabel}${s.examCode ? ` · ${escapeHtml(s.examCode)}` : ''}
    </span>
  `;
}

/**
 * Chip de usuario en el catálogo + botón Cuenta.
 */
export function renderUserChip(container) {
  if (!container) return;
  const s = getSession();
  if (!s) {
    container.innerHTML = `
      <button type="button" class="user-chip user-chip-login" id="userChipLogin" aria-label="Iniciar sesión">
        Iniciar sesión
      </button>
    `;
    container.querySelector('#userChipLogin')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('fisicahn:open-account'));
    });
    return;
  }
  const roleLabel = s.role === 'teacher' ? 'Docente' : 'Alumno';
  const mode =
    s.mode === 'exam'
      ? `Examen ${s.examCode || ''}`.trim()
      : 'Práctica';
  container.innerHTML = `
    <button type="button" class="user-chip" id="userChipBtn" aria-label="Abrir cuenta de usuario" title="Cuenta y examen">
      <span class="user-chip-role">${escapeHtml(roleLabel)}</span>
      <span class="user-chip-name">${escapeHtml(getDisplayName(s))}</span>
      <span class="user-chip-mode ${s.mode === 'exam' ? 'exam' : ''}">${escapeHtml(mode)}</span>
    </button>
  `;
  container.querySelector('#userChipBtn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('fisicahn:open-account'));
  });
}

export { logoutSession, getCloudSession, signOutCloud };
