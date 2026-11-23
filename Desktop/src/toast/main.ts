import type { ToastView } from '../main/tray/toastView';
import { h } from '../shell/dom';

// The Mush-styled notifications next to the clock. The main process decides what is shown; this page
// draws it, times each notification out (paused while the mouse is over them) and reports its height.

type ToastBridge = {
    onShow(listener: (payload: { toasts: ToastView[]; chime: string | null }) => void): void;
    click(id: number): void;
    dismiss(id: number): void;
    height(pixels: number): void;
};

const bridge = (window as unknown as { emushToasts: ToastBridge }).emushToasts;
const stack = document.getElementById('toasts') as HTMLElement;

/** How long each kind stays: what needs the player stays longer. */
const LIFETIME_MS: Record<ToastView['kind'], number> = {
    cycle: 8_000, day: 8_000, message: 10_000, info: 8_000, alert: 15_000, mention: 15_000, death: 20_000,
};

type Shown = { element: HTMLElement; bar: HTMLElement; remaining: number; startedAt: number; timer: number | undefined };
const shown = new Map<number, Shown>();
let hovering = false;

function toastElement(toast: ToastView): Shown {
    const bar = h('span', { class: 'toast-timer' });
    const image = h('img', { class: 'toast-image', src: toast.image, alt: '' });
    image.addEventListener('error', () => { image.src = 'img/logo.png'; }, { once: true });
    const element = h('article', { class: `toast toast-${toast.kind} frame`, role: 'status', tabindex: 0, onclick: () => bridge.click(toast.id) },
        image,
        h('div', { class: 'toast-text' },
            h('span', { class: 'toast-label' }, toast.label),
            h('b', { class: 'toast-title' }, toast.title),
            h('p', { class: 'toast-body' }, toast.body),
            h('span', { class: 'toast-action' }, `${toast.action} ›`)),
        h('button', {
            class: 'toast-close',
            type: 'button',
            title: 'Fermer',
            'aria-label': 'Fermer la notification',
            onclick: (event: Event) => {
                event.stopPropagation();
                bridge.dismiss(toast.id);
            },
        }, '×'),
        bar);

    return { element, bar, remaining: LIFETIME_MS[toast.kind], startedAt: 0, timer: undefined };
}

/** Starts (or resumes) the countdown of a notification; its bar shrinks with it. */
function start(id: number, entry: Shown): void {
    entry.startedAt = Date.now();
    entry.timer = window.setTimeout(() => bridge.dismiss(id), entry.remaining);
    void entry.bar.getBoundingClientRect(); // Applies the current width first, so the bar shrinks from it.
    entry.bar.style.transition = `transform ${entry.remaining}ms linear`;
    entry.bar.style.transform = 'scaleX(0)';
}

function pause(entry: Shown): void {
    if (entry.timer === undefined) {
        return; // Not started yet (it appeared under the mouse).
    }
    window.clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.remaining = Math.max(1_000, entry.remaining - (Date.now() - entry.startedAt));
    const left = getComputedStyle(entry.bar).transform;
    entry.bar.style.transition = 'none';
    entry.bar.style.transform = left === 'none' ? 'scaleX(1)' : left;
}

function render(toasts: ToastView[]): void {
    const ids = new Set(toasts.map((toast) => toast.id));
    for (const [id, entry] of shown) {
        if (!ids.has(id)) {
            window.clearTimeout(entry.timer);
            shown.delete(id);
        }
    }
    const elements = toasts.map((toast) => {
        let entry = shown.get(toast.id);
        if (entry === undefined) {
            entry = toastElement(toast);
            shown.set(toast.id, entry);
            if (!hovering) {
                start(toast.id, entry);
            }
        }
        return entry.element;
    });
    stack.replaceChildren(...elements); // Newest at the bottom, next to the clock.
    // Measured right away: the window is often hidden here, and a hidden page gets no animation frame.
    bridge.height(document.body.scrollHeight);
}

stack.addEventListener('mouseenter', () => {
    hovering = true;
    shown.forEach(pause);
});
stack.addEventListener('mouseleave', () => {
    hovering = false;
    shown.forEach((entry, id) => start(id, entry));
});

bridge.onShow(({ toasts, chime }) => {
    render(toasts);
    if (chime) {
        new Audio(chime).play().catch(() => undefined); // A missing sound file only means silence.
    }
});
