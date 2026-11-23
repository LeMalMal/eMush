import { EmushApi } from '../api/EmushApi';
import { formatDate, pager, safePage } from './format';
import { toNewsCard } from './home';
import { load } from './load';
import { ArticleView, Loaded, NewsListView } from './view';

export const NEWS_PER_PAGE = 8;

export class LoadNews {
    constructor(private readonly api: EmushApi) {}

    execute(page: unknown): Promise<Loaded<NewsListView>> {
        const current = safePage(page);

        return load(async () => {
            const result = await this.api.news(current, NEWS_PER_PAGE);

            return { items: result.items.map(toNewsCard), pager: pager(current, result.total, NEWS_PER_PAGE) };
        });
    }
}

export class LoadArticle {
    constructor(private readonly api: EmushApi) {}

    async execute(id: unknown): Promise<Loaded<ArticleView>> {
        if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
            return { ok: false, message: 'Cette actualité n\'existe pas.' };
        }
        const result = await load(() => this.api.article(id));
        if (!result.ok) {
            return result;
        }
        if (result.view === null) {
            return { ok: false, message: 'Cette actualité n\'existe pas ou n\'est plus publiée.' };
        }
        const article = result.view;

        return { ok: true, view: { id: article.id, title: article.title, date: formatDate(article.publishedAt), content: article.content } };
    }
}
