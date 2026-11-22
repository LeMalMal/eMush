import { EmushApi } from '../api/EmushApi';
import { ChatMessage, Gauge, ShipState } from '../api/models';
import { characterFullName } from './characters';
import { formatDayCycle } from './format';
import { load } from './load';
import { orbitView, OrbitView } from './orbit';
import { Loaded } from './view';

const MESSAGES_SHOWN = 14;

export type MiniPoint = { icon: 'pa' | 'pm' | 'hp' | 'moral'; label: string; value: number; max: number | null };
/** A gauge of the game's banner: oxygen, fuel, hull, plasma shield, crew alive. */
export type MiniShipGauge = { icon: 'oxygen' | 'fuel' | 'hull' | 'shield' | 'shield_off' | 'crew'; label: string; value: string; low: boolean };
export type MiniMessage = { id: number; authorKey: string | null; author: string; text: string; date: string | null; unread: boolean; reply: boolean };

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
        channel: { name: string; unread: number } | null;
        messages: MiniMessage[];
    };

/** Newest first, each thread followed by its replies (newest reply first), capped for a small window. */
export function flattenMessages(messages: ChatMessage[], limit = MESSAGES_SHOWN): MiniMessage[] {
    const rows: MiniMessage[] = [];
    for (const message of messages) {
        rows.push(toRow(message, false));
        for (const reply of [...message.replies].reverse()) {
            rows.push(toRow(reply, true));
        }
        if (rows.length >= limit) {
            break;
        }
    }

    return rows.slice(0, limit);
}

function toRow(message: ChatMessage, reply: boolean): MiniMessage {
    return { id: message.id, authorKey: message.authorKey, author: message.author, text: message.text, date: message.date, unread: message.unread, reply };
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

    execute(): Promise<Loaded<MiniView>> {
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
            const channel = channels.find((candidate) => candidate.scope === 'public') ?? channels[0] ?? null;
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
                channel: channel === null ? null : { name: channel.name || 'Discussion', unread: channel.unread },
                messages: flattenMessages(messages),
            };
        });
    }
}
