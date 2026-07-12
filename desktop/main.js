/**
 * FísicaHN Desktop — Electron
 * Empaqueta el simulador web (vanilla) como app de escritorio multiplataforma.
 * Útil cuando NetSupport u otras herramientas bloquean el navegador en el lab.
 */

const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

/** @type {BrowserWindow | null} */
let mainWindow = null;

function worksFilePath() {
  return path.join(app.getPath('userData'), 'fisicahn-works-v1.json');
}

function sessionFilePath() {
  return path.join(app.getPath('userData'), 'fisicahn-session-mirror.json');
}

function registerIpc() {
  ipcMain.handle('fisicahn:works-load', async () => {
    try {
      const p = worksFilePath();
      if (!fs.existsSync(p)) return [];
      const raw = fs.readFileSync(p, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : Array.isArray(data?.works) ? data.works : [];
    } catch (err) {
      console.error('works-load', err);
      return [];
    }
  });

  ipcMain.handle('fisicahn:works-save', async (_evt, list) => {
    try {
      const arr = Array.isArray(list) ? list : [];
      const p = worksFilePath();
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(arr), 'utf8');
      return { ok: true, path: p, count: arr.length };
    } catch (err) {
      console.error('works-save', err);
      return { ok: false, error: String(err?.message || err) };
    }
  });

  ipcMain.handle('fisicahn:prompt', async (evt, { message, defaultValue }) => {
    const win = BrowserWindow.fromWebContents(evt.sender) || mainWindow;
    // Electron no tiene prompt nativo fiable: usamos un input simple vía dialog no existe;
    // devolvemos default y el renderer usa modal HTML. Mantenemos el canal por compat.
    return { cancelled: false, value: defaultValue ?? '', useHtmlModal: true };
  });
}

function appIndexPath() {
  // En desarrollo: desktop/app/index.html (tras npm run sync)
  // En empaquetado: resources/app/app/index.html o según asar
  const candidates = [
    path.join(__dirname, 'app', 'index.html'),
    path.join(process.resourcesPath, 'app', 'index.html'),
    path.join(app.getAppPath(), 'app', 'index.html')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(__dirname, 'build', 'icon.svg')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createWindow() {
  const icon = resolveAppIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'FísicaHN',
    backgroundColor: '#0c0f14',
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox false: IPC de archivos de trabajos más fiable en todas las versiones
      sandbox: false,
      // Persistencia localStorage de respaldo
      partition: 'persist:fisicahn',
      webSecurity: true
    }
  });

  const indexHtml = appIndexPath();
  if (!fs.existsSync(indexHtml)) {
    dialog.showErrorBox(
      'FísicaHN',
      'No se encontró el simulador (app/index.html).\nEjecuta: npm run sync'
    );
    app.quit();
    return;
  }

  mainWindow.loadFile(indexHtml);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Enlaces externos (si hubiera) en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    {
      label: 'Archivo',
      submenu: [isMac ? { role: 'close' } : { role: 'quit', label: 'Salir' }]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        { type: 'separator' },
        { role: 'resetzoom', label: 'Zoom normal' },
        { role: 'zoomin', label: 'Acercar' },
        { role: 'zoomout', label: 'Alejar' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de FísicaHN',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'FísicaHN',
              message: 'FísicaHN Desktop',
              detail:
                'Simulador de física offline para colegios.\n' +
                'No depende del navegador del sistema (útil con NetSupport).\n' +
                'Los trabajos se guardan en el almacenamiento local de la app.'
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
