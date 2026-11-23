import { describe, expect, it } from 'vitest';
import { openGameChannelScript } from './openGameChannel';

type FakeChannel = { id: number | null; scope: string; piratedPlayer: number | null };

/** A chat message element of the game page, recording what the script does to it. */
function fakeMessage(author: string, text: string, options: { hidden?: boolean } = {}) {
    const toggle = { clicked: false, click() { this.clicked = true; } };
    /** The chat's scrolling box: 400 px high, its top at 100 px; the message sits 800 px further down. */
    const chat = { scrollTop: 0, clientHeight: 400, getBoundingClientRect: () => ({ top: 100 }) };
    const element = {
        author, text, toggle, chat, animated: false,
        get scrolled() { return chat.scrollTop > 0; },
        hidden: options.hidden ?? false,
        offsetHeight: 50,
        classList: { contains: (name: string) => name === 'hidden' && element.hidden },
        querySelector: (selector: string) => (selector === '.author' ? { textContent: `${author} :` } : selector === '.text' ? bubble : null),
        closest: (selector: string) => selector === '.unit'
            ? { querySelector: (inner: string) => (inner === '.toggle-children' ? toggle : null) }
            : selector === '.chatbox' ? chat : null,
        getBoundingClientRect: () => ({ top: 900 }),
    };
    const bubble = { textContent: `${author} : ${text} 2 min`, animate: () => { element.animated = true; } };

    return element;
}

type PageOptions = { channels?: FakeChannel[] | null; currentId?: number; loadingChannels?: boolean; messages?: ReturnType<typeof fakeMessage>[] };

/** Handwritten fake of the game page: its Vuex store (recording dispatches), its chat messages and the focused element. */
function fakeGamePage(options: PageOptions = {}) {
    const dispatched: unknown[][] = [];
    const focus = { blurred: false, blur() { this.blurred = true; } };
    const channels = options.channels === undefined
        ? [{ id: 89607, scope: 'public', piratedPlayer: null }, { id: 7, scope: 'private', piratedPlayer: 3 }, { id: 7, scope: 'private', piratedPlayer: null }]
        : options.channels;
    const store = {
        getters: {
            'communication/channels': channels,
            'communication/currentChannel': { id: options.currentId ?? 89607, scope: 'public', piratedPlayer: null },
            'communication/loading': false,
        },
        state: { communication: { loadingChannels: options.loadingChannels ?? false } },
        dispatch: (...args: unknown[]) => { dispatched.push(args); },
    };
    const document = {
        querySelector: (selector: string) => (selector === '#app' ? { __vue_app__: { config: { globalProperties: { $store: store } } } } : null),
        querySelectorAll: (selector: string) => (selector === '.comms-panel .chatbox .message' ? options.messages ?? [] : []),
        activeElement: focus,
    };
    const run = async (channelId: number, author = 'Hua', text = 'On explore la planète ?'): Promise<unknown> => {
        const result = await new Function('document', `return ${openGameChannelScript({ channelId, author, text }, { attempts: 6, delayMs: 0 })};`)(document);
        await new Promise((resolve) => setTimeout(resolve, 60)); // The highlight comes right after.
        return result;
    };

    return { run, dispatched, focus };
}

describe('openGameChannelScript', () => {
    it('opens the channel with the game\'s own store action, never its pirated copy', async () => {
        const page = fakeGamePage({ messages: [fakeMessage('Hua', 'On explore la planète ?')] });

        expect(await page.run(7)).toEqual({ channel: 'opened', message: 'shown' });
        expect(page.dispatched).toEqual([['communication/changeChannel', { channel: { id: 7, scope: 'private', piratedPlayer: null } }]]);
    });

    it('scrolls to the message and makes it flash, whatever the game\'s icons and line breaks did to its text', async () => {
        const older = fakeMessage('Hua', 'Bonjour');
        const notified = fakeMessage('Hua', 'On explore la //planète ?');
        const page = fakeGamePage({ currentId: 7, messages: [older, notified] });

        expect(await page.run(7)).toEqual({ channel: 'already-open', message: 'shown' });
        expect([notified.scrolled, notified.animated, older.scrolled]).toEqual([true, true, false]);
        expect(notified.chat.scrollTop).toBe(800 - (400 - 50) / 2); // Centred in the chat; the page itself does not move.
    });

    it('unfolds a reply hidden by the game', async () => {
        const reply = fakeMessage('Hua', 'On explore la planète ?', { hidden: true });

        await fakeGamePage({ currentId: 7, messages: [reply] }).run(7);

        expect(reply.toggle.clicked).toBe(true);
    });

    it('settles for the author\'s newest message when the text is not found', async () => {
        const newest = fakeMessage('Hua', 'Un autre message');

        expect(await fakeGamePage({ currentId: 7, messages: [newest, fakeMessage('Chun', 'On explore la planète ?')] }).run(7)).toEqual({ channel: 'already-open', message: 'shown' });
        expect(newest.scrolled).toBe(true);
    });

    it('lets the game save the draft of the channel being left first', async () => {
        const page = fakeGamePage();

        await page.run(7);

        expect(page.focus.blurred).toBe(true);
    });

    it('gives up on a channel that is gone or a message that is not there', async () => {
        expect(await fakeGamePage().run(404)).toEqual({ channel: 'not-found', message: 'skipped' });
        expect(await fakeGamePage({ loadingChannels: true }).run(7)).toEqual({ channel: 'not-found', message: 'skipped' });
        expect(await fakeGamePage({ messages: [] }).run(7)).toEqual({ channel: 'opened', message: 'not-found' });
        expect(await fakeGamePage().run(-1)).toEqual({ channel: 'invalid', message: 'skipped' });
    });
});
