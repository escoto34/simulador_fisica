<p align="center">
  <img src="website/assets/logo.svg" width="72" height="72" alt="FísicaHN">
</p>

<h1 align="center">FísicaHN</h1>
<p align="center">
  <strong>Laboratorio virtual de física para el aula</strong><br>
  JavaScript puro · HTML5 Canvas · catálogo unificado · web / ZIP / escritorio
</p>

<p align="center">
  <a href="https://github.com/escoto34/FisicaHN">github.com/escoto34/FisicaHN</a>
</p>

---

## ¿Qué es?

**FísicaHN** es un simulador de física orientado a clase: módulos interactivos, pizarra docente, usuarios en el laboratorio, códigos de examen y guardado de trabajos.

| Uso | Cómo |
|-----|------|
| **En el navegador** | Carpeta `website/` (landing + laboratorio) |
| **USB / sin instalación** | `website/downloads/fisicahn.zip` (abrir `sim/index.html` vía servidor local o el ZIP descomprimido según tu flujo) |
| **Escritorio** | App Electron en `desktop/` (útil si el lab bloquea el navegador del sistema) |

Stack del laboratorio: **HTML + CSS + JS vanilla + Canvas**. No usa React, Vue ni kits de UI externos.

El logo es un **círculo unitario con vector de posición** (geometría / cinemática).

---

## Estructura del repositorio

| Ruta | Contenido |
|------|-----------|
| `skills/fisicahn/` | **Fuente** del simulador (editar aquí) |
| `website/` | Sitio público: inicio, acceso docente, `sim/`, ZIP |
| `desktop/` | Empaquetado Electron (`app/` se genera al sincronizar) |
| `scripts/build-website.sh` | Copia el sim → `website/sim`, opcional config en línea, regenera el ZIP |
| `supabase/` | Esquema SQL opcional (backend en la nube) |
| `docs/` | Notas de despliegue y backend |

> Tras cambiar el simulador, ejecuta siempre `./scripts/build-website.sh`.  
> Para desktop: `cd desktop && npm run sync` (o `npm start`).

---

## Inicio rápido (desarrollo)

```bash
# 1) Sincronizar simulador → website y regenerar ZIP
./scripts/build-website.sh

# 2) Servir el sitio (necesario para ES modules)
cd website && python3 -m http.server 8080
```

- Inicio: http://127.0.0.1:8080/
- Laboratorio: http://127.0.0.1:8080/sim/
- Docentes (web): http://127.0.0.1:8080/teacher.html

Recarga con **Ctrl+Shift+R** si no ves cambios.

---

## Usuarios y exámenes (en el simulador)

El laboratorio pide identificación al entrar (también en **USB / Electron**, sin pasar por la landing).

### Roles

| Rol | Cómo entra | Crear código de examen | Unirse a un código |
|-----|------------|------------------------|--------------------|
| **Alumno** | Nombre + colegio (local; se puede recordar en ese PC/USB) | No | Sí |
| **Docente** | Email + contraseña + colegio (**en línea**, datos de verificación) | Sí (nube) | Sí |

- **Cuenta** (catálogo) o el chip de usuario: ver identidad, unirse a código, crear código (solo docente), cambiar usuario o cerrar sesión.
- Los trabajos se sellan con nombre, colegio, modo (práctica/examen) y código si aplica.
- Sin internet: el alumno puede practicar y unirse en modo pizarra (código de 4–8 dígitos). Crear códigos en la nube requiere conexión y config.

### Flujo típico en clase

1. El docente inicia sesión en el lab (o en *Acceso docente* de la web) con email.
2. Genera un **código de examen** y lo escribe en la pizarra.
3. Cada alumno (o su USB) entra como alumno y **se une** al código, o lo escribe al entrar en modo Examen.
4. Guardan trabajos; el docente los revisa (local, import JSON o nube según despliegue).

---

## Laboratorio (`/sim/`)

### Catálogo
- **Un solo listado** de módulos (sin pestañas por grado).
- **Cuenta** / chip de usuario: sesión alumno o docente.
- Tarjeta **Mis trabajos**: importar/exportar JSON, listar guardados e importados, evaluar con **Ver**. Los docentes ven además la barra de **código de examen**.
- Indicador de red (local / en línea).

