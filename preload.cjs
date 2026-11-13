const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('windowsOptimizer', Object.freeze({
  available: true,
  getStatus: () => ipcRenderer.invoke('optimizer:status'),
  setGameMode: enabled => ipcRenderer.invoke('optimizer:game-mode', Boolean(enabled)),
  setCaptureReduction: enabled => ipcRenderer.invoke('optimizer:capture-reduction', Boolean(enabled)),
  restore: () => ipcRenderer.invoke('optimizer:restore'),
  openGameSettings: () => ipcRenderer.invoke('optimizer:open-settings')
}));
