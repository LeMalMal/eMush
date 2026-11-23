import { classifyChatMessage, comparableName, mentionsName } from '../background/names';

/**
 * Marks the character's own messages and the messages naming the character in the game's chat
 * (`data-emush-own`, `data-emush-mention` on the message), for the chat styles to show them. The marks
 * follow the chat as it changes (new messages, channel switch, "load more") through a MutationObserver.
 * Installed once per page; running it again only re-marks.
 */
export function markChatMessagesScript(): string {
    return `(() => {
    if (typeof window.__emushDesktopMarkChat === 'function') {
        window.__emushDesktopMarkChat();
        return 'marked';
    }
    ${comparableName.toString()}
    ${mentionsName.toString()}
    ${classifyChatMessage.toString()}

    const characterName = () => {
        const root = document.querySelector('#app');
        const store = root && root.__vue_app__ && root.__vue_app__.config.globalProperties.$store;
        const player = store && store.getters['player/player'];
        return player && player.character && typeof player.character.name === 'string' ? player.character.name : '';
    };
    /** The message itself, without its author and time. */
    const messageText = (bubble) => Array.from(bubble.childNodes)
        .filter((node) => !(node.classList && (node.classList.contains('author') || node.classList.contains('timestamp'))))
        .map((node) => node.textContent)
        .join(' ');
    const setMark = (element, name, on) => {
        if (on && !element.hasAttribute(name)) {
            element.setAttribute(name, '');
        } else if (!on && element.hasAttribute(name)) {
            element.removeAttribute(name);
        }
    };
    const mark = () => {
        const name = characterName();
        for (const message of document.querySelectorAll('.comms-panel .chatbox .message')) {
            const author = message.querySelector('.author');
            const bubble = message.querySelector('.text');
            const kind = author && bubble ? classifyChatMessage(author.textContent, messageText(bubble), name) : null;
            setMark(message, 'data-emush-own', kind === 'own');
            setMark(message, 'data-emush-mention', kind === 'mention');
        }
    };

    let scheduled = false;
    new MutationObserver(() => {
        if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(() => { scheduled = false; mark(); });
        }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__emushDesktopMarkChat = mark;
    mark();
    return 'installed';
})()`;
}
