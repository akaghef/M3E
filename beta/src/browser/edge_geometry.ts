export type EdgePoint = {
  x: number;
  y: number;
};

export type EdgePortSide = "left" | "right" | "top" | "bottom";

export type EdgePortPoint = EdgePoint & {
  side: EdgePortSide;
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

function rectCenter(rect: EdgeRect): EdgePoint {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function edgePortForSide(rect: EdgeRect, side: EdgePortSide, pad = 0): EdgePortPoint {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (side === "left") return { x: rect.x - pad, y: cy, side };
  if (side === "right") return { x: rect.x + rect.w + pad, y: cy, side };
  if (side === "top") return { x: cx, y: rect.y - pad, side };
  return { x: cx, y: rect.y + rect.h + pad, side };
}

function edgePortNormal(side: EdgePortSide): EdgePoint {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function edgePorts(rect: EdgeRect, pad = 0): EdgePortPoint[] {
  return [
    edgePortForSide(rect, "left", pad),
    edgePortForSide(rect, "right", pad),
    edgePortForSide(rect, "top", pad),
    edgePortForSide(rect, "bottom", pad),
  ];
}

function outwardPenalty(port: EdgePortPoint, vector: EdgePoint): number {
  const normal = edgePortNormal(port.side);
  const dot = normal.x * vector.x + normal.y * vector.y;
  if (dot >= 0) return 0;
  return Math.min(2400, Math.abs(dot) * 8);
}

function sideBiasPenalty(source: EdgePortPoint, target: EdgePortPoint, dx: number, dy: number): number {
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (horizontal) {
    let penalty = 0;
    if (source.side === "top" || source.side === "bottom") penalty += 260;
    if (target.side === "top" || target.side === "bottom") penalty += 260;
    return penalty;
  }
  let penalty = 0;
  if (source.side === "left" || source.side === "right") penalty += 260;
  if (target.side === "left" || target.side === "right") penalty += 260;
  return penalty;
}

export function edgePortPairBetweenRects(
  fromRect: EdgeRect,
  toRect: EdgeRect,
  pad = 0,
): { source: EdgePortPoint; target: EdgePortPoint } {
  const fromCenter = rectCenter(fromRect);
  const toCenter = rectCenter(toRect);
  const centerDx = toCenter.x - fromCenter.x;
  const centerDy = toCenter.y - fromCenter.y;
  let best: { source: EdgePortPoint; target: EdgePortPoint; score: number } | null = null;
  for (const source of edgePorts(fromRect, pad)) {
    for (const target of edgePorts(toRect, pad)) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const score = dx * dx
        + dy * dy
        + outwardPenalty(source, { x: centerDx, y: centerDy })
        + outwardPenalty(target, { x: -centerDx, y: -centerDy })
        + sideBiasPenalty(source, target, centerDx, centerDy);
      if (!best || score < best.score) {
        best = { source, target, score };
      }
    }
  }
  return best || {
    source: edgePortForSide(fromRect, "right", pad),
    target: edgePortForSide(toRect, "left", pad),
  };
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
