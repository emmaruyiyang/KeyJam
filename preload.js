const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('keyJam', {
  onGlobalKeydown(callback) {
    ipcRenderer.on('global-keydown', (_event, data) => callback(data));
  }
});
