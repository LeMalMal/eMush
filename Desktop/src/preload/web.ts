import { contextBridge } from 'electron';

/**
 * Preload of the web view (the game and Eternaltwin pages). Exposes only two read-only values,
 * so the web client can detect it runs inside the desktop app. No Node or Electron API, no IPC.
 */
contextBridge.exposeInMainWorld('emushDesktop', Object.freeze({
    isDesktopApp: true,
    platform: process.platform,
}));
