import type { JoinResult } from '../main/api/EmushApi';
import type { SendMessageRequest } from '../main/pages/sendMessage';
import { h } from '../shell/dom';

/** Above this length the counter shows (the game's limit is 4096, a line break counting twice). */
const COUNTER_FROM = 3500;
const MAX_LENGTH = 4096;

export type Composer = {
    element: HTMLElement;
    /** The channel shown in the panel, where a new message goes. */
    setChannel(channel: { id: number; name: string } | null): void;
    /** Answers a thread (its first message) instead of writing a new message. */
    replyTo(thread: { threadId: number; author: string }): void;
    /** The player is writing: the panel should not redraw under their fingers. */
    readonly isBusy: boolean;
};

/**
 * Writing in the chat from the mini panel: a new message in the channel shown, or a reply to a thread.
 * Built once and kept across the panel's redraws, so a message being written is never lost.
 * Enter sends, Shift+Enter goes to the next line.
 */
export function createComposer(send: (request: SendMessageRequest) => Promise<JoinResult>, onSent: () => void): Composer {
    let channel: { id: number; name: string } | null = null;
    let reply: { threadId: number; author: string } | null = null;
    let sending = false;

    const replyLabel = h('span', {});
    const replyBar = h('div', { class: 'mini-reply', hidden: true }, replyLabel,
        h('button', { class: 'mini-icon', type: 'button', title: 'Annuler la réponse', onclick: () => cancelReply() }, '×'));
    const input = h('textarea', { class: 'mini-input', rows: 2, spellcheck: 'true', 'aria-label': 'Ton message' });
    const status = h('span', { class: 'mini-status', 'aria-live': 'polite' });
    const sendButton = h('button', { class: 'btn small', type: 'button', onclick: () => void submit() }, 'Envoyer');
    const element = h('form', { class: 'mini-composer', onsubmit: (event: Event) => event.preventDefault() },
        replyBar, input, h('div', { class: 'mini-composer-foot' }, status, sendButton));

    const length = (): number => input.value.length + input.value.split('\n').length - 1;
    const showCounter = (): void => {
        status.classList.remove('error');
        status.textContent = length() >= COUNTER_FROM ? `${length()} / ${MAX_LENGTH}` : '';
    };
    const placeholder = (): void => {
        input.placeholder = reply ? `Répondre à ${reply.author}…` : `Écrire dans ${channel?.name ?? 'le chat'}…`;
    };
    const cancelReply = (): void => {
        reply = null;
        replyBar.hidden = true;
        placeholder();
    };
    const submit = async (): Promise<void> => {
        if (sending || channel === null || input.value.trim() === '') {
            return;
        }
        sending = true;
        sendButton.disabled = true;
        status.classList.remove('error');
        status.textContent = 'Envoi…';
        const result = await send({ channelId: channel.id, text: input.value, parentId: reply?.threadId ?? null });
        sending = false;
        sendButton.disabled = false;
        if (result.ok) {
            input.value = '';
            status.textContent = 'Envoyé.';
            cancelReply();
            onSent();
        } else {
            status.classList.add('error');
            status.textContent = result.message;
        }
    };

    input.addEventListener('input', showCounter);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submit();
        } else if (event.key === 'Escape' && reply !== null) {
            cancelReply();
        }
    });
    placeholder();

    return {
        element,
        setChannel(next) {
            channel = next;
            element.hidden = next === null;
            placeholder();
        },
        replyTo(thread) {
            reply = thread;
            replyLabel.textContent = `Réponse à ${thread.author}`;
            replyBar.hidden = false;
            placeholder();
            input.focus();
        },
        get isBusy() {
            return sending || input.value.trim() !== '' || document.activeElement === input || reply !== null;
        },
    };
}
