import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload of the shell page (local file: navigation bar and native pages). The bridge only sends
 * page names, ids and commands; the main process validates every message and its sender.
 */
contextBridge.exposeInMainWorld('emushShell', Object.freeze({
    load: (page: string, params?: unknown) => ipcRenderer.invoke('shell:load', page, params),
    join: (request: unknown) => ipcRenderer.invoke('shell:join', request),
    endAdventure: (request: unknown) => ipcRenderer.invoke('shell:end-adventure', request),
    updateSettings: (change: unknown) => ipcRenderer.invoke('shell:update-settings', change),
    navigate: (navigation: unknown) => ipcRenderer.send('shell:navigate', navigation),
    command: (command: string) => ipcRenderer.send('shell:command', command),
    openLink: (url: string) => ipcRenderer.send('shell:open-link', url),
    onPage: (listener: (navigation: unknown) => void) => {
        ipcRenderer.on('shell:page', (_event, navigation) => listener(navigation));
    },
    onReload: (listener: () => void) => {
        ipcRenderer.on('shell:reload', () => listener());
    },
    ready: () => ipcRenderer.send('shell:ready'),
    find: (request: unknown) => ipcRenderer.send('shell:find', request),
    stopFind: () => ipcRenderer.send('shell:find-stop'),
    onFindOpen: (listener: () => void) => {
        ipcRenderer.on('shell:find-open', () => listener());
    },
    onFindResult: (listener: (result: unknown) => void) => {
        ipcRenderer.on('shell:find-result', (_event, result) => listener(result));
    },
}));
