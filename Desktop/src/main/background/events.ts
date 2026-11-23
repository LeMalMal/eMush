import { ShipAlert } from '../api/models';
import { AliveSnapshot, GameSnapshot } from './GameSnapshot';
import { AppSettings } from './settingsModel';

export type WatchEvent =
    | { kind: 'new-day'; day: number; cycle: number | null }
    | { kind: 'new-cycle'; day: number | null; cycle: number }
    | { kind: 'new-messages'; added: number; total: number; channels: NewMessages[] }
    | { kind: 'new-alert'; alert: ShipAlert }
    | { kind: 'death'; character: string };

/** Messages that arrived in one channel since the previous check. */
export type NewMessages = { id: number; scope: string; added: number };

/** A chat message to show in the game: its channel, author and plain text. */
export type ChatTarget = { channelId: number; author: string; text: string };

/** The newest message, shown in a notification (`authorKey`: the author's character, for their head). */
export type MessagePreview = ChatTarget & { authorKey?: string | null };

/** What a notification is about, and what to draw next to it: the author's head or the alert's icon. */
export type NotificationVisual = {
    kind: 'cycle' | 'day' | 'alert' | 'message' | 'mention' | 'death' | 'info';
    characterKey?: string | null;
    alertKey?: string;
};

/** `chat`: the message a message notification shows when clicked. */
export type NotificationText = { title: string; body: string; chat?: ChatTarget; visual?: NotificationVisual };

const BODY_LENGTH = 140;

/**
 * Compares two successive snapshots of the same game. The first snapshot is only a baseline:
 * no event is raised for what already happened before the client started watching.
 */
export function detectEvents(previous: GameSnapshot | null, next: GameSnapshot): WatchEvent[] {
    if (previous === null || previous.state !== 'alive') {
        return [];
    }
    if (next.state === 'dead') {
        return [{ kind: 'death', character: next.character }];
    }
    if (next.state !== 'alive') {
        return [];
    }

    const events: WatchEvent[] = [];
    if (next.day !== null && previous.day !== null && next.day > previous.day) {
        events.push({ kind: 'new-day', day: next.day, cycle: next.cycle });
    } else if (next.cycle !== null && next.cycle !== previous.cycle) {
        events.push({ kind: 'new-cycle', day: next.day, cycle: next.cycle });
    }
    const knownAlerts = new Set(previous.alerts.map((alert) => alert.key));
    for (const alert of next.alerts) {
        if (!knownAlerts.has(alert.key)) {
            events.push({ kind: 'new-alert', alert });
        }
    }
    const channels = newMessagesPerChannel(previous, next);
    if (channels.length > 0) {
        events.push({ kind: 'new-messages', added: channels.reduce((sum, channel) => sum + channel.added, 0), total: next.unread, channels });
    }

    return events;
}

export function shouldNotify(event: WatchEvent, settings: AppSettings): boolean {
    switch (event.kind) {
        case 'new-day': return settings.newDays || settings.newCycles;
        case 'new-cycle': return settings.newCycles;
        case 'new-messages': return settings.messages || settings.mentions;
        case 'new-alert': return settings.alerts;
        case 'death': return true;
    }
}

export function notificationText(event: WatchEvent, preview: MessagePreview | null = null): NotificationText {
    switch (event.kind) {
        case 'new-day':
            return {
                title: `Jour ${event.day} à bord du Daedalus`,
                body: `Un nouveau jour commence${event.cycle !== null ? ` (cycle ${event.cycle})` : ''} : tes points d'action sont rechargés.`,
                visual: { kind: 'day' },
            };
        case 'new-cycle':
            return {
                title: 'Nouveau cycle',
                body: `${event.day !== null ? `Jour ${event.day} · ` : ''}Cycle ${event.cycle} : tes points d'action sont rechargés.`,
                visual: { kind: 'cycle' },
            };
        case 'new-alert':
            return {
                title: `Alerte : ${event.alert.name}`,
                body: shorten(event.alert.description || 'Une nouvelle alerte touche le Daedalus.'),
                visual: { kind: 'alert', alertKey: event.alert.key },
            };
        case 'new-messages':
            if (preview !== null) {
                return {
                    title: event.added === 1 ? `Message de ${preview.author}` : `${event.added} nouveaux messages`,
                    body: shorten(event.added === 1 ? preview.text : `${preview.author} : ${preview.text}`),
                    chat: { channelId: preview.channelId, author: preview.author, text: preview.text },
                    visual: { kind: 'message', characterKey: preview.authorKey ?? null },
                };
            }
            return {
                title: event.added === 1 ? 'Nouveau message' : `${event.added} nouveaux messages`,
                body: event.total === 1 ? 'Tu as 1 message non lu.' : `Tu as ${event.total} messages non lus.`,
                visual: { kind: 'message' },
            };
        case 'death':
            return { title: `${event.character} est tombé`, body: 'Laisse ton épitaphe pour clore l\'aventure.', visual: { kind: 'death' } };
    }
}

/** One line for the tray tooltip and menu. */
export function statusLine(snapshot: GameSnapshot): string {
    switch (snapshot.state) {
        case 'signed-out': return 'Non connecté';
        case 'no-character': return 'Aucun équipage';
        case 'unreachable': return 'Serveur injoignable';
        case 'dead': return `${snapshot.character} est tombé`;
        case 'alive': {
            const when = snapshot.day !== null && snapshot.cycle !== null ? `Jour ${snapshot.day} · Cycle ${snapshot.cycle}` : 'En partie';
            const unread = snapshot.unread === 0 ? '' : snapshot.unread === 1 ? ' · 1 message non lu' : ` · ${snapshot.unread} messages non lus`;
            const alerts = snapshot.alerts.length === 0 ? '' : snapshot.alerts.length === 1 ? ' · 1 alerte' : ` · ${snapshot.alerts.length} alertes`;
            return `${when}${unread}${alerts}`;
        }
    }
}

/** Channels whose unread count went up (reading a channel while another one gets messages still counts). */
function newMessagesPerChannel(previous: AliveSnapshot, next: AliveSnapshot): NewMessages[] {
    const before = new Map(previous.channels.map((channel) => [channel.id, channel.unread]));

    return next.channels
        .map((channel) => ({ id: channel.id, scope: channel.scope, added: channel.unread - (before.get(channel.id) ?? 0) }))
        .filter((channel) => channel.added > 0);
}

export function shorten(text: string): string {
    return text.length <= BODY_LENGTH ? text : `${text.slice(0, BODY_LENGTH - 1).trimEnd()}…`;
}
