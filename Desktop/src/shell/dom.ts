// Tiny DOM builder. Text always goes through text nodes: server data can never become markup.

type Child = Node | string | number | null | undefined | false;
type AttributeValue = string | number | boolean | null | undefined | ((event: Event) => void);

export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes: Record<string, AttributeValue> = {},
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);

    for (const [name, value] of Object.entries(attributes)) {
        if (value === undefined || value === null || value === false) {
            continue;
        }
        if (typeof value === 'function') {
            element.addEventListener(name.replace(/^on/, '').toLowerCase(), value);
        } else if (name === 'class') {
            element.className = String(value);
        } else {
            element.setAttribute(name, value === true ? '' : String(value));
        }
    }
    append(element, children);

    return element;
}

export function append(parent: Node, children: Child[]): void {
    for (const child of children) {
        if (child === null || child === undefined || child === false) {
            continue;
        }
        parent.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
    }
}
