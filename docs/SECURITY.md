# Seguridad en producción — FísicaHN

Checklist frente a errores frecuentes en apps hechas con IA (Supabase / frontend).

## Hecho en este proyecto

| Riesgo común (IA / vibe-coding) | Estado en FísicaHN |
|---------------------------------|--------------------|
| **service_role en el frontend** | No se usa; solo anon en config |
| **RLS desactivado** | RLS activado en todas las tablas del schema |
| **Políticas `WITH CHECK (true)` abiertas** | Endurecidas en `supabase/schema.sql` (re-ejecutar en SQL Editor) |
| **SELECT de trabajos por cualquier autenticado** | Solo docentes con el mismo `school_key` en `teacher_profiles` |
| **Funciones SECURITY DEFINER públicas** | `rls_auto_enable` revocada si existe |
| **Secrets en el repo** | `supabase-config.js` en `.gitignore`; secrets en GitHub Actions |
| **XSS en listas de trabajos** | Escape HTML en paneles (`escapeHtml` / `esc`) |
| **Electron: nodeIntegration** | `false` + `contextIsolation` + `sandbox` |
| **Cabeceras HTTP** | `website/_headers` (CSP, X-Frame-Options, nosniff) |

## Qué debes hacer al desplegar

1. SQL Editor → ejecutar de nuevo **`supabase/schema.sql`** (políticas nuevas).
2. Auth: confirmar email de docentes si lo tienes activado.
3. Secrets de Pages: solo `SUPABASE_URL` + `SUPABASE_ANON_KEY`.
4. No pegar nunca la **service_role** en el chat, el ZIP ni el Electron.

## Limitaciones honestas

- El **anon key es pública** por diseño (va en el navegador). La seguridad real es **RLS**.
- Códigos de examen en modo pizarra offline no son criptografía fuerte: reducen trampas casuales.
- El hash de trabajos es sello de integridad en cliente, no un servidor de confianza absoluto.

## Tras cambios de RLS

Si “generar código” o “ver trabajos en la nube” falla:

1. El docente debe iniciar sesión de nuevo (upsert de `teacher_profiles` con `school_key`).
2. Comprueba en Table Editor que el perfil tiene `school_key` relleno.
