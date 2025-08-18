import path from "node:path";
import { app } from "electron";
import { isDev } from "./lib/utils.js";

export function getPreloadPath() {
  return path.join(
    app.getAppPath(),
    isDev() ? "." : "..",
    '/dist-electron/preload.cjs'
  );
}
