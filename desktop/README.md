# FísicaHN Desktop

Aplicación de **escritorio multiplataforma** (Windows, Linux, macOS) que envuelve el simulador web con **Electron**.

## ¿Para qué?

En labs con **NetSupport** u otras herramientas de control de aula, a veces se **bloquea el navegador**. La app de escritorio:

- Trae su **propio Chromium** (no usa Chrome/Edge del sistema)
- Funciona **100% offline**
- Se puede instalar o copiar como **.exe portable** (USB)
- Guarda trabajos en el almacenamiento local de la app (mismo sistema de examen/prácticas)

## Alternativas consideradas

| Tecnología | Pros | Contras |
|------------|------|---------|
| **Electron** (elegida, v43) | Canvas fiable, empaquetado fácil, portable Windows | Binario más pesado (~100–180 MB); Windows 10+ |
| Tauri | Binario pequeño | Depende del WebView del SO (WebView2); más fricción en labs viejos |
| PWA | Sin instalar | Sigue siendo “navegador”; NetSupport puede bloquearla |

## Requisitos de desarrollo

- Node.js **20+** (recomendado **22 LTS** o superior; con Electron 43 / electron-builder 26)
- npm 10+

## Uso medido

- Tras `npm start`, la app en el monitor del sistema suele ir por **~90–100 MB de RAM**.
- Los trabajos se guardan en un archivo de **userData** (IPC), no solo en `localStorage`.
- Comando correcto: `npm start` (ya hace `sync`). No uses `npm start / npm run sync`.

## Uso en desarrollo

```bash
cd desktop
npm install
npm start
```

`npm start` sincroniza `skills/fisicahn` → `desktop/app` y abre la ventana.

## Generar instaladores

```bash
cd desktop
npm install

# Windows portable + instalador NSIS (desde Linux/mac puede requerir wine; ideal en Windows)
npm run dist:win

# Linux AppImage + .deb
npm run dist:linux

# macOS dmg (solo en Mac)
npm run dist:mac
```

Salida en `desktop/release/`:

- `FisicaHN-Portable-*.exe` — **doble clic, sin instalar** (ideal para USB / NetSupport)
- Instalador NSIS en Windows
- `.AppImage` / `.deb` en Linux

## Despliegue en el lab (NetSupport)

1. Genera el portable Windows en un PC con Node (o en CI).
2. Copia `FisicaHN-Portable-x.y.z.exe` a la carpeta compartida o USB.
3. En cada estación: ejecutar el `.exe` (no hace falta Chrome).
4. En NetSupport: permite la aplicación **FisicaHN** / el ejecutable; el bloqueo de navegadores no la afecta.

## Estructura

```
desktop/
  main.js          # proceso principal Electron
  preload.js       # flag window.FisicaHNDesktop
  app/             # copia del simulador (generada, no editar a mano)
  scripts/sync-app.sh
  package.json
  release/         # artefactos de build
```

El código del simulador se edita en `skills/fisicahn/`; luego `npm run sync` o `npm start`.
