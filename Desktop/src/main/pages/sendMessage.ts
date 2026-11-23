import { EmushApi, JoinResult } from '../api/EmushApi';

/** The game's own limit (MessageInput.vue), where a line break counts twice. */
export const MESSAGE_MAX_LENGTH = 4096;

/** A message written in the mini panel: in a channel, or as a reply to a thread (`parentId`, its first message). */
export type SendMessageRequest = { channelId: number; text: string; parentId: number | null };

/** Reads a message request from the mini panel (untrusted); null when it is not one. */
export function parseSendMessageRequest(value: unknown): SendMessageRequest | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const { channelId, text, parentId } = value as Record<string, unknown>;
    const isId = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
    if (!isId(channelId) || typeof text !== 'string' || (parentId !== null && !isId(parentId))) {
        return null;
    }

    return { channelId, text, parentId };
}

/** Length as the game counts it: a line break counts twice (it becomes "//"). */
export function gameMessageLength(text: string): number {
    return text.length + text.split('\n').length - 1;
}

/** The text the game stores: trimmed, line breaks written "//" as the web client does. */
export function toGameMessage(text: string): string {
    return text.trim().replace(/\r?\n/g, '//');
}

/**
 * Sends a message from the mini panel with the same request as the web client, after checking
 * again with the server that it can: signed in with a character, a channel of the player, a thread
 * still there.
 */
export class SendChatMessage {
    constructor(private readonly api: EmushApi) {}

    async execute(value: unknown): Promise<JoinResult> {
        const request = parseSendMessageRequest(value);
        if (request === null) {
            return { ok: false, message: 'Demande invalide : recharge le panneau.' };
        }
        const text = request.text.trim();
        if (text === '') {
            return { ok: false, message: 'Écris d’abord ton message.' };
        }
        if (gameMessageLength(text) > MESSAGE_MAX_LENGTH) {
            return { ok: false, message: `Le message ne doit pas dépasser ${MESSAGE_MAX_LENGTH} caractères.` };
        }
        try {
            const account = await this.api.me();
            if (account === null || account.playerId === null) {
                return { ok: false, message: 'Tu n’as plus de personnage en jeu.' };
            }
            const channels = await this.api.channels();
            if (!channels.some((channel) => channel.id === request.channelId)) {
                return { ok: false, message: 'Ce canal n’est plus disponible.' };
            }
            if (request.parentId !== null) {
                const thread = await this.api.channelMessages(request.channelId);
                if (!thread.some((message) => message.id === request.parentId)) {
                    return { ok: false, message: 'Le message auquel tu réponds n’est plus affiché : réponds depuis le jeu.' };
                }
            }

            return await this.api.sendMessage(request.channelId, account.playerId, toGameMessage(text), request.parentId);
        } catch (error) {
            return { ok: false, message: `Serveur injoignable : ${error instanceof Error ? error.message : String(error)}` };
        }
    }
}
