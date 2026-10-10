const { app, BrowserWindow, ipcMain, systemPreferences, shell, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const { uIOhook } = require('uiohook-napi');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const ACCESSIBILITY_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';
const WIN_WIDTH = 320;
const MODES = [['music', 'Music'], ['fx', 'FX'], ['off', 'Off']];

let win;
let tray;
let quitting = false;
let currentMode = 'music';
let started = false;
let permissionTimer = null;
// 'listening' | 'needs-permission' | 'needs-restart'
let keyboardStatus = 'needs-permission';

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());

function createWindow() {
  win = new BrowserWindow({
    width: WIN_WIDTH,
    height: 400,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    title: 'KeyJam',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', showWindow);
  // Closing only hides the panel; KeyJam keeps running in the menu bar.
  win.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  if (process.env.ELECTRON_DEV === 'true') win.webContents.openDevTools({ mode: 'detach' });
}

// Top-right of the screen, just under the menu bar icon.
function positionWindow() {
  const [width, height] = win.getSize();
  const trayBounds = tray ? tray.getBounds() : { x: 0, y: 0, width: 0, height: 0 };
  const display = trayBounds.width
    ? screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
    : screen.getPrimaryDisplay();
  const area = display.workArea;
  const preferredX = trayBounds.width
    ? trayBounds.x + trayBounds.width / 2 - width / 2
    : area.x + area.width - width;
  const x = Math.min(Math.max(preferredX, area.x + 8), area.x + area.width - width - 8);
  win.setBounds({ x: Math.round(x), y: area.y + 6, width, height });
}

function showWindow() {
  if (!win || win.isDestroyed()) return;
  positionWindow();
  win.show();
  win.focus();
}

function toggleWindow() {
  if (win.isVisible() && win.isFocused()) win.hide();
  else showWindow();
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: win && win.isVisible() ? 'Hide KeyJam' : 'Show KeyJam', click: toggleWindow },
    { type: 'separator' },
    ...MODES.map(([mode, label]) => ({
      label,
      type: 'radio',
      checked: currentMode === mode,
      click: () => win.webContents.send('set-mode', mode)
    })),
    { type: 'separator' },
    { label: 'Quit KeyJam', click: () => app.quit() }
  ]);
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray', 'iconTemplate.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('KeyJam');
  tray.on('click', toggleWindow);
  tray.on('right-click', () => tray.popUpContextMenu(buildTrayMenu()));
}

function setKeyboardStatus(status) {
  keyboardStatus = status;
  if (win && !win.isDestroyed()) win.webContents.send('keyboard-status', status);
}

function hasAccessibility(prompt = false) {
  if (process.platform !== 'darwin') return true;
  return systemPreferences.isTrustedAccessibilityClient(prompt);
}

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

function startGlobalKeyboard() {
  if (started) return;
  try {
    uIOhook.start();
    started = true;
    setKeyboardStatus('listening');
  } catch (e) {
    console.error('Global keyboard hook failed to start:', e);
    // Permission was granted but this process can't use it yet.
    setKeyboardStatus(hasAccessibility() ? 'needs-restart' : 'needs-permission');
  }
}

function stopGlobalKeyboard() {
  if (!started) return;
  try { uIOhook.stop(); } catch (_) {}
  started = false;
}

function initGlobalKeyboard() {
  // Passing true shows the macOS prompt and adds KeyJam to the Accessibility list.
  if (hasAccessibility(true)) return startGlobalKeyboard();

  setKeyboardStatus('needs-permission');
  permissionTimer = setInterval(() => {
    if (!hasAccessibility()) return;
    clearInterval(permissionTimer);
    permissionTimer = null;
    startGlobalKeyboard();
  }, 1500);
}

ipcMain.handle('get-keyboard-status', () => keyboardStatus);
ipcMain.handle('open-accessibility-settings', () => shell.openExternal(ACCESSIBILITY_SETTINGS_URL));
ipcMain.handle('relaunch', () => { app.relaunch(); app.exit(0); });
ipcMain.on('mode-changed', (_event, mode) => { currentMode = mode; });
ipcMain.on('content-height', (_event, height) => {
  if (!win || win.isDestroyed()) return;
  win.setContentSize(WIN_WIDTH, Math.ceil(height));
});
ipcMain.on('hide-window', () => win && win.hide());
ipcMain.on('quit', () => app.quit());

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  createTray();
  createWindow();
  initGlobalKeyboard();
  app.on('activate', showWindow);
});

// Menu bar app: stay alive with no windows open.
app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  quitting = true;
  if (permissionTimer) clearInterval(permissionTimer);
  stopGlobalKeyboard();
});
process.on('SIGINT', () => { stopGlobalKeyboard(); app.quit(); });
process.on('SIGTERM', () => { stopGlobalKeyboard(); app.quit(); });
