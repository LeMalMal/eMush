import { EmushApi, JoinResult } from '../api/EmushApi';
import { Language, LANGUAGES } from '../api/models';
import { characterFullName } from './characters';
import { load, PageError } from './load';
import { CrewView, Loaded } from './view';

export function parseLanguage(value: unknown): Language {
    return LANGUAGES.includes(value as Language) ? value as Language : 'fr';
}

/** The boarding ship for a language and its characters, or why the player can't choose one now. */
export class LoadCrew {
    constructor(private readonly api: EmushApi) {}

    execute(language: unknown): Promise<Loaded<CrewView>> {
        const lang = parseLanguage(language);

        return load(async (): Promise<CrewView> => {
            const account = await this.api.me();
            if (account === null) {
                return { status: 'signed-out' };
            }
            if (!account.hasAcceptedRules) {
                return { status: 'rules' };
            }
            if (account.playerId !== null) {
                return { status: 'aboard' };
            }

            const offer = await this.api.crewOffer(lang);
            if (offer === null) {
                throw new PageError('Aucun vaisseau n\'est disponible pour cette langue pour le moment.');
            }

            return {
                status: 'choose',
                language: lang,
                shipId: offer.shipId,
                aboard: offer.characters.filter((character) => !character.available).length,
                characters: offer.characters.map((character) => ({
                    ...character,
                    fullName: characterFullName(character.key, character.name),
                })),
            };
        });
    }
}

export type JoinRequest = { shipId: number; characterKey: string };

export function parseJoinRequest(value: unknown): JoinRequest | null {
    const input = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    const { shipId, characterKey } = input;
    if (typeof shipId !== 'number' || !Number.isInteger(shipId) || shipId <= 0) {
        return null;
    }
    if (typeof characterKey !== 'string' || !/^[a-z_]{2,20}$/.test(characterKey)) {
        return null;
    }

    return { shipId, characterKey };
}

/** Joins the chosen ship. Re-checks the account first: never sends a join for someone already aboard. */
export class JoinCrew {
    constructor(private readonly api: EmushApi) {}

    async execute(value: unknown): Promise<JoinResult> {
        const request = parseJoinRequest(value);
        if (request === null) {
            return { ok: false, message: 'Choix invalide.' };
        }

        const account = await this.api.me().catch(() => null);
        if (account === null) {
            return { ok: false, message: 'Ta session a expiré : reconnecte-toi.' };
        }
        if (account.playerId !== null) {
            return { ok: false, message: 'Tu es déjà à bord d\'un vaisseau.' };
        }

        return this.api.joinShip(account.uuid, request.shipId, request.characterKey);
    }
}
