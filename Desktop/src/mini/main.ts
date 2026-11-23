import type { JoinResult } from '../main/api/EmushApi';
import type { Loaded } from '../main/pages/view';
import type { ChatTarget } from '../main/background/events';
import type { MiniView } from '../main/pages/mini';
import type { SendMessageRequest } from '../main/pages/sendMessage';
import { createComposer } from './composer';
import { h } from '../shell/dom';
import { headUrl, icon, loadingState } from '../shell/ui';

// The small panel next to the clock. Data comes from the main process; the countdown ticks here.

type MiniBridge = {
    /** `channelId`: the tab picked, the public channel otherwise. */
    load(channelId?: number | null): Promise<Loaded<MiniView>>;
    showMessage(target: ChatTarget): void;
    send(request: SendMessageRequest): Promise<JoinResult>;
    command(command: 'open-game' | 'open-window' | 'open-death' | 'pin' | 'unpin' | 'close'): void;
    onRefresh(listener: () => void): void;
    onPinned(listener: (pinned: boolean) => void): void;
};

const bridge = (window as unknown as { emushMini: MiniBridge }).emushMini;
const root = document.getElementById('mini') as HTMLElement;
const REFRESH_EVERY_MS = 30_000;

let pinned = false;
let nextCycleAt: number | null = null;
let countdown: HTMLElement | null = null;
let refreshTimer: number | undefined;
/** The chat tab picked by the player (null: the public channel). */
let channelId: number | null = null;
/** Kept across redraws: a message being written is never lost. */
const composer = createComposer((request) => bridge.send(request), () => void refresh(true));

function header(title: string, subtitle: string | null, characterKey: string | null): HTMLElement {
    return h('header', { class: 'mini-head' },
        characterKey ? h('img', { class: 'mini-face', src: headUrl(characterKey), alt: '' }) : h('img', { class: 'mini-face', src: 'img/logo.png', alt: '' }),
        h('div', { class: 'mini-titles' }, h('b', {}, title), subtitle ? h('span', { class: 'label' }, subtitle) : null),
        h('button', {
            class: pinned ? 'mini-icon on' : 'mini-icon',
            type: 'button',
            title: pinned ? 'Détacher : se ferme quand tu cliques ailleurs' : 'Épingler : rester au premier plan',
            onclick: () => bridge.command(pinned ? 'unpin' : 'pin'),
        }, pinned ? '◆' : '◇'),
        h('button', { class: 'mini-icon', type: 'button', title: 'Fermer', onclick: () => bridge.command('close') }, '×'));
}

