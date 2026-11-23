import { bridge } from './bridge';
import { h } from './dom';

/** Searching waits for a short pause in the typing, like a browser. */
const TYPING_DELAY_MS = 150;

export type FindBar = { close(): void };

/**
 * Ctrl+F search bar, drawn in the navigation bar over its right side (the web page is under the bar).
 * Enter: next match, Shift+Enter: previous, Escape: close.
 */
export function createFindBar(header: HTMLElement): FindBar {
    let timer: number | undefined;
    let searchedText = '';

    const input = h('input', {
        type: 'search',
        class: 'find-input',
        placeholder: 'Rechercher dans la page',
        'aria-label': 'Rechercher dans la page',
        maxlength: 200,
        spellcheck: 'false',
        autocomplete: 'off',
    });
    const count = h('span', { class: 'find-count', 'aria-live': 'polite' });
    const search = (forward: boolean): void => {
        window.clearTimeout(timer);
        const again = input.value === searchedText;
        searchedText = input.value;
        bridge.find({ text: input.value, forward, again });
    };
    const bar = h('form', { class: 'find-bar', role: 'search', hidden: true, onsubmit: (event: Event) => event.preventDefault() },
        input,
        count,
        h('button', { class: 'find-button', type: 'button', title: 'Précédent (Maj+Entrée)', 'aria-label': 'Résultat précédent', onclick: () => search(false) }, '▲'),
        h('button', { class: 'find-button', type: 'button', title: 'Suivant (Entrée)', 'aria-label': 'Résultat suivant', onclick: () => search(true) }, '▼'),
        h('button', { class: 'find-button', type: 'button', title: 'Fermer (Échap)', 'aria-label': 'Fermer la recherche', onclick: () => close() }, '×'));
    header.append(bar);

    const open = (): void => {
        bar.hidden = false;
        header.classList.add('finding');
        input.focus();
        input.select();
    };
    const close = (): void => {
        if (bar.hidden) {
            return;
        }
        window.clearTimeout(timer);
        bar.hidden = true;
        header.classList.remove('finding');
        count.textContent = '';
        searchedText = '';
        bridge.stopFind();
    };

    input.addEventListener('input', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => search(true), TYPING_DELAY_MS);
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            search(!event.shiftKey);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    });
    bridge.onFindOpen(open);
    bridge.onFindResult(({ active, matches }) => {
        count.textContent = input.value.trim() === '' ? '' : matches === 0 ? 'Aucun résultat' : `${active} / ${matches}`;
    });

    return { close };
}
