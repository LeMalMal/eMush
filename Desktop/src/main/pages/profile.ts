import { EmushApi } from '../api/EmushApi';
import { UUID } from '../api/parsers';
import { characterFullName } from './characters';
import { formatDate, formatDayCycle, formatNumber, pager, safePage } from './format';
import { load, PageError } from './load';
import { Loaded, ProfileView } from './view';

export const HISTORY_PER_PAGE = 10;
const STATISTICS_SHOWN = 12;
const ACHIEVEMENTS_SHOWN = 12;

export type ProfileRequest = { userId: string | null; page: number };

export function parseProfileRequest(value: unknown): ProfileRequest {
    const input = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    const userId = typeof input.userId === 'string' && UUID.test(input.userId) ? input.userId : null;

    return { userId, page: safePage(input.page) };
}

/** A player's profile: own profile when no user id is given. */
export class LoadProfile {
    constructor(private readonly api: EmushApi) {}

    execute(value: unknown): Promise<Loaded<ProfileView>> {
        const request = parseProfileRequest(value);

        return load(async () => {
            const me = await this.api.me();
            const account = request.userId === null || request.userId === me?.uuid ? me : await this.api.user(request.userId);
            if (account === null) {
                throw new PageError(request.userId === null ? 'Connecte-toi pour voir ton profil.' : 'Ce joueur n\'existe pas.');
            }

            const [history, statistics, achievements] = await Promise.all([
                this.api.shipHistory(account.uuid, request.page, HISTORY_PER_PAGE),
                this.api.statistics(account.uuid),
                this.api.achievements(account.uuid),
            ]);

            const view: ProfileView = {
                isMe: account.uuid === me?.uuid,
                username: account.username,
                memberSince: formatDate(account.createdAt),
                points: achievements.reduce((sum, achievement) => sum + achievement.points, 0),
                shipsPlayed: history.total,
                statistics: [...statistics]
                    .sort((a, b) => Number(b.isRare) - Number(a.isRare))
                    .slice(0, STATISTICS_SHOWN)
                    .map(({ name, description, count, isRare }) => ({ name, description, count, isRare })),
                achievements: [...achievements]
                    .sort((a, b) => b.points - a.points)
                    .slice(0, ACHIEVEMENTS_SHOWN)
                    .map(({ name, description, points, isRare }) => ({ name, description, points, isRare })),
                history: history.items.map((entry) => ({
                    shipId: entry.shipId,
                    characterKey: entry.characterKey,
                    characterName: characterFullName(entry.characterKey),
                    endCause: entry.endCause,
                    death: formatDayCycle(entry.dayDeath, entry.cycleDeath) ?? '—',
                    triumph: formatNumber(entry.triumph),
                    wasMush: entry.wasMush,
                })),
                pager: pager(request.page, history.total, HISTORY_PER_PAGE),
            };

            return view;
        });
    }
}