function render(view: MiniView): void {
    if (view.status !== 'alive') {
        nextCycleAt = null;
        countdown = null;
        root.replaceChildren(
            header('eMush', null, null),
            h('div', { class: 'state' }, h('h2', {}, view.title), h('p', {}, view.text)),
            h('footer', { class: 'mini-foot' }, view.status === 'dead'
                ? h('button', { class: 'btn red block', type: 'button', onclick: () => bridge.command('open-death') }, 'Écrire ton épitaphe')
                : h('button', { class: 'btn red block', type: 'button', onclick: () => bridge.command('open-window') }, 'Ouvrir eMush')));
        return;
    }

    composer.setChannel(view.channel);
    nextCycleAt = view.nextCycleAt ? Date.parse(view.nextCycleAt) : null;
    countdown = h('b', { class: 'mini-countdown' }, formatRemaining());

    const shown = view.channel;
    const canReply = shown?.scope === 'public'; // Private and Mush channels have no threads.
    const messages = view.messages.length > 0
        ? h('ol', { class: 'mini-chat' }, ...view.messages.map((message) => h('li', {
            class: [message.unread ? 'unread' : '', message.reply ? 'reply' : '', message.mark ?? ''].join(' ').trim() || undefined,
            title: 'Voir ce message dans le jeu',
            onclick: () => shown && bridge.showMessage({ channelId: shown.id, author: message.author, text: message.text }),
        },
            message.authorKey ? avatar(message.authorKey) : h('span', { class: 'mini-avatar' }),
            h('div', {},
                h('span', { class: 'mini-meta' }, h('b', {}, message.author), message.date ? h('span', {}, message.date) : null,
                    canReply ? h('button', {
                        class: 'mini-reply-button',
                        type: 'button',
                        title: 'Répondre à ce fil',
                        onclick: (event: Event) => {
                            event.stopPropagation(); // Replying here, not opening the game.
                            composer.replyTo({ threadId: message.threadId, author: message.author });
                        },
                    }, '↩') : null),
                h('p', {}, message.text)))))
        : h('p', { class: 'muted mini-empty' }, 'Aucun message récent.');

    const sections: (Node | null)[] = [
        header(view.character.name, [view.room, view.when].filter(Boolean).join(' · ') || null, view.character.key),
        h('section', { class: 'mini-cycle slot' }, h('span', { class: 'label' }, 'Prochain cycle'), countdown),
        // One compact row: icon and value; the name (PA, PM, PV, Moral) on hover and for screen readers.
        h('section', { class: 'mini-points' }, ...view.points.map((point) => {
            const value = point.max !== null ? `${point.value}/${point.max}` : String(point.value);
            return h('div', { class: 'mini-point slot', title: point.label, 'aria-label': `${point.label} : ${value}` }, icon(point.icon), h('b', {}, value));
        })),
        view.ship.length > 0
            ? h('section', { class: 'mini-ship', 'aria-label': 'Daedalus' }, ...view.ship.map((gauge) => h('span', {
                class: gauge.low ? 'mini-gauge low' : 'mini-gauge',
                title: gauge.low ? `${gauge.label} : niveau bas` : gauge.label,
            }, icon(gauge.icon), h('b', {}, gauge.value))))
            : null,
        view.orbit
            ? h('section', { class: 'mini-orbit', 'aria-label': 'Position du Daedalus' },
                view.orbit.image ? h('img', { src: view.orbit.image, alt: '' }) : null,
                h('div', {}, h('b', {}, view.orbit.title), h('span', {}, view.orbit.hint)))
            : null,
        view.titles.length > 0 || view.diseases.length > 0
            ? h('section', { class: 'mini-alerts' },
                ...view.titles.map((title) => h('span', { class: 'tag ok' }, title)),
                ...view.diseases.map((disease) => h('span', { class: 'tag rare' }, icon('disease'), disease)))
            : null,
        view.alerts.length > 0
            ? h('section', { class: 'mini-alerts' }, ...view.alerts.map((alert) => h('span', { class: 'tag alert', title: alert.description }, alert.name)))
            : null,
        h('section', { class: 'mini-chat-box' },
            view.channels.length > 1
                ? h('div', { class: 'mini-tabs', role: 'tablist' }, ...view.channels.map((tab) => h('button', {
                    class: 'mini-tab',
                    type: 'button',
                    role: 'tab',
                    'aria-selected': String(tab.id === shown?.id),
                    onclick: () => {
                        channelId = tab.id;
                        void refresh(true);
                    },
                }, tab.name, tab.unread > 0 ? h('span', { class: 'mini-tab-unread' }, tab.unread > 99 ? '99+' : String(tab.unread)) : null)))
                : h('div', { class: 'mini-chat-title' }, h('span', { class: 'title' }, shown?.name ?? 'Chat'),
                    shown && shown.unread > 0 ? h('span', { class: 'tag ok' }, `${shown.unread} non lus`) : null),
            messages,
            composer.element),
        h('footer', { class: 'mini-foot' }, h('button', { class: 'btn red block', type: 'button', onclick: () => bridge.command('open-game') }, 'Ouvrir le jeu')),
    ];
    root.replaceChildren(...sections.filter((section): section is Node => section !== null));
}

/** The author's pixel head; an author the client has no sprite for gets an empty square, never a broken image. */
function avatar(characterKey: string): HTMLImageElement {
    const image = h('img', { class: 'mini-avatar', src: headUrl(characterKey), alt: '' });
    image.addEventListener('error', () => {
        image.style.visibility = 'hidden';
    }, { once: true });

    return image;
}

function formatRemaining(): string {
    if (nextCycleAt === null) {
        return '—';
    }
    const seconds = Math.max(0, Math.floor((nextCycleAt - Date.now()) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;

    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/** Reloads the panel; the automatic refresh waits while the player is writing (`force`: after sending). */
async function refresh(force = false): Promise<void> {
    if (!force && composer.isBusy) {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => void refresh(), REFRESH_EVERY_MS);
        return;
    }
    if (root.childElementCount === 0) {
        root.replaceChildren(loadingState('Connexion au Daedalus…'));
    }
    const result = await bridge.load(channelId);
    if (result.ok) {
        if (result.view.status === 'alive') {
            channelId = result.view.channel?.id ?? null; // The tab picked may have closed: the server chose another.
        }
        render(result.view);
    } else {
        root.replaceChildren(header('eMush', null, null), h('div', { class: 'state' }, h('h2', {}, 'Liaison perdue'), h('p', {}, result.message)));
    }
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => void refresh(), REFRESH_EVERY_MS);
}

// Live countdown; once the cycle has passed, fetch the new one shortly after.
window.setInterval(() => {
    if (countdown === null) {
        return;
    }
    countdown.textContent = formatRemaining();
    if (nextCycleAt !== null && Date.now() > nextCycleAt + 5_000) {
        nextCycleAt = null;
        void refresh();
    }
}, 1000);

bridge.onRefresh(() => void refresh());
bridge.onPinned((value) => {
    pinned = value;
    document.body.classList.toggle('pinned', pinned);
    void refresh();
});
void refresh();
