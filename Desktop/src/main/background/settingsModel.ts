// Settings model, without Node or Electron dependencies (shared with the shell page).

/** Languages of the web game's interface (App/src/i18n), in the order the settings page shows them. */
export const GAME_LANGUAGES = ['fr', 'en', 'es'] as const;
export type GameLanguage = typeof GAME_LANGUAGES[number];
/** `auto` follows the language of Windows. */
export type GameLanguageSetting = GameLanguage | 'auto';

/** Sizes of the text of the game's chat, smallest first. */
export const CHAT_TEXT_SIZES = ['small', 'normal', 'large', 'larger'] as const;
export type ChatTextSize = typeof CHAT_TEXT_SIZES[number];

/** How the "X came in / left" room logs are shown: as the game does, smaller and dimmed, or not at all. */
export const MOVEMENT_LOG_MODES = ['normal', 'compact', 'hidden'] as const;
export type MovementLogMode = typeof MOVEMENT_LOG_MODES[number];

/** Player preferences: notifications, background behaviour, game display. */
export type AppSettings = {
    newCycles: boolean;
    newDays: boolean;
    messages: boolean;
    /** Which channels' messages notify (when `messages` is on). */
    messagesPublic: boolean;
    messagesPrivate: boolean;
    messagesMush: boolean;
    /** A message naming the character always notifies, even from a muted channel. */
    mentions: boolean;
    /** The sound played with a notification (Windows' notification sound). */
    notificationSound: boolean;
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
    /** Language of the web game's menus and buttons (the web client's own selector is in its hidden top bar). */
    gameLanguage: GameLanguageSetting;
    /** Misspelled words underlined in the chat (and the client's text fields), with suggestions on right-click. */
    spellcheck: boolean;
    /** The game's chat in the client's dark style instead of the web client's pale cyan. */
    darkChat: boolean;
    /** The game's chat stretched to the full height of the game, and wider on wide windows. */
    largeChat: boolean;
    /** The character's own messages and the messages naming the character stand out in the game's chat. */
    markMessages: boolean;
    /** Text size of the game's chat (messages, logs, message input); icons keep their size. */
    chatTextSize: ChatTextSize;
    /** The room logs that only tell someone came in or left. */
    movementLogs: MovementLogMode;
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
    messagesPublic: true,
    messagesPrivate: true,
    messagesMush: true,
    mentions: true,
    alerts: true,
    notificationSound: true,
    closeToTray: true,
    minimizeToTray: false,
    launchAtStartup: false,
    startMinimized: true,
    gameAutoZoom: true,
    gameLanguage: 'auto',
    spellcheck: true,
    darkChat: true,
    largeChat: true,
    markMessages: true,
    chatTextSize: 'normal',
    movementLogs: 'compact',
    gameZoomOffset: 0,
    trayHintShown: false,
};

const BOOLEAN_KEYS = ['newCycles', 'newDays', 'messages', 'messagesPublic', 'messagesPrivate', 'messagesMush', 'mentions', 'alerts', 'notificationSound', 'closeToTray', 'minimizeToTray', 'launchAtStartup', 'startMinimized', 'gameAutoZoom', 'spellcheck', 'darkChat', 'largeChat', 'markMessages', 'trayHintShown'] as const;
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
    if ((MOVEMENT_LOG_MODES as readonly unknown[]).includes(input.movementLogs)) {
        settings.movementLogs = input.movementLogs as MovementLogMode;
    }
    if ((CHAT_TEXT_SIZES as readonly unknown[]).includes(input.chatTextSize)) {
        settings.chatTextSize = input.chatTextSize as ChatTextSize;
    }
    if (isGameLanguageSetting(input.gameLanguage)) {
        settings.gameLanguage = input.gameLanguage;
    }
    if (typeof input.gameZoomOffset === 'number' && Number.isFinite(input.gameZoomOffset)) {
        const steps = Math.round(input.gameZoomOffset * 4) / 4;
        settings.gameZoomOffset = Math.min(ZOOM_OFFSET_LIMIT, Math.max(-ZOOM_OFFSET_LIMIT, steps));
    }

    return settings;
}

function isGameLanguageSetting(value: unknown): value is GameLanguageSetting {
    return value === 'auto' || (GAME_LANGUAGES as readonly unknown[]).includes(value);
}
