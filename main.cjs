const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');

app.setName('Hone Optimizador');
const backupPath = () => path.join(app.getPath('userData'), 'windows-settings-backup.json');
const GAME_MODE = { key: 'HKCU\\Software\\Microsoft\\GameBar', name: 'AutoGameModeEnabled', type: 'REG_DWORD' };
const CAPTURE_VALUES = [
  { key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', name: 'AppCaptureEnabled', type: 'REG_DWORD' },
  { key: 'HKCU\\System\\GameConfigStore', name: 'GameDVR_Enabled', type: 'REG_DWORD' }
];

function reg(args) {
  return new Promise((resolve, reject) => execFile('reg.exe', args, { windowsHide: true, encoding: 'utf8' }, (error, stdout, stderr) => {
    if (error) return reject(Object.assign(new Error((stderr || stdout || error.message).trim()), { code: error.code }));
    resolve((stdout || '').trim());
  }));
}
async function readValue(item) {
  try {
    const output = await reg(['query', item.key, '/v', item.name]);
    const line = output.split(/\r?\n/).find(row => row.trim().startsWith(item.name));
    if (!line) return { exists: false };
    const match = line.trim().match(/^\S+\s+(REG_\S+)\s+(.+)$/);
    return match ? { exists: true, type: match[1], data: match[2].trim() } : { exists: false };
  } catch { return { exists: false }; }
}
async function getBackup() {
  try { return JSON.parse(await fs.readFile(backupPath(), 'utf8')); }
  catch { return { values: {} }; }
}
async function saveBackup(data) {
  const file = backupPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}
function idOf(item) { return `${item.key}\\${item.name}`; }
async function remember(item) {
  const backup = await getBackup();
  const id = idOf(item);
  if (!Object.prototype.hasOwnProperty.call(backup.values, id)) {
    backup.values[id] = { item, original: await readValue(item) };
    await saveBackup(backup);
  }
}
async function writeValue(item, value) {
  await reg(['add', item.key, '/v', item.name, '/t', item.type, '/d', String(value), '/f']);
}
async function currentStatus() {
  const mode = await readValue(GAME_MODE);
  const capture = await Promise.all(CAPTURE_VALUES.map(readValue));
  const backup = await getBackup();
  return {
    gameMode: mode.exists ? mode.data === '0x1' || mode.data === '1' : null,
    captureReduced: capture.every(v => v.exists && (v.data === '0x0' || v.data === '0')),
    hasChanges: Object.keys(backup.values || {}).length > 0,
    windows: process.platform === 'win32'
  };
}

ipcMain.handle('optimizer:status', currentStatus);
ipcMain.handle('optimizer:game-mode', async (_event, enabled) => {
  if (process.platform !== 'win32') throw new Error('Esta función solo está disponible en Windows.');
  await remember(GAME_MODE);
  await writeValue(GAME_MODE, enabled ? 1 : 0);
  return currentStatus();
});
ipcMain.handle('optimizer:capture-reduction', async (_event, enabled) => {
  if (process.platform !== 'win32') throw new Error('Esta función solo está disponible en Windows.');
  for (const item of CAPTURE_VALUES) await remember(item);
  for (const item of CAPTURE_VALUES) await writeValue(item, enabled ? 0 : 1);
  return currentStatus();
});
ipcMain.handle('optimizer:restore', async () => {
  if (process.platform !== 'win32') throw new Error('Esta función solo está disponible en Windows.');
  const backup = await getBackup();
  for (const entry of Object.values(backup.values || {})) {
    const { item, original } = entry;
    if (original.exists) await reg(['add', item.key, '/v', item.name, '/t', original.type, '/d', original.data, '/f']);
    else {
      try { await reg(['delete', item.key, '/v', item.name, '/f']); } catch { /* ya ausente */ }
    }
  }
  await fs.rm(backupPath(), { force: true });
  return currentStatus();
});
ipcMain.handle('optimizer:open-settings', () => shell.openExternal('ms-settings:gaming-gamemode'));

function createWindow() {
  const window = new BrowserWindow({
    width: 1080, height: 790, minWidth: 760, minHeight: 600,
    backgroundColor: '#101110', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  Menu.setApplicationMenu(null);
  window.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
