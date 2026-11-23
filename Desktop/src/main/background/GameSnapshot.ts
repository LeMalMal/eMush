import { ApiUnavailableError, EmushApi } from '../api/EmushApi';
import { ChatMessage, ShipAlert } from '../api/models';
import { characterFullName } from '../pages/characters';
import { NewMessages } from './events';
import { UnreadMessage } from './messageNotification';

/** What the background watch knows about the player's game at one moment. */
export type GameSnapshot =
    | { state: 'signed-out' }
    | { state: 'no-character' }
    | { state: 'unreachable' }
    | {
        state: 'alive';
        character: string;
        /** The character's name in the game ("Jin-Su"), as players write it in the chat. */
        name: string;
        day: number | null;
        cycle: number | null;
        nextCycleAt: Date | null;
        unread: number;
        /** Unread messages of each chat channel, to tell where new messages arrive. */
        channels: UnreadChannel[];
        alerts: ShipAlert[];
    }
    | { state: 'dead'; character: string };

export type AliveSnapshot = Extract<GameSnapshot, { state: 'alive' }>;

/** The newest unread message, and the channel it was written in. */
export type UnreadChannel = { id: number; scope: string; unread: number };

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
                name: player.characterName,
                day: player.day,
                cycle: player.cycle,
                nextCycleAt: player.nextCycleAt,
                unread: channels.reduce((sum, channel) => sum + channel.unread, 0),
                channels: channels.map(({ id, scope, unread }) => ({ id, scope, unread })),
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

/** Unread messages kept per channel: enough to find a mention among the newest ones. */
const UNREAD_PER_CHANNEL = 20;

/** The unread messages (and replies) of the channels that got new ones, newest first, to word the notification. */
export class ReadNewMessages {
    constructor(private readonly api: EmushApi) {}

    async execute(channels: NewMessages[]): Promise<UnreadMessage[]> {
        const perChannel = await Promise.all(channels.map(async ({ id, scope }) => {
            const messages = await this.api.channelMessages(id).catch(() => []);
            return unreadNewestFirst(messages).slice(0, UNREAD_PER_CHANNEL).map(({ author, authorKey, text }) => ({ channelId: id, scope, author, authorKey, text }));
        }));

        return perChannel.flat();
    }
}

/** Messages come newest first; a thread's replies can be newer than its first message. */
export function unreadNewestFirst(messages: ChatMessage[]): ChatMessage[] {
    return messages.flatMap((message) => [
        ...[...message.replies].reverse().filter((reply) => reply.unread),
        ...(message.unread ? [message] : []),
    ]);
}
