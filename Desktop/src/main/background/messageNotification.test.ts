import { describe, expect, it } from 'vitest';
import { NewMessages } from './events';
import { messageNotification, UnreadMessage } from './messageNotification';
import { classifyChatMessage, mentionsName as mentions } from './names';
import { DEFAULT_SETTINGS } from './settingsModel';

const PUBLIC: NewMessages = { id: 89607, scope: 'public', added: 2 };
const PRIVATE: NewMessages = { id: 7, scope: 'private', added: 1 };
const MUSH: NewMessages = { id: 66, scope: 'mush', added: 1 };

function newMessages(...channels: NewMessages[]) {
    return { kind: 'new-messages' as const, added: channels.reduce((sum, channel) => sum + channel.added, 0), total: 40, channels };
}

function message(channel: NewMessages, author: string, text: string): UnreadMessage {
    return { channelId: channel.id, scope: channel.scope, author, text };
}

describe('mentions', () => {
    it('finds the character\'s name as a word, whatever the case, accents or punctuation', () => {
        expect(mentions('Gioele, tu peux réparer la porte ?', 'Gioele')).toBe(true);
        expect(mentions('@gioele on compte sur toi', 'Gioele')).toBe(true);
        expect(mentions('Jin Su est au pont', 'Jin-Su')).toBe(true);
        expect(mentions('ÉLEESHA !', 'Eleesha')).toBe(true);
    });

    it('ignores the name inside another word', () => {
        expect(mentions('Les Gioelettes', 'Gioele')).toBe(false);
        expect(mentions('Personne', '')).toBe(false);
    });
});

describe('classifyChatMessage', () => {
    it('tells the character\'s own messages from the ones naming the character', () => {
        expect(classifyChatMessage('Gioele :', 'Je répare la porte', 'Gioele')).toBe('own');
        expect(classifyChatMessage('Roland', 'Gioele, rejoins-moi', 'Gioele')).toBe('mention');
        expect(classifyChatMessage('Roland', 'On explore ?', 'Gioele')).toBeNull();
        expect(classifyChatMessage('Roland', 'On explore ?', '')).toBeNull();
    });
});

describe('messageNotification', () => {
    it('tells who talks about the character first, even in a muted channel', () => {
        const settings = { ...DEFAULT_SETTINGS, messagesPrivate: false };
        const event = newMessages(PUBLIC, PRIVATE);
        const messages = [message(PUBLIC, 'Hua', 'On explore ?'), message(PRIVATE, 'Roland', 'Gioele, rejoins-moi en baie')];

        expect(messageNotification(event, messages, settings, 'Gioele')).toEqual({
            title: 'Roland parle de toi',
            body: 'Gioele, rejoins-moi en baie',
            chat: { channelId: 7, author: 'Roland', text: 'Gioele, rejoins-moi en baie' },
        });
    });

    it('never counts the character\'s own messages as mentions', () => {
        const notification = messageNotification(newMessages(PUBLIC), [message(PUBLIC, 'Gioele', 'Gioele au rapport')], DEFAULT_SETTINGS, 'Gioele');

        expect(notification?.title).toBe('2 nouveaux messages');
    });

    it('only notifies the channels the player follows, with their newest message', () => {
        const settings = { ...DEFAULT_SETTINGS, messagesPublic: false };
        const messages = [message(PUBLIC, 'Hua', 'On explore ?'), message(MUSH, 'Chun', 'On infecte qui ?')];

        expect(messageNotification(newMessages(PUBLIC, MUSH), messages, settings, 'Gioele')).toEqual({
            title: 'Message de Chun',
            body: 'On infecte qui ?',
            chat: { channelId: 66, author: 'Chun', text: 'On infecte qui ?' },
        });
        expect(messageNotification(newMessages(PUBLIC), messages, settings, 'Gioele')).toBeNull();
    });

    it('stays quiet when chat notifications are off, unless someone talks about the character', () => {
        const settings = { ...DEFAULT_SETTINGS, messages: false };

        expect(messageNotification(newMessages(PUBLIC), [message(PUBLIC, 'Hua', 'On explore ?')], settings, 'Gioele')).toBeNull();
        expect(messageNotification(newMessages(PUBLIC), [message(PUBLIC, 'Hua', 'Gioele ?')], settings, 'Gioele')?.title).toBe('Hua parle de toi');
        expect(messageNotification(newMessages(PUBLIC), [message(PUBLIC, 'Hua', 'Gioele ?')], { ...settings, mentions: false }, 'Gioele')).toBeNull();
    });

    it('still notifies with a count when the messages could not be read', () => {
        expect(messageNotification(newMessages(PUBLIC), [], DEFAULT_SETTINGS, 'Gioele')).toEqual({ title: '2 nouveaux messages', body: 'Tu as 40 messages non lus.' });
    });
});
