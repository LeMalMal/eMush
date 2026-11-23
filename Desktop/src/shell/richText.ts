import type { Inline, RichBlock } from '../main/api/gameText';
import { bridge } from './bridge';
import { h } from './dom';

/** Renders the game's formatted text (already parsed by the main process) with DOM nodes only. */
export function renderRich(blocks: RichBlock[]): HTMLElement {
    return h('div', { class: 'rich' }, ...blocks.map((block) => block.kind === 'paragraph'
        ? h('p', {}, ...block.inlines.map(renderInline))
        : h('ul', {}, ...block.items.map((item) => h('li', {}, ...item.map(renderInline))))));
}

/** One line of game text (a highlight, a triumph gain). */
export function renderLine(inlines: Inline[]): HTMLElement {
    return h('span', {}, ...inlines.map(renderInline));
}

function renderInline(inline: Inline): Node {
    let node: Node = inline.href
        ? h('button', { class: 'rich-link', type: 'button', title: inline.href, onclick: () => bridge.openLink(inline.href as string) }, inline.text)
        : document.createTextNode(inline.text);

    if (inline.strike) {
        node = h('s', {}, node);
    }
    if (inline.em) {
        node = h('em', {}, node);
    }
    if (inline.strong) {
        node = h('strong', {}, node);
    }

    return node;
}
