// Placement of a floating layer (tooltip, hover popover) next to its anchor (#129, #123).
// Pure, so unit tests can reach it without a DOM.

export type FloatingSide = "top" | "bottom";

export type FloatingRect = { top: number; left: number; width: number; height: number };

export type FloatingSize = { width: number; height: number };

export type FloatingViewport = { width: number; height: number };

export type FloatingPosition = { top: number; left: number; side: FloatingSide };

/** Distance between the anchor and the floating layer, and the floating layer and the viewport edge. */
export const FLOATING_GAP_PX = 6;
export const FLOATING_VIEWPORT_MARGIN_PX = 8;

/**
 * Where to put a floating layer of `size` for an anchor at `anchor` (both in viewport
 * coordinates). It is centred horizontally on the anchor and placed on `preferredSide`, or on
 * the other side when it does not fit there but fits there; it never leaves the viewport
 * horizontally, and when it fits on neither side it keeps the side with more room.
 */
export function computeFloatingPosition({
  anchor,
  size,
  viewport,
  preferredSide = "top",
  gap = FLOATING_GAP_PX,
  margin = FLOATING_VIEWPORT_MARGIN_PX
}: {
  anchor: FloatingRect;
  size: FloatingSize;
  viewport: FloatingViewport;
  preferredSide?: FloatingSide;
  gap?: number;
  margin?: number;
}): FloatingPosition {
  const roomAbove = anchor.top - gap - margin;
  const roomBelow = viewport.height - (anchor.top + anchor.height) - gap - margin;
  const fitsAbove = size.height <= roomAbove;
  const fitsBelow = size.height <= roomBelow;

  let side: FloatingSide = preferredSide;
  if (preferredSide === "top" && !fitsAbove) {
    side = fitsBelow || roomBelow > roomAbove ? "bottom" : "top";
  } else if (preferredSide === "bottom" && !fitsBelow) {
    side = fitsAbove || roomAbove > roomBelow ? "top" : "bottom";
  }

  const top = side === "top" ? anchor.top - gap - size.height : anchor.top + anchor.height + gap;

  const centredLeft = anchor.left + anchor.width / 2 - size.width / 2;
  const maxLeft = viewport.width - margin - size.width;
  const left = Math.max(margin, Math.min(centredLeft, maxLeft));

  return { top: Math.round(top), left: Math.round(left), side };
}
