// Settings model, without Node or Electron dependencies (shared with the shell page).

/** Player preferences: notifications, background behaviour, game display. */
export type AppSettings = {
    newCycles: boolean;
    newDays: boolean;
    messages: boolean;
    /** Ship alerts: fire, hunters, low oxygen... */
    alerts: boolean;
    /** Closing the window keeps the game running in the notification area. */
    closeToTray: boolean;
    /** Minimizing the window sends it to the notification area instead of the taskbar. */
    minimizeToTray: boolean;
    /** Start eMush with Windows (installed version only). */
    launchAtStartup: boolean;
    /** When started with Windows, stay in the notification area instead of opening the window. */
    startMinimized: boolean;
    /** Zoom the game page to fill the window. */
    gameAutoZoom: boolean;
    /** The game's chat in the client's dark style instead of the web client's pale cyan. */
    darkChat: boolean;
    /** The game's chat stretched to the full height of the game, and wider on wide windows. */
    largeChat: boolean;
    /** Player's adjustment over the automatic zoom, in 25 % steps (-2 to +2). */
    gameZoomOffset: number;
    /** The one-time explanation shown the first time the window goes to the tray. */
    trayHintShown: boolean;
};

/** Kept for readability where only notification preferences matter. */
export type NotificationSettings = AppSettings;

export const DEFAULT_SETTINGS: AppSettings = {
    newCycles: true,
    newDays: true,
    messages: true,
    alerts: true,
    closeToTray: true,
    minimizeToTray: false,
    launchAtStartup: false,
    startMinimized: true,
    gameAutoZoom: true,
    darkChat: true,
    largeChat: true,
    gameZoomOffset: 0,
    trayHintShown: false,
};

const BOOLEAN_KEYS = ['newCycles', 'newDays', 'messages', 'alerts', 'closeToTray', 'minimizeToTray', 'launchAtStartup', 'startMinimized', 'gameAutoZoom', 'darkChat', 'largeChat', 'trayHintShown'] as const;
const ZOOM_OFFSET_LIMIT = 2;

/** Reads settings from untrusted JSON (file or shell page). Unknown or invalid values keep their default. */
export function parseSettings(value: unknown, base: AppSettings = DEFAULT_SETTINGS): AppSettings {
    const input = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    const settings: AppSettings = { ...base };
    for (const key of BOOLEAN_KEYS) {
        if (typeof input[key] === 'boolean') {
            settings[key] = input[key] as boolean;
        }
    }
    if (typeof input.gameZoomOffset === 'number' && Number.isFinite(input.gameZoomOffset)) {
        const steps = Math.round(input.gameZoomOffset * 4) / 4;
        settings.gameZoomOffset = Math.min(ZOOM_OFFSET_LIMIT, Math.max(-ZOOM_OFFSET_LIMIT, steps));
    }

    return settings;
}
