export type EdgePoint = {
  x: number;
  y: number;
};

export type EdgeRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function rectFromDomRect(rect: DOMRect, origin: DOMRect): EdgeRect {
  return {
    x: rect.left - origin.left,
    y: rect.top - origin.top,
    w: rect.width,
    h: rect.height,
  };
}

export function edgeEndBetweenRects(
  fromRect: EdgeRect,
  toRect: EdgeRect,
  pad = 0,
): EdgePoint {
  const fromCx = fromRect.x + fromRect.w / 2;
  const fromCy = fromRect.y + fromRect.h / 2;
  const toCx = toRect.x + toRect.w / 2;
  const toCy = toRect.y + toRect.h / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { x: fromRect.x + fromRect.w + pad, y: fromCy }
      : { x: fromRect.x - pad, y: fromCy };
  }
  return dy >= 0
    ? { x: fromCx, y: fromRect.y + fromRect.h + pad }
    : { x: fromCx, y: fromRect.y - pad };
}

export function smoothGraphLinkPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  waveOffset = 0,
): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx < 0.5 && absDy < 0.5) {
    return `M ${sx} ${sy}`;
  }
  if (absDx >= absDy) {
    const dirX = dx >= 0 ? 1 : -1;
    const handle = Math.max(44, Math.min(260, absDx * 0.46 + absDy * 0.16));
    return `M ${sx} ${sy} C ${sx + dirX * handle} ${sy + waveOffset}, ${tx - dirX * handle} ${ty - waveOffset}, ${tx} ${ty}`;
  }
  const dirY = dy >= 0 ? 1 : -1;
  const handle = Math.max(44, Math.min(220, absDy * 0.46 + absDx * 0.16));
  return `M ${sx} ${sy} C ${sx + waveOffset} ${sy + dirY * handle}, ${tx - waveOffset} ${ty - dirY * handle}, ${tx} ${ty}`;
}

export function edgePathBetweenRects(fromRect: EdgeRect, toRect: EdgeRect, pad = 0): string {
  const source = edgeEndBetweenRects(fromRect, toRect, pad);
  const target = edgeEndBetweenRects(toRect, fromRect, pad);
  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
}
