/**
 * The web game has no live updates: its chat reloads only after an action or a channel switch.
 * The client knows when new messages arrive (background watch), so it asks the game to reload its
 * channels with the game's own store action, exactly what the web client does after an error.
 *
 * The reload remounts the message input (which then takes the focus) and replaces the messages, so it
 * waits while it would get in the player's way, and is retried every few seconds until it can be done:
 * - a reply box or the formatting dialog is open (they would close and lose their text);
 * - the player is typing a message, or another field of the game has the focus;
 * - the player is reading older messages (chat scrolled down): they would vanish and the text would move.
 * Drafts do not block it. The game keeps one draft per channel, but keyed by the channel object
 * (`referenceId`, renumbered by every reload), so the script carries the drafts over to the reloaded
 * channels itself, matched by scope, id and pirated player.
 */
export type ChatRefreshResult =
    | 'refreshed'
    /** The game is already reloading its channels. */
    | 'busy'
    | 'writing'
    | 'replying'
    | 'reading'
    | 'not-playing'
    | 'unavailable';

/** Results that mean "not now": the refresh is retried a bit later. */
const DEFERRED_RESULTS: ReadonlySet<string> = new Set<ChatRefreshResult>(['writing', 'replying', 'reading']);

/** Scrolled further than this from the newest messages (at the top of the chat), the player is reading older ones. */
export const READING_OFFSET_PX = 40;
/** A deferred refresh is tried again after this delay. */
export const CHAT_REFRESH_RETRY_MS = 4_000;
/** Keys pressed less than this long ago in the game page: the player is still writing. */
export const TYPING_PAUSE_MS = 20_000;

/**
 * Runs inside the game page (`executeJavaScript`): a self-contained expression returning a ChatRefreshResult.
 * `typing`: keys were pressed in the game page just before (known by the main process only).
 */
export function refreshGameChatScript({ typing }: { typing: boolean }): string {
    return `(() => {
    const typing = ${JSON.stringify(typing)};
    const root = document.querySelector('#app');
    const store = root && root.__vue_app__ && root.__vue_app__.config.globalProperties.$store;
    if (!store || typeof store.dispatch !== 'function') { return 'unavailable'; }
    const player = store.getters['player/player'];
    if (!player || player.gameStatus !== 'in_game') { return 'not-playing'; }
    if (!document.querySelector('.comms-panel')) { return 'unavailable'; }
    if (store.state.communication && store.state.communication.loadingChannels) { return 'busy'; }
    if (document.querySelector('.comms-panel .chatbox .chat-input')) { return 'replying'; }
    if (document.querySelector('.message-input-advanced-overlay')) { return 'writing'; }
    const input = document.querySelector('.comms-panel .chatbox-container > .chat-input textarea');
    const focused = document.activeElement;
    const isTextField = (element) => !!element && (element.tagName === 'TEXTAREA'
        || (element.tagName === 'INPUT' && ['text', 'search'].includes(element.type))
        || element.isContentEditable === true);
    if (isTextField(focused) && focused !== input) { return 'writing'; }
    const inputText = input ? String(input.value || '') : '';
    if (typing && focused === input && inputText.trim() !== '') { return 'writing'; }
    const chatbox = document.querySelector('.comms-panel .chatbox');
    if (chatbox && chatbox.scrollTop > ${READING_OFFSET_PX}) { return 'reading'; }

    const communication = store.state.communication;
    const channelKey = (channel) => [channel.scope, channel.id, channel.piratedPlayer].join(':');
    const drafts = new Map();
    for (const channel of communication.channels || []) {
        const draft = (communication.typedMessage || {})[channel.referenceId];
        if (draft && draft.trim() !== '') { drafts.set(channelKey(channel), draft); }
    }
    if (inputText.trim() !== '' && communication.currentChannel) { drafts.set(channelKey(communication.currentChannel), inputText); }

    Promise.resolve(store.dispatch('communication/loadAlivePlayerChannels')).then(() => {
        const restored = {};
        for (const channel of communication.channels || []) {
            if (drafts.has(channelKey(channel))) { restored[channel.referenceId] = drafts.get(channelKey(channel)); }
        }
        if (Object.keys(restored).length > 0) {
            // What the game's setTypedMessage mutation does, for every channel at once.
            communication.typedMessage = Object.assign({}, communication.typedMessage, restored);
        }
    });
    return 'refreshed';
})()`;
}

/** Remembers the last key pressed in the game page. */
export class KeyboardActivity {
    private lastKeyAt = -Infinity;

    record(nowMs: number): void {
        this.lastKeyAt = nowMs;
    }

    isTyping(nowMs: number): boolean {
        return nowMs - this.lastKeyAt < TYPING_PAUSE_MS;
    }
}

export type ChatRefreshPorts = {
    /** Runs the refresh in the game page, or says the game page is not open. */
    run(options: { typing: boolean }): Promise<ChatRefreshResult | 'off-game'>;
    /** The player is typing in the game page right now. */
    isTyping(): boolean;
    schedule(callback: () => void, delayMs: number): () => void;
};

/** Reloads the game chat now, or as soon as it no longer gets in the player's way. */
export class RefreshGameChat {
    private cancelRetry: (() => void) | null = null;

    constructor(private readonly ports: ChatRefreshPorts) {}

    async execute(): Promise<ChatRefreshResult | 'off-game'> {
        this.cancelPendingRetry();
        const result = await this.ports.run({ typing: this.ports.isTyping() });
        this.cancelPendingRetry(); // Another refresh may have started meanwhile.
        if (DEFERRED_RESULTS.has(result)) {
            this.cancelRetry = this.ports.schedule(() => {
                this.cancelRetry = null;
                void this.execute();
            }, CHAT_REFRESH_RETRY_MS);
        }

        return result;
    }

    private cancelPendingRetry(): void {
        this.cancelRetry?.();
        this.cancelRetry = null;
    }
}

/** Coming back to the window refreshes the chat, but not more often than this. */
export const FOCUS_REFRESH_MIN_INTERVAL_MS = 15_000;

/** Decides when coming back to the window is worth a chat reload (pure, for tests). */
export class FocusRefreshThrottle {
    private lastAt = -Infinity;

    constructor(private readonly minIntervalMs = FOCUS_REFRESH_MIN_INTERVAL_MS) {}

    execute(nowMs: number): boolean {
        if (nowMs - this.lastAt < this.minIntervalMs) {
            return false;
        }
        this.lastAt = nowMs;
        return true;
    }
}
