import { BrowserWindow, screen } from 'electron';
import { trackWindowState } from './trackWindowState';
import { DEFAULT_WINDOW_STATE, fitToDisplays, MIN_WINDOW_SIZE, WindowStateStore } from './WindowState';

const BACKGROUND_COLOR = '#070a26';

export type MainWindowDependencies = {
    windowStateStore: WindowStateStore;
    iconPath: string;
    /** Preload of the shell page (navigation bar + native pages) drawn in the window itself. */
    shellPreload: string;
    devTools: boolean;
    /** False when started with Windows to stay in the notification area. */
    showOnReady: boolean;
};

/** The application window. Its own page is the shell; the web game is added as a child view. */
export function createMainWindow({ windowStateStore, iconPath, shellPreload, devTools, showOnReady }: MainWindowDependencies): BrowserWindow {
    const workAreas = screen.getAllDisplays().map((display) => display.workArea);
    const state = fitToDisplays(windowStateStore.load() ?? DEFAULT_WINDOW_STATE, workAreas);

    const window = new BrowserWindow({
        ...state,
        minWidth: MIN_WINDOW_SIZE.width,
        minHeight: MIN_WINDOW_SIZE.height,
        title: 'eMush',
        icon: iconPath,
        backgroundColor: BACKGROUND_COLOR,
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            preload: shellPreload,
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webviewTag: false,
            spellcheck: false,
            devTools,
        },
    });

    // Maximizing also shows the window on Windows: when starting hidden, wait until it is shown.
    const restoreState = (): void => {
        if (state.isMaximized) {
            window.maximize();
        }
        if (state.isFullScreen) {
            window.setFullScreen(true);
        }
    };
    if (showOnReady) {
        restoreState();
        window.once('ready-to-show', () => window.show());
    } else {
        window.once('show', restoreState);
    }
    trackWindowState(window, windowStateStore);

    return window;
}
