import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { isDev } from "./lib/utils.js";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  });

  if (isDev()) {
    win.loadURL("http://localhost:5123");
  } else {
    win.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'));
  }
};

app.whenReady().then(() => {
  createWindow();

  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
