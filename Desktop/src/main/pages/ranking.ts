import { EmushApi } from '../api/EmushApi';
import { Language, LANGUAGES, RANKING_SORTS, RankingSort } from '../api/models';
import { formatNumber, pager, safePage } from './format';
import { load } from './load';
import { Loaded, RankingView } from './view';

export const RANKING_PER_PAGE = 15;

export type RankingRequest = { language: Language | null; sort: RankingSort; page: number };

/** Validates what the shell asks for; anything unexpected falls back to the defaults. */
export function parseRankingRequest(value: unknown): RankingRequest {
    const input = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

    return {
        language: LANGUAGES.includes(input.language as Language) ? input.language as Language : null,
        sort: RANKING_SORTS.includes(input.sort as RankingSort) ? input.sort as RankingSort : 'cycles_survived',
        page: safePage(input.page),
    };
}

export class LoadRanking {
    constructor(private readonly api: EmushApi) {}

    execute(value: unknown): Promise<Loaded<RankingView>> {
        const request = parseRankingRequest(value);

        return load(async () => {
            const result = await this.api.ranking({ ...request, perPage: RANKING_PER_PAGE });
            const firstRank = (request.page - 1) * RANKING_PER_PAGE + 1;

            return {
                rows: result.items.map((ship, index) => ({
                    rank: firstRank + index,
                    shipId: ship.shipId,
                    endCause: ship.endCause,
                    days: formatNumber(ship.daysSurvived),
                    cycles: formatNumber(ship.cyclesSurvived),
                    humanTriumph: formatNumber(ship.humanTriumph),
                    bestHumanTriumph: formatNumber(ship.bestHumanTriumph),
                    mushTriumph: formatNumber(ship.mushTriumph),
                })),
                pager: pager(request.page, result.total, RANKING_PER_PAGE),
                language: request.language,
                sort: request.sort,
            };
        });
    }
}
