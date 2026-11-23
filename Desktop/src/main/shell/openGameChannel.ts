import type { ChatTarget } from '../background/events';

/**
 * Clicking a message notification shows that message in the web game: its channel is opened with the
 * game's own store action, then the message is scrolled into view and flashes for a few seconds. The
 * game marks a message as read as soon as the mouse passes over it, so its "new" mark alone would not
 * be enough to find it. The game may still be loading its channels or messages, so the script waits.
 */


export type OpenChannelResult = {
    channel: 'opened' | 'already-open' | 'not-found' | 'invalid';
    /** `shown`: the message was found and highlighted. */
    message: 'shown' | 'not-found' | 'skipped';
};

export type OpenChannelTiming = { attempts: number; delayMs: number };
const WAIT_FOR_GAME: OpenChannelTiming = { attempts: 40, delayMs: 250 };

/** Characters compared to find the message (its text in the page has icons and line breaks of its own). */
const MATCHED_LENGTH = 24;
/** Attempts before settling for the author's newest message (the page may still show older messages). */
const FALLBACK_AFTER_ATTEMPTS = 4;

/** Runs inside the game page (`executeJavaScript`): a promise of an OpenChannelResult. */
export function openGameChannelScript(target: ChatTarget, timing: OpenChannelTiming = WAIT_FOR_GAME): string {
    if (!Number.isSafeInteger(target.channelId) || target.channelId <= 0) {
        return `Promise.resolve(${JSON.stringify({ channel: 'invalid', message: 'skipped' } satisfies OpenChannelResult)})`;
    }

    return `new Promise((resolve) => {
    const channelId = ${target.channelId};
    const comparable = (text) => String(text || '').toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, '');
    const author = comparable(${JSON.stringify(target.author)});
    const text = comparable(${JSON.stringify(target.text)});
    const store = () => {
        const root = document.querySelector('#app');
        return root && root.__vue_app__ && root.__vue_app__.config.globalProperties.$store;
    };
    const retry = (step, attempts, giveUp) => {
        if (attempts + 1 >= ${timing.attempts}) {
            giveUp();
        } else {
            setTimeout(() => step(attempts + 1), ${timing.delayMs});
        }
    };

    const findMessage = (orNewestOfAuthor) => {
        const messages = Array.from(document.querySelectorAll('.comms-panel .chatbox .message'))
            .filter((element) => comparable((element.querySelector('.author') || {}).textContent).startsWith(author));
        const content = (element) => comparable((element.querySelector('.text') || element).textContent);
        const exact = messages.find((element) => text !== '' && (content(element).includes(text.slice(0, ${MATCHED_LENGTH})) || content(element).includes(text.slice(-${MATCHED_LENGTH}))));
        return exact || (orNewestOfAuthor ? messages[0] : undefined);
    };
    const showMessage = (channel, attempts) => {
        const game = store();
        const loading = !game || game.getters['communication/loading'];
        // The exact message first; its author's newest message once the channel had time to load.
        const message = loading ? undefined : findMessage(attempts >= ${FALLBACK_AFTER_ATTEMPTS});
        if (!message) {
            retry((next) => showMessage(channel, next), attempts, () => resolve({ channel, message: 'not-found' }));
            return;
        }
        if (message.classList.contains('hidden')) {
            const toggle = message.closest('.unit') && message.closest('.unit').querySelector('.toggle-children');
            if (toggle) { toggle.click(); } // A reply folded by the game: unfold its thread.
        }
        setTimeout(() => {
            // Only the chat scrolls (scrollIntoView would also move the whole game page).
            const chat = message.closest('.chatbox');
            if (chat) {
                const offset = message.getBoundingClientRect().top - chat.getBoundingClientRect().top;
                chat.scrollTop = Math.max(0, chat.scrollTop + offset - (chat.clientHeight - message.offsetHeight) / 2);
            }
            (message.querySelector('.text') || message).animate(
                [{ boxShadow: '0 0 0 3px #fe9c00, 0 0 18px #fe9c00' }, { boxShadow: '0 0 0 0 rgba(254, 156, 0, 0)' }],
                { duration: 1000, iterations: 4 },
            );
        }, 50);
        resolve({ channel, message: 'shown' });
    };

    const openChannel = (attempts) => {
        const game = store();
        const channels = game ? game.getters['communication/channels'] : null;
        const channel = Array.isArray(channels) ? channels.find((candidate) => candidate.id === channelId && !candidate.piratedPlayer) : undefined;
        if (!channel || game.state.communication.loadingChannels) {
            retry(openChannel, attempts, () => resolve({ channel: 'not-found', message: 'skipped' }));
            return;
        }
        const current = game.getters['communication/currentChannel'];
        if (current && current.id === channelId && !current.piratedPlayer) {
            showMessage('already-open', 0);
            return;
        }
        // The game saves the message input's draft when it loses the focus: let it do so for the
        // channel being left, before the input disappears with it.
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        game.dispatch('communication/changeChannel', { channel });
        setTimeout(() => showMessage('opened', 0), ${timing.delayMs});
    };
    openChannel(0);
})`;
}
