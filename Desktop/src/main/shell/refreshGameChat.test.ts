import { describe, expect, it } from 'vitest';
import {
    CHAT_REFRESH_RETRY_MS,
    ChatRefreshResult,
    FocusRefreshThrottle,
    KeyboardActivity,
    RefreshGameChat,
    refreshGameChatScript,
    TYPING_PAUSE_MS,
} from './refreshGameChat';

type FakeElement = { tagName: string; type?: string; value?: string };
type FakeChannel = { scope: string; id: number; piratedPlayer: number | null; referenceId: number };
type ChannelName = 'public' | 'private' | 'pirated';

type PageOptions = {
    gameStatus?: string | null;
    withStore?: boolean;
    withChat?: boolean;
    loadingChannels?: boolean;
    replyBoxOpen?: boolean;
    formattingDialogOpen?: boolean;
    /** Text in the visible message input (public channel). */
    draft?: string;
    /** Drafts the game kept for channels (per channel object). */
    savedDrafts?: Partial<Record<ChannelName, string>>;
    focus?: 'message-input' | 'other-field' | 'nothing';
    scrollTop?: number;
};

/**
 * Handwritten fake of the web game page: its Vuex store (recording dispatches; reloading the channels
 * renumbers them, like the game) and the chat elements the script looks at.
 */
function fakeGamePage(options: PageOptions = {}) {
    const dispatched: unknown[][] = [];
    let lastReference = 0;
    const channel = (scope: string, id: number, piratedPlayer: number | null = null): FakeChannel => ({ scope, id, piratedPlayer, referenceId: ++lastReference });
    const loadChannels = (): Record<ChannelName, FakeChannel> => ({ public: channel('public', 1), private: channel('private', 7), pirated: channel('private', 7, 3) });
    let named = loadChannels();
    const savedDrafts = Object.entries(options.savedDrafts ?? {}) as [ChannelName, string][];
    const communication = {
        loadingChannels: options.loadingChannels ?? false,
        channels: Object.values(named),
        currentChannel: named.public,
        typedMessage: Object.fromEntries(savedDrafts.map(([name, text]) => [named[name].referenceId, text])) as Record<number, string>,
    };
    const store = {
        getters: { 'player/player': options.gameStatus === null ? null : { gameStatus: options.gameStatus ?? 'in_game' } },
        state: { communication },
        dispatch: (...args: unknown[]) => {
            dispatched.push(args);
            if (args[0] === 'communication/loadAlivePlayerChannels') {
                named = loadChannels();
                communication.channels = Object.values(named);
                communication.currentChannel = named.public;
            }
            return Promise.resolve(true);
        },
    };
    const messageInput: FakeElement = { tagName: 'TEXTAREA', value: options.draft ?? '' };
    const otherField: FakeElement = { tagName: 'INPUT', type: 'text', value: '' };
    const elements: Record<string, unknown> = {
        '#app': options.withStore === false ? {} : { __vue_app__: { config: { globalProperties: { $store: store } } } },
        '.comms-panel': options.withChat === false ? null : {},
        '.comms-panel .chatbox .chat-input': options.replyBoxOpen ? {} : null,
        '.message-input-advanced-overlay': options.formattingDialogOpen ? {} : null,
        '.comms-panel .chatbox-container > .chat-input textarea': messageInput,
        '.comms-panel .chatbox': { scrollTop: options.scrollTop ?? 0 },
    };
    const focused = { 'message-input': messageInput, 'other-field': otherField, nothing: { tagName: 'BODY' } }[options.focus ?? 'nothing'];
    const document = { querySelector: (selector: string) => elements[selector] ?? null, activeElement: focused };
    const run = (typing = false): string => new Function('document', `return ${refreshGameChatScript({ typing })};`)(document);
    /** Drafts of the reloaded channels, once the reload is over. */
    const draftsAfterReload = async (): Promise<Partial<Record<ChannelName, string>>> => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return Object.fromEntries((Object.entries(named) as [ChannelName, FakeChannel][])
            .filter(([, current]) => communication.typedMessage[current.referenceId] !== undefined)
            .map(([name, current]) => [name, communication.typedMessage[current.referenceId]]));
    };

    return { run, dispatched, draftsAfterReload };
}

const RELOAD = ['communication/loadAlivePlayerChannels'];

