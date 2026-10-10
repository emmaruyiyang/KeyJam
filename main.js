const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { uIOhook } = require('uiohook-napi');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win;
let started = false;

function createWindow() {
  win = new BrowserWindow({
    width: 760,
    height: 620,
    minWidth: 680,
    minHeight: 560,
    title: 'KeyJam',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (process.env.ELECTRON_DEV === 'true') win.webContents.openDevTools({ mode: 'detach' });
}

function startGlobalKeyboard() {
  if (started) return;
  uIOhook.on('keydown', event => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('global-keydown', {
        keycode: event.keycode,
        time: event.time,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      });
    }
  });
  uIOhook.start();
  started = true;
}

function stopGlobalKeyboard() {
  if (!started) return;
  try { uIOhook.stop(); } catch (_) {}
  started = false;
}

app.whenReady().then(() => {
  createWindow();
  startGlobalKeyboard();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopGlobalKeyboard);
process.on('SIGINT', () => { stopGlobalKeyboard(); app.quit(); });
process.on('SIGTERM', () => { stopGlobalKeyboard(); app.quit(); });
