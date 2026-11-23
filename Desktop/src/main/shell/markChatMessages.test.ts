import { describe, expect, it } from 'vitest';
import { markChatMessagesScript } from './markChatMessages';

/** A chat message of the game page: author, then the message, then its time, like Message.vue renders it. */
function fakeMessage(author: string, text: string) {
    const marks = new Set<string>();
    const part = (className: string | null, content: string) => ({ classList: { contains: (name: string) => name === className }, textContent: content });
    const bubble = { childNodes: [part('author', `${author} :`), part(null, text), part('timestamp', '2 min')] };

    return {
        marks,
        setAttribute: (name: string) => { marks.add(name); },
        hasAttribute: (name: string) => marks.has(name),
        removeAttribute: (name: string) => { marks.delete(name); },
        querySelector: (selector: string) => (selector === '.author' ? { textContent: `${author} :` } : selector === '.text' ? bubble : null),
    };
}

/** A room log of the game page: the character's name in bold, then the wording, like Log.vue renders it. */
function fakeLog(name: string, wording: string) {
    const marks = new Set<string>();
    const strong = { tagName: 'STRONG', textContent: name };
    const line = { firstElementChild: strong, firstChild: strong, textContent: name + wording };

    return {
        marks,
        setAttribute: (attribute: string) => { marks.add(attribute); },
        hasAttribute: (attribute: string) => marks.has(attribute),
        removeAttribute: (attribute: string) => { marks.delete(attribute); },
        querySelector: (selector: string) => (selector === '.text-log > span' ? line : null),
    };
}

/** Handwritten fake of the game page: its store (player), its chat messages, a MutationObserver and the next frame, both run by hand. */
function fakeGamePage(characterName: string) {
    const messages: ReturnType<typeof fakeMessage>[] = [];
    const logs: ReturnType<typeof fakeLog>[] = [];
    const observers: (() => void)[] = [];
    const frames: (() => void)[] = [];
    const store = { getters: { 'player/player': { character: { name: characterName } } } };
    const window: Record<string, unknown> = {};
    const document = {
        body: {},
        querySelector: (selector: string) => (selector === '#app' ? { __vue_app__: { config: { globalProperties: { $store: store } } } } : null),
        querySelectorAll: (selector: string) => (selector === '.comms-panel .chatbox .message' ? messages : selector === '.comms-panel .chatbox .log' ? logs : []),
    };
    class FakeMutationObserver {
        constructor(callback: () => void) { observers.push(callback); }
        observe(): void {}
    }
    const run = (): string => new Function('window', 'document', 'MutationObserver', 'requestAnimationFrame', `return ${markChatMessagesScript()};`)(
        window, document, FakeMutationObserver, (callback: () => void) => frames.push(callback),
    );
    /** The chat changed: the observer reacts, the marks follow at the next frame. */
    const chatChanged = (): void => {
        observers.forEach((callback) => callback());
        frames.splice(0).forEach((frame) => frame());
    };

    return { run, messages, logs, chatChanged };
}

describe('markChatMessagesScript', () => {
    it('marks the character\'s own messages and the ones naming the character, in the game page', () => {
        const page = fakeGamePage('Gioele');
        const own = fakeMessage('Gioele', 'Je répare la porte');
        const mention = fakeMessage('Roland', 'Gioele, rejoins-moi en baie');
        const other = fakeMessage('Hua', 'On explore ?');
        page.messages.push(own, mention, other);

        expect(page.run()).toBe('installed');

        expect([[...own.marks], [...mention.marks], [...other.marks]]).toEqual([['data-emush-own'], ['data-emush-mention'], []]);
    });

    it('does not take the author\'s name or the time for a mention', () => {
        const page = fakeGamePage('Roland');
        const reply = fakeMessage('Hua', 'On y va ?');
        page.messages.push(reply);

        page.run();

        expect([...reply.marks]).toEqual([]);
    });

    it('follows the chat as new messages appear, and installs itself only once', () => {
        const page = fakeGamePage('Gioele');
        page.run();
        const later = fakeMessage('Chun', '@gioele tu es où ?');
        page.messages.push(later);

        page.chatChanged();

        expect([...later.marks]).toEqual(['data-emush-mention']);
        expect(page.run()).toBe('marked');
    });

    it('marks the room logs that only tell someone came in or left', () => {
        const page = fakeGamePage('Gioele');
        const entered = fakeLog('Eleesha', ' est entrée.');
        const searched = fakeLog('Eleesha', ' a fouillé la pièce mais n’a rien découvert.');
        page.logs.push(entered, searched);

        page.run();

        expect([[...entered.marks], [...searched.marks]]).toEqual([['data-emush-movement'], []]);
    });
});
