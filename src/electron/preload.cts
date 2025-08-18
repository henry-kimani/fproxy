
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  send(channel: string, data: any) {
    ipcRenderer.send(channel, data);
  },
  receive(channel: string, cb: (data: any) => void) {
    ipcRenderer.on(channel, (_, data) => cb(data));
  },
});