### Dentro de un módulo
- **Información**: descripción breve + *Historia y casos prácticos*.
- **Fórmulas**: tarjetas legibles.
- **Datos**: valores en tiempo real.
- **Parámetros**: control deslizante y campo numérico.
- **Controles**: velocidad, play/pausa, paso.
- **Gráficas**: solo en módulos donde aportan (p. ej. cinemática).
- **Herramientas** (iconos + tooltip): puntero, regla, ángulo, sonda, cronómetro, espacio infinito, limpiar medidas.
- Clic en **FísicaHN** (barra lateral) = volver al catálogo.
- **Guardar trabajo** y badge de sesión en la barra del canvas.

### Motores incluidos
Cinemática, dinámica, electricidad, óptica, momentum, sonido/Doppler, campos magnéticos, gravedad, oscilatorio, pizarra, y placeholders de temas en desarrollo.

### Pizarra
Lápiz, formas, texto, **mover** objetos, borrador que no borra el fondo ni la cuadrícula, exportar PNG.

---

## Sitio web

- **Inicio**: entrada rápida del alumno, descarga ZIP, enlaces Desktop (Windows / Linux / macOS → GitHub Releases), docentes e ideas de mejora.
- **Acceso docente** (`teacher.html`): registro/inicio con email + colegio (en línea), códigos y listado de trabajos.
- El laboratorio embebido en `website/sim/` es copia de `skills/fisicahn/` (no editar solo ahí).

---

## Backend en la nube (opcional)

El sitio **no muestra** el nombre del proveedor al usuario final. Para desarrolladores:

1. Crea un proyecto backend compatible con el esquema en `supabase/schema.sql`.
2. SQL Editor → ejecuta ese archivo.
3. Copia **URL** y clave **anon/public** (nunca `service_role` en el frontend).

```bash
cp website/js/supabase-config.example.js website/js/supabase-config.js
# Edita url + anonKey
./scripts/build-website.sh
```

El build copia la config a `website/sim/js/` (ZIP) y, al sincronizar desktop, a `desktop/app/js/` si existe. Esos archivos generados **no deben subirse** con secretos (ver `.gitignore`).

**GitHub Actions** (Pages): secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

Sin configuración, el laboratorio sigue en **localStorage** del navegador / del PC.

Más detalle: `docs/SUPABASE_GITHUB_PAGES.md`.

---

## App de escritorio

```bash
cd desktop
npm install
npm start           # sync desde skills/fisicahn + Electron
npm run dist:win    # Windows (portable / instalador)
npm run dist:linux  # AppImage / deb
# npm run dist:mac  # en macOS
```

- Artefactos: `desktop/release/` (ignorado por git).
- `desktop/app/` es copia generada del sim (ignorada; no editar a mano).
- El portable de Windows sirve para **USB** en aulas con NetSupport u otras restricciones del navegador.

### Publicar un GitHub Release

1. Genera binarios con `dist:*`.
2. GitHub → **Releases** → **Draft a new release**.
3. Tag (`v1.1.0`), notas, sube archivos de `desktop/release/`.
4. Los botones del sitio apuntan a  
   `https://github.com/escoto34/FisicaHN/releases/latest`.

---

## Despliegue web

| Destino | Cómo |
|---------|------|
| **GitHub Pages** | Workflow `.github/workflows/deploy-pages.yml` (carpeta `website/`) |
| **Cloudflare Pages** | Build: `./scripts/build-website.sh` · Output: `website` |

Cada build actualiza `website/downloads/fisicahn.zip`.

---

## Requisitos orientativos

| Entrega | Disco (aprox.) | Notas |
|---------|----------------|--------|
| **ZIP del lab** | ~0,15–0,6 MB | Navegador reciente; 2 GB RAM del PC |
| **Electron** | ~90–180 MB el instalable/portable | Incluye Chromium; 4 GB RAM recomendados en el lab |

El coste grande de la app de escritorio es Electron, no el código del simulador.

---

## Licencia

MIT — ver el repositorio.
