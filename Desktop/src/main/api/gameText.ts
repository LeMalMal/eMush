/**
 * The game's light markup, as used by news, character abstracts and skills:
 * `//` line breaks, `- ` bullets, `**bold**`, `*italic*`, `~~strike~~`, `[text](url)` links,
 * bare links and `:icon:` tokens. Parsed into plain data so the shell renders it with DOM APIs
 * (never innerHTML): server text can't inject markup into the client.
 */

export type Inline = { text: string; strong?: true; em?: true; strike?: true; href?: string };
export type RichBlock = { kind: 'paragraph'; inlines: Inline[] } | { kind: 'list'; items: Inline[][] };

const ICON_LABELS: Record<string, string> = {
    pa: 'PA', ap: 'PA', pm: 'PM', mp: 'PM', pmo: 'PMo', moral: 'PMo', pv: 'PV', hp: 'PV',
    triumph: 'triomphe', triumph_mush: 'triomphe Mush', xp: 'XP', spore: 'spore', point: '•',
    oxygen: 'oxygène', fuel: 'fuel', shield: 'armure', plasma: 'bouclier',
};

const LINE_BREAK = /(?<!https?:)\/\//g;
const INLINE_TOKEN = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()\]]+)|\*\*(.+?)\*\*|~~(.+?)~~|\*(.+?)\*|:([a-z0-9_]+):/gi;

export function parseRichText(source: string): RichBlock[] {
    const lines = source.replace(LINE_BREAK, '\n').split(/\r?\n/).map((line) => line.trim());
    const blocks: RichBlock[] = [];
    let paragraph: string[] = [];
    let list: string[] = [];

    const flushParagraph = (): void => {
        if (paragraph.length > 0) {
            blocks.push({ kind: 'paragraph', inlines: parseInlines(paragraph.join(' ')) });
            paragraph = [];
        }
    };
    const flushList = (): void => {
        if (list.length > 0) {
            blocks.push({ kind: 'list', items: list.map(parseInlines) });
            list = [];
        }
    };

    for (const line of lines) {
        const bullet = /^[-•]\s+(.*)$/.exec(line);
        if (bullet) {
            flushParagraph();
            list.push(bullet[1]);
        } else if (line === '') {
            flushParagraph();
            flushList();
        } else {
            flushList();
            paragraph.push(line);
        }
    }
    flushParagraph();
    flushList();

    return blocks;
}

export function parseInlines(source: string): Inline[] {
    const inlines: Inline[] = [];
    let cursor = 0;

    for (const match of source.matchAll(INLINE_TOKEN)) {
        const index = match.index ?? 0;
        pushText(inlines, source.slice(cursor, index));
        cursor = index + match[0].length;

        const [, linkText, linkUrl, bareUrl, strong, strike, em, icon] = match;
        if (linkUrl) {
            inlines.push({ text: linkText, href: linkUrl });
        } else if (bareUrl) {
            const url = bareUrl.replace(/[.,;:!?]+$/, '');
            inlines.push({ text: url, href: url });
            pushText(inlines, bareUrl.slice(url.length));
        } else if (strong !== undefined) {
            inlines.push(...parseInlines(strong).map((inline) => ({ ...inline, strong: true as const })));
        } else if (strike !== undefined) {
            inlines.push(...parseInlines(strike).map((inline) => ({ ...inline, strike: true as const })));
        } else if (em !== undefined) {
            inlines.push(...parseInlines(em).map((inline) => ({ ...inline, em: true as const })));
        } else if (icon !== undefined) {
            pushText(inlines, iconLabel(icon));
        }
    }
    pushText(inlines, source.slice(cursor));

    return inlines;
}

/** One-line plain text, for excerpts and table cells. */
export function toPlainText(source: string): string {
    return parseRichText(source)
        .map((block) => block.kind === 'paragraph'
            ? inlineText(block.inlines)
            : block.items.map(inlineText).join(' · '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function toExcerpt(source: string, maxLength = 160): string {
    const plain = toPlainText(source);

    return plain.length <= maxLength ? plain : `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

function inlineText(inlines: Inline[]): string {
    return inlines.map((inline) => inline.text).join('');
}

function iconLabel(token: string): string {
    const key = token.toLowerCase();
    if (key in ICON_LABELS) {
        return ICON_LABELS[key];
    }

    return key.startsWith('pa_') || key.startsWith('ap_') ? 'PA' : '';
}

function pushText(inlines: Inline[], text: string): void {
    if (text === '') {
        return;
    }
    const last = inlines[inlines.length - 1];
    if (last && last.href === undefined && !last.strong && !last.em && !last.strike) {
        last.text += text;
    } else {
        inlines.push({ text });
    }
}
