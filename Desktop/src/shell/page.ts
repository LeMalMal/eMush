import type { Loaded } from '../main/pages/view';
import { h } from './dom';
import { errorState, loadingState } from './ui';

export type PageContext = {
    /** The area under the navigation bar, cleared before each page. */
    root: HTMLElement;
    /** Starts a load; the returned check turns false as soon as another page or load replaces it. */
    track(): () => boolean;
    setUser(username: string | null): void;
    /** Renders the current page again (retry after an error, refresh). */
    rerender(): void;
};

/**
 * Standard page lifecycle: spinner, load, then either the page or an error with a retry button.
 * Results arriving after the player has moved on are dropped.
 */
export async function showLoaded<T>(
    context: PageContext,
    loader: () => Promise<Loaded<T>>,
    render: (view: T) => Node,
    loadingLabel?: string,
): Promise<void> {
    const stillWanted = context.track();
    context.root.replaceChildren(loadingState(loadingLabel));

    const result = await loader();
    if (!stillWanted()) {
        return;
    }
    context.root.replaceChildren(result.ok
        ? render(result.view)
        : h('div', { class: 'container' }, errorState(result.message, () => context.rerender())));
    context.root.scrollTop = 0;
}
