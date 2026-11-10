/** The kind of the last pointer press anywhere on the page, so a card shows touch or mouse steps. */
let last: 'touch' | 'mouse' | null = null;

export function notePointerKind(type: string): void {
  last = type === 'touch' || type === 'pen' ? 'touch' : 'mouse';
}

/** Null until the first press: then the caller falls back to `(pointer: coarse)`. */
export function lastPointerWasTouch(): boolean | null {
  return last === null ? null : last === 'touch';
}