describe('refreshGameChatScript', () => {
    it('reloads the channels with the game\'s own store action', () => {
        const page = fakeGamePage();

        expect(page.run()).toBe('refreshed');
        expect(page.dispatched).toEqual([RELOAD]);
    });

    it('carries the drafts over to the reloaded channels, which the game renumbers', async () => {
        const page = fakeGamePage({ draft: 'Je répare la porte', savedDrafts: { private: 'Rendez-vous au labo', pirated: 'Psst' } });

        expect(page.run()).toBe('refreshed');

        expect(await page.draftsAfterReload()).toEqual({ public: 'Je répare la porte', private: 'Rendez-vous au labo', pirated: 'Psst' });
    });

    it('refreshes a focused message input once the player stopped typing, keeping its text', async () => {
        const page = fakeGamePage({ draft: 'Je répare la porte', focus: 'message-input' });

        expect(page.run(false)).toBe('refreshed');

        expect(await page.draftsAfterReload()).toEqual({ public: 'Je répare la porte' });
    });

    it('waits while the player is typing a message', () => {
        const page = fakeGamePage({ draft: 'Je répare la', focus: 'message-input' });

        expect(page.run(true)).toBe('writing');
        expect(page.dispatched).toEqual([]);
        expect(fakeGamePage({ draft: '', focus: 'message-input' }).run(true)).toBe('refreshed'); // Message just sent.
    });

    it('waits while a reply box or the formatting dialog is open, or another field of the game has the focus', () => {
        expect(fakeGamePage({ replyBoxOpen: true }).run()).toBe('replying');
        expect(fakeGamePage({ formattingDialogOpen: true }).run()).toBe('writing');
        expect(fakeGamePage({ focus: 'other-field' }).run()).toBe('writing');
    });

    it('waits while the player reads older messages, further down the chat', () => {
        const reading = fakeGamePage({ scrollTop: 300 });

        expect(reading.run()).toBe('reading');
        expect(reading.dispatched).toEqual([]);
        expect(fakeGamePage({ scrollTop: 12 }).run()).toBe('refreshed');
    });

    it('does nothing for a dead character, outside the game, or while the game already reloads', () => {
        expect(fakeGamePage({ gameStatus: 'finished' }).run()).toBe('not-playing');
        expect(fakeGamePage({ gameStatus: null }).run()).toBe('not-playing');
        expect(fakeGamePage({ withStore: false }).run()).toBe('unavailable');
        expect(fakeGamePage({ withChat: false }).run()).toBe('unavailable');
        expect(fakeGamePage({ loadingChannels: true }).run()).toBe('busy');
    });
});

/** Handwritten fakes of the game page (scripted results) and of the timer. */
function fakeChatRefresh(results: (ChatRefreshResult | 'off-game')[], typing = false) {
    const runs: boolean[] = [];
    const timers: { callback: () => void; delayMs: number; done: boolean }[] = [];
    const refresh = new RefreshGameChat({
        run: async (options) => {
            runs.push(options.typing);
            return results.shift() ?? 'refreshed';
        },
        isTyping: () => typing,
        schedule: (callback, delayMs) => {
            const timer = { callback, delayMs, done: false };
            timers.push(timer);
            return () => { timer.done = true; };
        },
    });
    const pending = () => timers.filter((timer) => !timer.done);
    const fireRetry = async (): Promise<void> => {
        const [timer] = pending();
        timer.done = true;
        timer.callback();
        await new Promise((resolve) => setTimeout(resolve, 0));
    };

    return { refresh, runs, pending, fireRetry };
}

describe('RefreshGameChat', () => {
    it('tries again every few seconds until the refresh no longer gets in the way', async () => {
        const chat = fakeChatRefresh(['reading', 'writing', 'refreshed']);

        expect(await chat.refresh.execute()).toBe('reading');
        expect(chat.pending().map((timer) => timer.delayMs)).toEqual([CHAT_REFRESH_RETRY_MS]);
        await chat.fireRetry();
        expect(chat.pending()).toHaveLength(1);
        await chat.fireRetry();

        expect(chat.runs).toHaveLength(3);
        expect(chat.pending()).toEqual([]);
    });

    it('replaces a pending retry when a new refresh is asked', async () => {
        const chat = fakeChatRefresh(['replying', 'refreshed']);

        await chat.refresh.execute();
        await chat.refresh.execute();

        expect(chat.pending()).toEqual([]);
    });

    it('stops when the game page is closed or the character is not playing', async () => {
        for (const result of ['off-game', 'not-playing', 'unavailable', 'busy'] as const) {
            const chat = fakeChatRefresh([result]);
            await chat.refresh.execute();
            expect(chat.pending()).toEqual([]);
        }
    });

    it('tells the page whether the player is typing', async () => {
        const chat = fakeChatRefresh(['refreshed'], true);

        await chat.refresh.execute();

        expect(chat.runs).toEqual([true]);
    });
});

describe('KeyboardActivity', () => {
    it('counts the player as typing until a pause in the keys', () => {
        const keyboard = new KeyboardActivity();
        expect(keyboard.isTyping(0)).toBe(false);

        keyboard.record(1_000);

        expect([keyboard.isTyping(1_000 + TYPING_PAUSE_MS - 1), keyboard.isTyping(1_000 + TYPING_PAUSE_MS)]).toEqual([true, false]);
    });
});

describe('FocusRefreshThrottle', () => {
    it('lets one refresh through, then waits before the next', () => {
        const throttle = new FocusRefreshThrottle(15_000);

        expect([throttle.execute(0), throttle.execute(5_000), throttle.execute(15_000), throttle.execute(20_000)]).toEqual([true, false, true, false]);
    });
});
