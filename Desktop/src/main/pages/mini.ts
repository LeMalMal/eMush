import { EmushApi } from '../api/EmushApi';
import { ChannelSummary, ChatMessage, Gauge, ShipState } from '../api/models';
import type { ChatTarget } from '../background/events';
import { classifyChatMessage } from '../background/names';
import { characterFullName } from './characters';
import { formatDayCycle } from './format';
import { load } from './load';
import { orbitView, OrbitView } from './orbit';
import { Loaded } from './view';

const MESSAGES_SHOWN = 14;

export type MiniPoint = { icon: 'pa' | 'pm' | 'hp' | 'moral'; label: string; value: number; max: number | null };
/** A gauge of the game's banner: oxygen, fuel, hull, plasma shield, crew alive. */
export type MiniShipGauge = { icon: 'oxygen' | 'fuel' | 'hull' | 'shield' | 'shield_off' | 'crew'; label: string; value: string; low: boolean };
/**
 * `threadId`: the thread's first message, which a reply answers (the game replies to threads, not to replies).
 * `mark`: the character's own message, or one naming the character (same rules as the game's chat marks).
 */
export type MiniMessage = {
    id: number; threadId: number; authorKey: string | null; author: string; text: string; date: string | null; unread: boolean; reply: boolean;
    mark: 'own' | 'mention' | null;
};
/** A chat channel the panel can show: public, private or Mush. */
export type MiniChannel = { id: number; scope: string; name: string; unread: number };

/** Channels the panel shows, in the game's order of importance. */
const CHAT_SCOPES = ['public', 'private', 'mush'];

/** What the small panel next to the clock shows. */
export type MiniView =
    | { status: 'signed-out' | 'no-character' | 'dead'; title: string; text: string }
    | {
        status: 'alive';
        character: { key: string; name: string };
        room: string | null;
        when: string | null;
        /** ISO date of the next cycle; the panel counts down every second on its own. */
        nextCycleAt: string | null;
        points: MiniPoint[];
        ship: MiniShipGauge[];
        /** Orbiting a planet or moving (nothing in open space). */
        orbit: OrbitView | null;
        /** Titles (Commandant...) and diseases, as small tags. */
        titles: string[];
        diseases: string[];
        alerts: { name: string; description: string }[];
        /** The channel shown (the public one unless the player picked another). */
        channel: MiniChannel | null;
        channels: MiniChannel[];
        messages: MiniMessage[];
    };

/** Newest first, each thread followed by its replies (newest reply first), capped for a small window. */
export function flattenMessages(messages: ChatMessage[], characterName = '', limit = MESSAGES_SHOWN): MiniMessage[] {
    const rows: MiniMessage[] = [];
    for (const message of messages) {
        rows.push(toRow(message, false, message.id, characterName));
        for (const reply of [...message.replies].reverse()) {
            rows.push(toRow(reply, true, message.id, characterName));
        }
        if (rows.length >= limit) {
            break;
        }
    }

    return rows.slice(0, limit);
}

function toRow(message: ChatMessage, reply: boolean, threadId: number, characterName: string): MiniMessage {
    return {
        id: message.id, threadId, authorKey: message.authorKey, author: message.author, text: message.text, date: message.date, unread: message.unread, reply,
        mark: classifyChatMessage(message.author, message.text, characterName),
    };
}

/** The chat channels as tabs: "Public", "Privé" (numbered when there are several), "Mush". */
export function chatChannels(channels: ChannelSummary[]): MiniChannel[] {
    const shown = channels
        .filter((channel) => CHAT_SCOPES.includes(channel.scope))
        .sort((a, b) => CHAT_SCOPES.indexOf(a.scope) - CHAT_SCOPES.indexOf(b.scope));
    const privates = shown.filter((channel) => channel.scope === 'private');

    return shown.map(({ id, scope, unread }) => ({
        id,
        scope,
        unread,
        name: scope === 'public' ? 'Public' : scope === 'mush' ? 'Mush' : privates.length > 1 ? `Privé ${privates.findIndex((channel) => channel.id === id) + 1}` : 'Privé',
    }));
}

