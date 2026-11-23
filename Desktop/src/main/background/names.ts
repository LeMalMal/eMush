/**
 * How the client recognises the character's name in the chat, for notifications ("X parle de toi")
 * and for the marks in the game's chat. These functions are self-contained (they only call each
 * other): the chat marking script embeds their source to run the very same rules in the game page.
 */

/** Lower case, no accents, words separated by single spaces. */
export function comparableName(text: string): string {
    return String(text ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Whether a text names the character ("Jin-Su", "jin su", "@Gioele"...): a whole word, whatever the case, accents or punctuation. */
export function mentionsName(text: string, characterName: string): boolean {
    const name = comparableName(characterName);

    return name !== '' && ` ${comparableName(text)} `.includes(` ${name} `);
}

/** A chat message is the character's own, names the character, or neither. */
export function classifyChatMessage(author: string, text: string, characterName: string): 'own' | 'mention' | null {
    if (comparableName(characterName) === '') {
        return null;
    }
    if (comparableName(author) === comparableName(characterName)) {
        return 'own';
    }

    return mentionsName(text, characterName) ? 'mention' : null;
}
