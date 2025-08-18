import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { isDev } from "./lib/utils.js";
import { Socket } from "node:net";
import crypto from "node:crypto";
import { CustomPromiseType, TcpErrorType, TCPReqType, TCPResType } from "./definitions.js";
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { bearerAuth } from 'hono/bearer-auth';
import dotenv from 'dotenv';
import { getPreloadPath } from './pathResolver.js';
import EventEmitter from 'node:events';

dotenv.config({
  path: path.join(app.getAppPath(), isDev() ? '.env.local' : '.env'),
  debug: true 
});

const FIRST_RESULT = 0;
const logsEmitter = new EventEmitter();
logsEmitter.setMaxListeners(1);


/************************************
 *
 * CONNECTION TO THE TCP SERVER 
 *
 * **********************************/

// Create in the socket
const tcpClient = new Socket();
const tcpServerPort = Number(process.env.MTSOCKETAPI_PORT) || 77;
tcpClient.connect(tcpServerPort, "127.0.0.1", () => {
  logsEmitter.emit("logs-event", "Connected to MetaTrader.");
});

tcpClient.on('close', () => {
  console.log("TCP Connection Closed. \n");
  logsEmitter.emit("logs-event", "Connection with MetaTrader disconnected.")
});

tcpClient.on('error', (error) => {
  console.log("TCP ERROR: \n", error);
  logsEmitter.emit("logs-event", "An error occured. Restart the app.")
});

const getDataFromTCP = function(req: TCPReqType): CustomPromiseType<TCPResType, TcpErrorType> {
  return new Promise((resolve, reject) => {

    const handler = function(data: Buffer<ArrayBufferLike>) {
      const resString = data.toString();

      if (resString.indexOf('\r\n') > 0) {
        try {
          const resJSON: TCPResType = JSON.parse(resString.split('\r\n')[FIRST_RESULT]);

          if (resJSON.MSG === "ACCOUNT_STATUS") {
            resolve(resJSON);
          } else if (resJSON.MSG === "TRADE_HISTORY") {
            resolve(resJSON);
          } else {
            reject({ code: 404, message: "No such data requested." });
          }
        } catch {
          reject({ code: 500, message: "Failed to parse json." });
        }
      }
    };

    // Listen to the data once. Listening once helps deal with race conditions
    tcpClient.once('data', handler);

    // 10 sec timeout if the server never responds
    const timeout = setTimeout(() => {
      tcpClient.removeListener('data', handler);
      reject({ code: 500, message: "TCP server never responded" });
    }, 10000);

    // Write to the TCP socket
    if (req.MSG === "TRADE_HISTORY") {
      tcpClient.write('{"MSG":"TRADE_HISTORY"}' + '\r\n', (error) => {
        if (error) {
          console.log("[ERROR]: ", error);
          clearTimeout(timeout);
          tcpClient.removeListener('data', handler);
          reject({ code: 500, message: "Failed to get Trade History Data." });
        }
      });
    } else {
      tcpClient.write('{"MSG":"ACCOUNT_STATUS"}' + '\r\n', (error) => {
        if (error) {
          console.log("[ERROR]: ", error);
          clearTimeout(timeout);
          tcpClient.removeListener('data', handler);
          reject({ code: 500, message: "Failed to get Account Status Data." });
        }
      });
    }

  })
};


/****************************************
 *
 * HTTP SERVER, REST ENDPOINTS 
 *
 * **************************************/


const honoApp = new Hono();
const honoServerPort = 6123;

const API_KEY = process.env.FPROXY_API_KEY;
const SESSION_KEY = crypto.randomBytes(32).toString('hex');

// Middleware
honoApp.use('/api/*', 
  bearerAuth({
    async verifyToken(token, _) {
      // Verifying API_KEY is legit
      if (!API_KEY) {
        return false;
      }

      const fproxyApiKeyBuffer = Buffer.from(API_KEY, 'utf-8');
      const clientApiKeyBuffer = Buffer.from(token, 'utf-8');

      return (
        fproxyApiKeyBuffer.length === clientApiKeyBuffer.length ||
        crypto.timingSafeEqual(clientApiKeyBuffer, fproxyApiKeyBuffer)
      );
    },
  }),
  async function(c, next) {
    const clientSessionKey = c.req.header('x-session-header'); 

    if (!clientSessionKey) {
      return c.json({ message: "Unauthorized: Missing session key" }, 401);
    }

    if (clientSessionKey !== SESSION_KEY) {
      return c.json({ message: "Forbidden: Invalid session key" }, 403);
    }

    await next();
  }
);

honoApp.get("/api/v1/trade-history", async function(c) {
  return getDataFromTCP({ "MSG": "TRADE_HISTORY" })
    .then((value) => {
      return c.json(value);
    })
    .catch((error) => {
      return c.json(error);
    })
});

honoApp.get("/api/v1/account-status", async function(c) {
  return getDataFromTCP({ "MSG": "ACCOUNT_STATUS" })
    .then((value) => {
      return c.json(value);
    })
    .catch((error) => {
      return c.json(error);
    });
});

const honoServer = serve({
  fetch: honoApp.fetch,
  port: 6123
}, () => {
    console.log("HTTP Server running on port " + honoServerPort);
  }
);

// Close the HTTP server gracefully
process.on('SIGINT', () => {
  console.log("Detected Close SIGINT.");
});

process.on('SIGTERM', () => {
  console.log("Detected Close SIGTERM.");
});


/***************************************
 *
 * ELECTRON 
 *
 * ************************************/

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true
    }
  });

  if (isDev()) {
    win.loadURL("http://localhost:5123");
  } else {
    win.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'));
  }

  logsEmitter.on("logs-event", (logs: string) => {
    console.log("Logs are comming", logs);
    win.webContents.send("logs-command", logs);
  });

};

app.whenReady().then(() => {
  createWindow();

  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    honoServer.close();
    tcpClient.destroy();
    app.quit();
  }
});

ipcMain.on("send-session-key", (event) => {
  event.sender.send("session-key-command", SESSION_KEY);
});
