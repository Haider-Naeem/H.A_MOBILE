const { app, BrowserWindow } = require('electron');
const path = require('path');

// ❌ REMOVED: app.disableHardwareAcceleration() — this breaks input event processing
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
app.commandLine.appendSwitch('enable-smooth-scrolling');

const isDev = !app.isPackaged;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: false,
    backgroundColor: '#f0f9ff',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  // ✅ KEY FIX: force repaint + refocus on every window focus event
  mainWindow.on('focus', () => {
    if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.focus();
      mainWindow.webContents.invalidate(); // forces a full repaint
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('gpu-process-crashed', (event, killed) => {
  console.log('GPU process crashed:', killed);
  event.preventDefault();
  setTimeout(createWindow, 1000);
});

// ❌ REMOVED: the ping setInterval — it was creating unnecessary IPC traffic
//    that can interfere with the renderer's event loop