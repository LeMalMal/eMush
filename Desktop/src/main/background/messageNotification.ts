import { NewMessages, notificationText, NotificationText, shorten, WatchEvent } from './events';
import { comparableName, mentionsName } from './names';
import { AppSettings } from './settingsModel';

/** An unread chat message, read when new messages arrive (newest first). `text` is plain text. */
export type UnreadMessage = { channelId: number; scope: string; author: string; text: string };

type NewMessagesEvent = Extract<WatchEvent, { kind: 'new-messages' }>;
type MessageSettings = Pick<AppSettings, 'messages' | 'messagesPublic' | 'messagesPrivate' | 'messagesMush' | 'mentions'>;

/** Whether the player wants notifications for new messages of this kind of channel. */
export function isChannelNotified(scope: string, settings: MessageSettings): boolean {
    switch (scope) {
        case 'private': return settings.messagesPrivate;
        case 'mush': return settings.messagesMush;
        default: return settings.messagesPublic; // The public channel, and any channel the game adds.
    }
}

/**
 * The notification for new chat messages, or null. A message naming the character comes first ("X
 * parle de toi"), even from a channel the player muted; otherwise, the newest message of the channels
 * the player follows. The character's own messages never count as mentions.
 */
export function messageNotification(event: NewMessagesEvent, messages: UnreadMessage[], settings: MessageSettings, characterName: string): NotificationText | null {
    const mention = settings.mentions
        ? messages.find((message) => comparableName(message.author) !== comparableName(characterName) && mentionsName(message.text, characterName))
        : undefined;
    if (mention !== undefined) {
        return {
            title: `${mention.author} parle de toi`,
            body: shorten(mention.text),
            chat: { channelId: mention.channelId, author: mention.author, text: mention.text },
        };
    }
    if (!settings.messages) {
        return null;
    }

    const followed = event.channels.filter((channel) => isChannelNotified(channel.scope, settings));
    if (followed.length === 0) {
        return null;
    }
    const followedIds = new Set(followed.map((channel) => channel.id));
    const newest = messages.find((message) => followedIds.has(message.channelId)) ?? null;

    return notificationText({ ...event, added: addedIn(followed), channels: followed }, newest);
}

function addedIn(channels: NewMessages[]): number {
    return channels.reduce((sum, channel) => sum + channel.added, 0);
}
