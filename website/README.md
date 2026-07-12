# FísicaHN — sitio web

Carpeta de publicación para **GitHub Pages** o **Cloudflare Pages**.  
El laboratorio embebido es una **copia** de `skills/fisicahn/` (no es la fuente).

## Contenido

| Ruta | Uso |
|------|-----|
| `/` | Landing: entrada alumno, módulos, descargas, docentes, ideas |
| `/teacher.html` | Acceso docente (email + colegio, en línea) |
| `/sim/` | Laboratorio completo (catálogo, cuenta, trabajos, pizarra) |
| `/downloads/fisicahn.zip` | Offline / USB (~160 KB; se regenera en cada build) |
| `/assets/` | Logo y favicon |
| `/_headers` | Cabeceras de seguridad (CSP, X-Frame-Options, …) |
| `/js/supabase-config.example.js` | Plantilla de config en línea (anon key) |

## Build (desde la raíz del repo)

```bash
./scripts/build-website.sh
```

Hace:

1. `skills/fisicahn/` → `website/sim/`
2. Copia `website/js/supabase-config.js` → `sim/js/` si existe (para ZIP con red)
3. Regenera `downloads/fisicahn.zip` (`zip` o **Python** si no hay `zip` en el PATH)

Servir en local (necesario para ES modules):

```bash
cd website && python3 -m http.server 8080
# http://127.0.0.1:8080/   y   /sim/
```

## Funciones del lab (resumen)

- Login **alumno** (USB/PC) y **docente** (email en línea)
- Códigos de examen: crear (docente) / unirse (todos)
- **Mis trabajos**: Abrir en módulo, detalles, import/export JSON
- En Electron los trabajos van a archivo en userData; en web a `localStorage`
- Módulos de cinemática a física atómica y de partículas, pizarra, etc.

## Config en línea (opcional)

```bash
cp js/supabase-config.example.js js/supabase-config.js
# Rellenar url + anonKey  (nunca service_role)
./scripts/build-website.sh   # desde la raíz del monorepo
```

`supabase-config.js` está en **`.gitignore`**. En CI usa secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

Documentación: `docs/SUPABASE_GITHUB_PAGES.md`, `docs/SECURITY.md`, `supabase/schema.sql`.

## Desktop

La app de escritorio no se sirve desde esta carpeta. Ver `desktop/` y el README raíz.  
Uso medido en desarrollo: del orden de **90–100 MB de RAM** con Electron abierto.
