import { ApiUnavailableError, EmushApi } from '../api/EmushApi';
import { ChatMessage, ShipAlert } from '../api/models';
import { characterFullName } from '../pages/characters';

/** What the background watch knows about the player's game at one moment. */
export type GameSnapshot =
    | { state: 'signed-out' }
    | { state: 'no-character' }
    | { state: 'unreachable' }
    | {
        state: 'alive';
        character: string;
        day: number | null;
        cycle: number | null;
        nextCycleAt: Date | null;
        unread: number;
        /** Channels holding unread messages, to find who wrote. */
        unreadChannels: number[];
        alerts: ShipAlert[];
    }
    | { state: 'dead'; character: string };

export type AliveSnapshot = Extract<GameSnapshot, { state: 'alive' }>;

export type MessagePreview = { author: string; text: string };

/** Reads the player's situation from the game API (account, player, chat channels, ship alerts). */
export class TakeGameSnapshot {
    constructor(private readonly api: EmushApi) {}

    async execute(): Promise<GameSnapshot> {
        try {
            const account = await this.api.me();
            if (account === null) {
                return { state: 'signed-out' };
            }
            if (account.playerId === null) {
                return { state: 'no-character' };
            }
            const player = await this.api.player(account.playerId);
            if (player === null) {
                return { state: 'unreachable' };
            }
            const character = characterFullName(player.characterKey, player.characterName);
            if (player.status !== 'in_game') {
                return { state: 'dead', character };
            }
            const [channels, alerts] = await Promise.all([
                this.api.channels(),
                player.shipId === null ? Promise.resolve([]) : this.api.alerts(player.shipId).catch(() => []),
            ]);

            return {
                state: 'alive',
                character,
                day: player.day,
                cycle: player.cycle,
                nextCycleAt: player.nextCycleAt,
                unread: channels.reduce((sum, channel) => sum + channel.unread, 0),
                unreadChannels: channels.filter((channel) => channel.unread > 0).map((channel) => channel.id),
                alerts,
            };
        } catch (error) {
            if (error instanceof ApiUnavailableError) {
                return { state: 'unreachable' };
            }
            throw error;
        }
    }
}

/** Newest unread message (or reply) among the given channels, to show who wrote in a notification. */
export class PreviewLatestMessage {
    constructor(private readonly api: EmushApi) {}

    async execute(channelIds: number[]): Promise<MessagePreview | null> {
        for (const channelId of channelIds) {
            const messages = await this.api.channelMessages(channelId).catch(() => []);
            const unread = firstUnread(messages);
            if (unread !== null) {
                return { author: unread.author, text: unread.text };
            }
        }

        return null;
    }
}

/** Messages come newest first; a thread's replies can be newer than its first message. */
export function firstUnread(messages: ChatMessage[]): ChatMessage | null {
    for (const message of messages) {
        const reply = [...message.replies].reverse().find((candidate) => candidate.unread);
        if (reply) {
            return reply;
        }
        if (message.unread) {
            return message;
        }
    }

    return null;
}
