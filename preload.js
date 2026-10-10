const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('keyJam', {
  onGlobalKeydown(callback) {
    ipcRenderer.on('global-keydown', (_event, data) => callback(data));
  },
  onKeyboardStatus(callback) {
    ipcRenderer.on('keyboard-status', (_event, status) => callback(status));
  },
  onSetMode(callback) {
    ipcRenderer.on('set-mode', (_event, mode) => callback(mode));
  },
  getKeyboardStatus: () => ipcRenderer.invoke('get-keyboard-status'),
  openAccessibilitySettings: () => ipcRenderer.invoke('open-accessibility-settings'),
  relaunch: () => ipcRenderer.invoke('relaunch'),
  modeChanged: mode => ipcRenderer.send('mode-changed', mode),
  setContentHeight: height => ipcRenderer.send('content-height', height),
  hideWindow: () => ipcRenderer.send('hide-window'),
  quit: () => ipcRenderer.send('quit')
});