/** Reads a channel id asked by the panel (untrusted); null to show the public channel. */
export function parseChannelChoice(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Reads a message the panel asks to show in the game (untrusted). */
export function parseChatTarget(value: unknown): ChatTarget | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const { channelId, author, text } = value as Record<string, unknown>;
    if (parseChannelChoice(channelId) === null || typeof author !== 'string' || author.length > 100 || typeof text !== 'string' || text.length > 5000) {
        return null;
    }

    return { channelId: channelId as number, author, text };
}

function point(icon: MiniPoint['icon'], label: string, gauge: Gauge | null): MiniPoint[] {
    return gauge === null ? [] : [{ icon, label, value: gauge.value, max: gauge.max }];
}

/** Below these levels the game's banner is worth a look (the panel highlights the gauge). */
const LOW_OXYGEN = 8;
const LOW_FUEL = 5;
const LOW_HULL = 30;

/** The ship gauges of the game's banner, in the same order. */
export function shipGauges(ship: ShipState): MiniShipGauge[] {
    const gauges: MiniShipGauge[] = [];
    if (ship.oxygen !== null) {
        gauges.push({ icon: 'oxygen', label: 'Oxygène', value: String(ship.oxygen), low: ship.oxygen <= LOW_OXYGEN });
    }
    if (ship.fuel !== null) {
        gauges.push({ icon: 'fuel', label: 'Fuel', value: String(ship.fuel), low: ship.fuel <= LOW_FUEL });
    }
    if (ship.hull !== null) {
        gauges.push({ icon: 'hull', label: 'Coque', value: String(ship.hull), low: ship.hull <= LOW_HULL });
    }
    if (ship.shield !== null) {
        gauges.push({ icon: ship.shield > 0 ? 'shield' : 'shield_off', label: 'Bouclier', value: String(ship.shield), low: false });
    }
    if (ship.crewAlive !== null) {
        gauges.push({ icon: 'crew', label: 'En vie', value: String(ship.crewAlive), low: false });
    }

    return gauges;
}

export class LoadMiniPanel {
    constructor(private readonly api: EmushApi) {}

    /** `channelChoice`: the channel picked in the panel's tabs (untrusted), the public one otherwise. */
    execute(channelChoice: unknown = null): Promise<Loaded<MiniView>> {
        return load(async (): Promise<MiniView> => {
            const account = await this.api.me();
            if (account === null) {
                return { status: 'signed-out', title: 'Non connecté', text: 'Ouvre eMush pour te connecter.' };
            }
            if (account.playerId === null) {
                return { status: 'no-character', title: 'Aucun équipage', text: 'Ouvre eMush pour choisir ton personnage et embarquer.' };
            }
            const player = await this.api.player(account.playerId);
            if (player === null) {
                return { status: 'no-character', title: 'Partie introuvable', text: 'Ouvre eMush pour voir où tu en es.' };
            }
            const name = characterFullName(player.characterKey, player.characterName);
            if (player.status !== 'in_game') {
                return { status: 'dead', title: `${name} est tombé`, text: 'Ouvre eMush pour écrire ton épitaphe.' };
            }

            const [channels, alerts] = await Promise.all([
                this.api.channels(),
                player.shipId === null ? Promise.resolve([]) : this.api.alerts(player.shipId).catch(() => []),
            ]);
            const tabs = chatChannels(channels);
            const chosen = parseChannelChoice(channelChoice);
            const channel = tabs.find((candidate) => candidate.id === chosen) ?? tabs.find((candidate) => candidate.scope === 'public') ?? tabs[0] ?? null;
            const messages = channel === null ? [] : await this.api.channelMessages(channel.id).catch(() => []);
            const { actionPoints, movementPoints, healthPoints, moralPoints } = player.points;

            return {
                status: 'alive',
                character: { key: player.characterKey, name },
                room: player.room,
                when: formatDayCycle(player.day, player.cycle),
                nextCycleAt: player.nextCycleAt?.toISOString() ?? null,
                points: [
                    ...point('pa', 'PA', actionPoints),
                    ...point('pm', 'PM', movementPoints),
                    ...point('hp', 'PV', healthPoints),
                    ...point('moral', 'Moral', moralPoints),
                ],
                ship: shipGauges(player.ship),
                orbit: orbitView(player.ship.position),
                titles: player.titles,
                diseases: player.diseases,
                alerts: alerts.map(({ name: alertName, description }) => ({ name: alertName, description })),
                channel,
                channels: tabs,
                messages: flattenMessages(messages, player.characterName),
            };
        });
    }
}
