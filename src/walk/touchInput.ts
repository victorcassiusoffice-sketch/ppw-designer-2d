/**
 * Walk touch input.
 *
 * Round-4 evidence (docs/world/ROUNDS.md, 31 Oct 2026): a quick look or thumb-pad
 * swipe that ends while the finger is still moving makes Chromium start a fling
 * gesture. The Walk overlay has nothing to scroll, so the fling has no consumer,
 * yet the browser's tap-suppression treats every following tap as a fling stop
 * for about a second: the door button received trusted pointerdown/pointerup and
 * no click. Two product rules follow. The look surface and the pad own their
 * contacts (no browser gesture is derived from them), and the door button acts
 * on the completed touch tap the browser already delivered instead of waiting
 * for a click it may withhold. Mouse and keyboard activation are unchanged.
 */

const TAP_SLOP_PX = 12;
const TOUCH_CLICK_WINDOW_MS = 700;

/**
 * Stop the browser deriving scroll or fling gestures from contacts on an element
 * that handles its own pointer events. React attaches root touch listeners as
 * passive, so this uses non-passive listeners directly on the element. Pointer
 * events are unaffected; only the touch defaults (scroll, fling, compatibility
 * mouse events and the synthesized click) are cancelled for these surfaces.
 */
export function ownTouchSequences(element: HTMLElement): () => void {
  const consume = (event: Event) => { if (event.cancelable) event.preventDefault(); };
  element.addEventListener('touchstart', consume, { passive: false });
  element.addEventListener('touchmove', consume, { passive: false });
  return () => {
    element.removeEventListener('touchstart', consume);
    element.removeEventListener('touchmove', consume);
  };
}

export interface TapPointerLike {
  pointerType: string;
  pointerId: number;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
}

export interface TapActivator {
  /** Primary touch contact landing on the control. */
  pointerDown(event: TapPointerLike): void;
  /** The same contact lifting within the tap slop activates once. */
  pointerUp(event: TapPointerLike): void;
  pointerCancel(event: TapPointerLike): void;
  /** Mouse, keyboard and any browser click that did not follow a handled touch tap. */
  click(): void;
}

/**
 * Activate a control on a completed touch tap, and otherwise on click. A click
 * that arrives shortly after a handled touch tap is the browser's own synthesis
 * of that same tap and is ignored, so a tap never activates twice.
 */
export function createTapActivator(activate: () => void, now: () => number = () => performance.now()): TapActivator {
  let contact: { id: number; x: number; y: number } | null = null;
  let touchActivatedAt = -Infinity;
  return {
    pointerDown(event) {
      if (event.pointerType === 'touch' && event.isPrimary) contact = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    pointerUp(event) {
      if (!contact || event.pointerId !== contact.id) return;
      const moved = Math.hypot(event.clientX - contact.x, event.clientY - contact.y);
      contact = null;
      if (moved > TAP_SLOP_PX) return;
      touchActivatedAt = now();
      activate();
    },
    pointerCancel(event) {
      if (contact?.id === event.pointerId) contact = null;
    },
    click() {
      if (now() - touchActivatedAt < TOUCH_CLICK_WINDOW_MS) return;
      activate();
    },
  };
}
