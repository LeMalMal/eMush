import type { NotificationText, NotificationVisual } from '../background/events';

/**
 * What one Mush-styled notification shows (toast page, src/toast): a label for what it is about, a
 * picture (the author's head, the alert's icon...), the text, and an accent colour for its kind.
 * Pictures are paths of the shell's images (the toast page shares the shell's folder).
 */
export type ToastView = {
    id: number;
    kind: NotificationVisual['kind'];
    label: string;
    title: string;
    body: string;
    image: string;
    /** A click opens something (the game, a message, the epitaph): the toast says so. */
    action: string;
};

const LABELS: Record<NotificationVisual['kind'], string> = {
    cycle: 'Nouveau cycle',
    day: 'Nouveau jour',
    alert: 'Alerte',
    message: 'Message',
    mention: 'On parle de toi',
    death: 'Fin de l’aventure',
    info: 'eMush',
};

const ACTIONS: Record<NotificationVisual['kind'], string> = {
    cycle: 'Reprendre la partie',
    day: 'Reprendre la partie',
    alert: 'Voir le vaisseau',
    message: 'Voir le message',
    mention: 'Voir le message',
    death: 'Écrire ton épitaphe',
    info: 'Ouvrir eMush',
};

/** The game's alert icons (App/src/enums/alerts.enum.ts), copied to img/alerts by scripts/copy-static.mjs. */
export const ALERT_ICONS: Record<string, string> = {
    no_alert: 'infoalert',
    low_oxygen: 'o2alert',
    low_hull: 'hull',
    fires: 'fire',
    broken_doors: 'door',
    broken_equipments: 'broken',
    no_gravity: 'simulator',
    gravity_reboot: 'simulator_reboot',
    hunger: 'hunger',
    hunter: 'hunter',
    communications_down: 'comm',
};

const CHARACTER_KEY = /^[a-z_]{2,30}$/;

export function toastView(id: number, text: NotificationText): ToastView {
    const visual = text.visual ?? { kind: 'info' };

    return { id, kind: visual.kind, label: LABELS[visual.kind], title: text.title, body: text.body, image: toastImage(visual), action: ACTIONS[visual.kind] };
}

function toastImage(visual: NotificationVisual): string {
    if ((visual.kind === 'message' || visual.kind === 'mention') && visual.characterKey && CHARACTER_KEY.test(visual.characterKey)) {
        return `img/heads/${visual.characterKey}.png`;
    }
    switch (visual.kind) {
        case 'alert': return `img/alerts/${ALERT_ICONS[visual.alertKey ?? ''] ?? 'infoalert'}.png`;
        case 'cycle':
        case 'day': return 'img/toast/calendar.png';
        case 'death': return 'img/icons/dead.png';
        case 'message':
        case 'mention': return 'img/toast/chat.png';
        default: return 'img/logo.png';
    }
}
