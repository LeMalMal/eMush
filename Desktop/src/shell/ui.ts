import type { Pager, Tag } from '../main/pages/view';
import { h } from './dom';

// Shared pieces of the retro interface (see static/shell/shell.css for the visual rules).

export type IconName = 'triumph' | 'triumph_mush' | 'sol' | 'dead' | 'planet' | 'xp';

export function portraitUrl(characterKey: string): string {
    return `img/characters/${encodeURIComponent(characterKey)}.jpg`;
}

export function headUrl(characterKey: string): string {
    return `img/heads/${encodeURIComponent(characterKey)}.png`;
}

export function bodyUrl(characterKey: string): string {
    return `img/bodies/${encodeURIComponent(characterKey)}.png`;
}

/** One of the game's 16 px pixel icons (decorative: the text next to it carries the meaning). */
export function icon(name: IconName, size: 'x1' | 'x2' = 'x1'): HTMLImageElement {
    return h('img', { class: size === 'x2' ? 'ico x2' : 'ico', src: `img/icons/${name}.png`, alt: '' });
}

/** A character's pixel sprite standing on the pedestal of the game's character selection. */
export function figure(characterKey: string): HTMLElement {
    return h('div', { class: 'figure', 'aria-hidden': 'true' }, h('img', { src: bodyUrl(characterKey), alt: '' }));
}

export function loader(): HTMLElement {
    return h('div', { class: 'loader', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
}

export function loadingState(label = 'Chargement…'): HTMLElement {
    return h('div', { class: 'state', role: 'status' }, loader(), h('p', { class: 'label' }, label));
}

export function errorState(message: string, onRetry: () => void): HTMLElement {
    return h('div', { class: 'box state' },
        h('h2', {}, 'Liaison perdue'),
        h('p', {}, message),
        h('button', { class: 'btn', type: 'button', onclick: onRetry }, 'Réessayer'));
}

export function emptyState(title: string, text: string, action?: HTMLElement): HTMLElement {
    return h('div', { class: 'state' }, h('h2', {}, title), h('p', {}, text), action);
}

export function pageHead(eyebrow: string, title: string, ...actions: (Node | null)[]): HTMLElement {
    return h('div', { class: 'page-head' },
        h('div', { class: 'titles' }, h('span', { class: 'label' }, eyebrow), h('h1', {}, title)),
        actions.length > 0 ? h('div', { class: 'toolbar' }, ...actions) : null);
}

/** Section heading in the style of the game's tooltip titles (clipboard icon, small caps). */
export function sectionTitle(text: string, id?: string, action?: HTMLElement | null): HTMLElement {
    return h('div', { class: 'section-title' }, h('h2', { class: 'title', id }, text), action ?? null);
}

export function tagElement(tag: Tag): HTMLElement {
    return h('span', { class: `tag ${tag.tone}` }, tag.label);
}

export function pagerControl(pager: Pager, onPage: (page: number) => void): HTMLElement | null {
    if (pager.pageCount <= 1) {
        return null;
    }

    return h('div', { class: 'pager' },
        h('button', { class: 'btn quiet', type: 'button', disabled: pager.page <= 1, onclick: () => onPage(pager.page - 1) }, '◂ Précédent'),
        h('span', {}, `Page ${pager.page} / ${pager.pageCount}`),
        h('button', { class: 'btn quiet', type: 'button', disabled: pager.page >= pager.pageCount, onclick: () => onPage(pager.page + 1) }, 'Suivant ▸'));
}

/** Filter tabs: one option pressed at a time. */
export function segmented<T extends string | null>(options: { value: T; label: string }[], selected: T, onSelect: (value: T) => void, label: string): HTMLElement {
    return h('div', { class: 'segmented', role: 'group', 'aria-label': label },
        ...options.map((option) => h('button', {
            type: 'button',
            'aria-pressed': String(option.value === selected),
            onclick: () => onSelect(option.value),
        }, option.label)));
}

/** Table rows that navigate: clickable and reachable with the keyboard (Enter). */
export function clickableRow(cells: HTMLElement[], onOpen: () => void, label: string): HTMLTableRowElement {
    return h('tr', {
        tabindex: 0,
        'aria-label': label,
        onclick: onOpen,
        onkeydown: (event: Event) => {
            if ((event as KeyboardEvent).key === 'Enter') {
                onOpen();
            }
        },
    }, ...cells);
}
