<p align="center">
  <img src="website/assets/logo.svg" width="72" height="72" alt="FísicaHN">
</p>

<h1 align="center">FísicaHN</h1>
<p align="center">
  <strong>Laboratorio virtual de física para el aula</strong><br>
  JavaScript puro · HTML5 Canvas · web / ZIP / escritorio · listo para clase
</p>

<p align="center">
  <a href="https://github.com/escoto34/FisicaHN">github.com/escoto34/FisicaHN</a>
</p>

---

## Estado

El producto está **listo para usar** en tres formas:

| Entrega | Cómo | Notas medidas |
|---------|------|----------------|
| **Web** | `website/` (Pages o servidor local) | Landing + lab + docentes |
| **ZIP** | `website/downloads/fisicahn.zip` (~160 KB) | USB / sin instalar; regenerar con `./scripts/build-website.sh` |
| **Desktop** | `desktop/` → `npm start` o Releases | Electron; en uso real suele ir por **~90–100 MB de RAM** |

Stack del laboratorio: **HTML + CSS + JS vanilla + Canvas** (sin React/Vue).  
El logo es un **círculo unitario con vector de posición**.

---

## ¿Qué es?

Simulador de física orientado a clase: módulos interactivos, pizarra, usuarios (alumno/docente), códigos de examen, trabajos con **Abrir en módulo** y guardado en caché (navegador o archivo en Electron).

---

## Estructura del repositorio

| Ruta | Contenido |
|------|-----------|
| `skills/fisicahn/` | **Fuente** del simulador (editar aquí) |
| `website/` | Sitio público: inicio, docentes, `sim/`, ZIP, cabeceras |
| `desktop/` | Electron (`app/` se genera al sincronizar; no editar a mano) |
| `scripts/build-website.sh` | `skills/fisicahn` → `website/sim` + ZIP (+ config en línea si hay) |
| `supabase/schema.sql` | Esquema y RLS (ejecutar en el SQL Editor del backend) |
| `docs/` | Despliegue (`SUPABASE_GITHUB_PAGES.md`) y seguridad (`SECURITY.md`) |

```bash
# Tras editar el lab
./scripts/build-website.sh

# Escritorio (elige UNO; no uses "npm start / npm run sync")
cd desktop && npm start          # sync + abrir Electron
# o solo sincronizar:
cd desktop && npm run sync
```

---

## Inicio rápido (desarrollo)

```bash
./scripts/build-website.sh
cd website && python3 -m http.server 8080
```

- Inicio: http://127.0.0.1:8080/
- Laboratorio: http://127.0.0.1:8080/sim/
- Docentes: http://127.0.0.1:8080/teacher.html

Recarga con **Ctrl+Shift+R** si no ves cambios.

El build genera el ZIP con `zip` o, si no está instalado, con **Python** (`zipfile`).

---

## Usuarios y exámenes

Al abrir el lab (web, ZIP o Electron) se pide identificación.

| Rol | Entrada | Crear código | Unirse a código |
|-----|---------|--------------|-----------------|
| **Alumno** | Nombre + colegio (recordable en USB/PC) | No | Sí |
| **Docente** | Email + contraseña + colegio (**en línea**) | Sí (nube) | Sí |

- **Cuenta** en el catálogo: identidad, unirse / crear código, cambiar usuario.
- Trabajos sellados con nombre, colegio, modo y código de examen.
- Offline: práctica y códigos de pizarra; publicar códigos en la nube requiere config + red.

---

## Laboratorio (`/sim/`)

### Catálogo
- Listado unificado de módulos.
- **Cuenta**, indicador de red, pizarra.
- **Mis trabajos**: importar/exportar JSON, **Abrir en módulo** (restaura parámetros y estado), Detalles, eliminar.
- Docentes: generar código de examen (en línea).

### En un módulo
- Info + historia, fórmulas, datos, parámetros (slider + número).
- Controles, gráficas donde aportan, herramientas de medición.
- Columnas **redimensionables** (arrastrar bordes; se recuerda el layout).
- **Guardar trabajo** (modal de nombre; en Electron escribe en **userData** + respaldo local).

### Módulos
Cinemática, dinámica / fuerzas y energía, electricidad, óptica, momentum, sonido, campos magnéticos, gravedad, oscilatorio, **física atómica** (Bohr), **física de partículas** (cargas en B), pizarra, y entradas que reutilizan motores afines.

### Pizarra
Lápiz denso, formas, texto, mover, borrador que no borra el fondo ni la cuadrícula, PNG.

---

## Sitio web (`website/`)

| Ruta | Uso |
|------|-----|
| `/` | Landing: entrada alumno, descargas, docentes, ideas |
| `/sim/` | Laboratorio (copia de `skills/fisicahn`) |
| `/teacher.html` | Acceso docente (email) |
| `/downloads/fisicahn.zip` | Paquete offline |
| `/_headers` | Cabeceras de seguridad (CSP, etc.) en hosts que las lean |

No edites solo `website/sim/`: cambia `skills/fisicahn/` y vuelve a construir.

Más detalle: `website/README.md`.

---

## Backend en la nube (opcional)

1. Proyecto con API compatible + ejecutar `supabase/schema.sql` (RLS endurecido).
2. Solo **URL** + clave **anon/public** (nunca `service_role`).

```bash
cp website/js/supabase-config.example.js website/js/supabase-config.js
# Edita url + anonKey
./scripts/build-website.sh
```

- Config real: **no** se versiona (`.gitignore`).
- El build la copia a `website/sim/js/` (ZIP) y el sync de desktop a `desktop/app/js/`.
- GitHub Actions: secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

Ver `docs/SUPABASE_GITHUB_PAGES.md` y `docs/SECURITY.md`.

---

## App de escritorio

```bash
cd desktop
npm install          # Node 20+ recomendado; Electron 43 / electron-builder 26
npm start            # sync + Electron
npm run dist:win     # portable + NSIS
npm run dist:linux   # AppImage + deb
```

| Detalle | Valor |
|---------|--------|
| Sync | `skills/fisicahn` → `desktop/app` |
| Trabajos | Archivo en **userData** (`fisicahn-works-v1.json`) vía IPC |
| RAM en uso (medida) | **~90–100 MB** con la app abierta (el instalable/portable en disco es mayor por Chromium) |
| SO | Windows 10+, Linux, macOS (no Windows 7 con Electron actual) |

Publicar: genera `desktop/release/`, súbelo a **GitHub Releases** (`…/releases/latest`). Los botones del sitio apuntan ahí.

---

## Despliegue web

| Destino | Cómo |
|---------|------|
| **GitHub Pages** | `.github/workflows/deploy-pages.yml` (checkout sin submódulos rotos) |
| **Cloudflare Pages** | Build `./scripts/build-website.sh` · output `website` |

---

## Requisitos orientativos

| Entrega | Disco | RAM en ejecución |
|---------|-------|------------------|
| **ZIP** | ~0,16 MB el `.zip` | La del navegador (~cientos de MB del SO) |
| **Electron** | ~100–180 MB el portable/instalable | **~90–100 MB** de proceso en un PC típico (más si hay muchas pestañas del SO) |

---

## Licencia

MIT — ver el repositorio.
