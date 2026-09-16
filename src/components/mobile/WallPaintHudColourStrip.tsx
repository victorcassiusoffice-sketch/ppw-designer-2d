/**
 * WallPaintHudColourStrip — the phone paint HUD's colour row (2026-09-16).
 *
 * Vic, testing the Sofap demo on his phone: every colour choice was made
 * blind — "Change" opened the full-height sheet (3,400 px of rows) over the
 * plan, the colour grid sat a screen and a half down it, and the plan was
 * out of sight until the sheet closed. The 3D overlay already carried a
 * one-row brush strip; this is the same idea on the plan: base white, the
 * first 24 of the brand's shades and a "More" chip that opens the sheet at
 * the colour grid, all in one horizontally scrolling row INSIDE the HUD, so
 * the room stays on screen while the colour changes.
 *
 * 40 px chips — the phone control floor. Renders nothing for a white-only
 * line (Xtreme White, Heat Guard), exactly as the panel does.
 */
import { useDesignerUIStore } from '../../store/designerUIStore';
import { coloursForPaint, findWallPaintById, isPaintTintable, normalisePaintColourHex } from '../../data/wallPaints';
import { brushColour, brushPaintId } from '../../designer/wallPaintBrush';

/** How many shades ride in the row before "More" — the 3D strip's count. */
export const HUD_COLOUR_CHIPS = 24;

const CHIP_BASE = 'h-10 w-10 shrink-0 rounded-md border focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]';
const CHIP_ON = 'border-ppw-inkDeep ring-2 ring-ppw-inkDeep/25';
const CHIP_OFF = 'border-ppw-rim';

export function WallPaintHudColourStrip(): JSX.Element | null {
  const draft = useDesignerUIStore((s) => s.wallPaintDraft);
  const setWallPaintDraft = useDesignerUIStore((s) => s.setWallPaintDraft);
  const paint = findWallPaintById(brushPaintId(draft));
  if (!paint || !isPaintTintable(paint)) return null;
  const tint = brushColour(draft);
  const colours = coloursForPaint(paint).slice(0, HUD_COLOUR_CHIPS);
  const pick = (hex: string | undefined, name: string | undefined) =>
    setWallPaintDraft({ colourHex: hex, colourName: name, erase: false });

  return (
    <div
      className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="radiogroup"
      aria-label="Paint colour"
      data-testid="wallpaint-hud-colours"
    >
      <button
        type="button"
        role="radio"
        aria-checked={!tint}
        onClick={() => pick(undefined, undefined)}
        className={`${CHIP_BASE} ${!tint ? CHIP_ON : CHIP_OFF}`}
        style={{ background: paint.hex }}
        aria-label="Base white"
        title="Base white"
        data-testid="wallpaint-hud-colour-base"
      />
      {colours.map((c) => {
        const hex = normalisePaintColourHex(c.hex) ?? c.hex;
        const on = !!tint && tint.hex === hex;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => pick(hex, c.name)}
            className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}
            style={{ background: hex }}
            aria-label={c.name}
            title={c.name}
            data-testid={`wallpaint-hud-colour-${c.id}`}
          />
        );
      })}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('ppw:open-menu', { detail: { section: 'wallpaint' } }))}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-ppw-rim bg-ppw-chrome px-3 text-[12px] font-medium text-ppw-charcoal focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]"
        title="Every colour, the custom colour and the other lines"
        data-testid="wallpaint-hud-colour-more"
      >
        More
      </button>
    </div>
  );
}
