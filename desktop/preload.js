/**
 * API segura hacia el renderer (sin nodeIntegration).
 * Trabajos en disco (userData) — fiable en Electron donde localStorage a veces falla.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('FisicaHNDesktop', {
  isDesktop: true,
  platform: process.platform,
  worksCache: 'file',
  /** @returns {Promise<Array>} */
  loadWorks: () => ipcRenderer.invoke('fisicahn:works-load'),
  /** @param {Array} list */
  saveWorks: (list) => ipcRenderer.invoke('fisicahn:works-save', list),
  /** Diálogo de texto nativo (sustituye prompt del navegador) */
  promptText: (message, defaultValue) =>
    ipcRenderer.invoke('fisicahn:prompt', { message, defaultValue })
});
