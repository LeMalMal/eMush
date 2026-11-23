import { EmushApi, JoinResult } from '../api/EmushApi';
import { parseInlines } from '../api/gameText';
import { DeathReport } from '../api/models';
import { isPositiveInteger } from '../api/json';
import { characterFullName } from './characters';
import { isGoodEnd } from './endCauses';
import { formatNumber } from './format';
import { load } from './load';
import { DeathChoice, DeathView, Loaded } from './view';

/** The server's limit for an epitaph (PlayerEndRequest). */
export const EPITAPH_MAX_LENGTH = 512;

export function buildDeathView(report: DeathReport): DeathChoice {
    return {
        status: 'dead',
        playerId: report.playerId,
        character: { key: report.characterKey, name: characterFullName(report.characterKey, report.characterName) },
        isMush: report.isMush,
        triumph: formatNumber(report.triumph),
        endCause: { title: report.endCause.name, description: report.endCause.description, good: isGoodEnd(report.endCause.key) },
        highlights: report.highlights.map(parseInlines),
        triumphGains: report.triumphGains.map(parseInlines),
        crew: report.crew.map((mate) => ({
            playerId: mate.playerId,
            characterKey: mate.characterKey,
            name: characterFullName(mate.characterKey, mate.characterName),
            death: mate.deathDay && mate.deathCycle ? `${mate.deathDay}.${mate.deathCycle}` : '—',
            cause: mate.endCause?.shortName ?? '—',
            likes: mate.likes,
        })),
        maxLength: EPITAPH_MAX_LENGTH,
    };
}

export class LoadDeath {
    constructor(private readonly api: EmushApi) {}

    execute(): Promise<Loaded<DeathView>> {
        return load(async (): Promise<DeathView> => {
            const account = await this.api.me();
            if (account === null) {
                return { status: 'signed-out' };
            }
            if (account.playerId === null) {
                return { status: 'no-character' };
            }
            const report = await this.api.deathReport(account.playerId);

            return report === null ? { status: 'alive' } : buildDeathView(report);
        });
    }
}

export type EndAdventureRequest = { playerId: number; message: string; likedPlayers: number[] };

export function parseEndAdventureRequest(value: unknown): EndAdventureRequest | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const { playerId, message, likedPlayers } = value as Record<string, unknown>;
    if (!isPositiveInteger(playerId) || typeof message !== 'string' || message.length > EPITAPH_MAX_LENGTH || !Array.isArray(likedPlayers)) {
        return null;
    }
    if (likedPlayers.length > 16 || !likedPlayers.every(isPositiveInteger)) {
        return null;
    }

    return { playerId, message: message.trim(), likedPlayers: [...new Set(likedPlayers)] };
}

/**
 * Sends the epitaph and closes the adventure. Checked against the server first: the character must be
 * the signed-in player's, dead, and the likes must go to crewmates of that ship.
 */
export class EndAdventure {
    constructor(private readonly api: EmushApi) {}

    async execute(value: unknown): Promise<JoinResult> {
        const request = parseEndAdventureRequest(value);
        if (request === null) {
            const tooLong = typeof value === 'object' && value !== null && typeof (value as { message?: unknown }).message === 'string'
                && ((value as { message: string }).message.length > EPITAPH_MAX_LENGTH);

            return { ok: false, message: tooLong ? `L'épitaphe ne doit pas dépasser ${EPITAPH_MAX_LENGTH} caractères.` : 'Demande invalide : recharge la page.' };
        }
        try {
            const account = await this.api.me();
            if (account === null || account.playerId !== request.playerId) {
                return { ok: false, message: 'Ce personnage n\'est plus le tien : recharge la page.' };
            }
            const report = await this.api.deathReport(request.playerId);
            if (report === null) {
                return { ok: false, message: 'Ton personnage est encore en vie : rien à clore pour l\'instant.' };
            }
            const crew = new Set(report.crew.map((mate) => mate.playerId));
            if (!request.likedPlayers.every((id) => crew.has(id))) {
                return { ok: false, message: 'Un des équipiers choisis n\'était pas à bord : recharge la page.' };
            }
        } catch {
            return { ok: false, message: 'Impossible de joindre le serveur eMush. Vérifie ta connexion, puis réessaie.' };
        }

        return this.api.endAdventure(request.playerId, request.message, request.likedPlayers);
    }
}
