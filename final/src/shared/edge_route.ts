import type { EdgePortPoint, EdgePorts, EdgePortSide } from "./edge_port";

export type EdgeRouteStyle = "orthogonal" | "line" | "curve" | "force-link";

export type EdgePathCommand =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number };

export interface EdgePath {
  d: string;
  commands: EdgePathCommand[];
  source: EdgePortPoint;
  target: EdgePortPoint;
  style: EdgeRouteStyle;
}

function normal(side: EdgePortSide): { x: number; y: number } {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function distance(a: EdgePortPoint, b: EdgePortPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function commandEnd(command: EdgePathCommand): { x: number; y: number } {
  return { x: command.x, y: command.y };
}

function commandsToD(commands: EdgePathCommand[]): string {
  return commands.map((command) => {
    if (command.op === "M" || command.op === "L") return `${command.op} ${command.x} ${command.y}`;
    return `C ${command.x1} ${command.y1}, ${command.x2} ${command.y2}, ${command.x} ${command.y}`;
  }).join(" ");
}

function orthogonalCommands(source: EdgePortPoint, target: EdgePortPoint): EdgePathCommand[] {
  const commands: EdgePathCommand[] = [{ op: "M", x: source.x, y: source.y }];
  if (source.side === "left" || source.side === "right") {
    const midX = source.x + (target.x - source.x) / 2;
    commands.push({ op: "L", x: midX, y: source.y });
    commands.push({ op: "L", x: midX, y: target.y });
  } else {
    const midY = source.y + (target.y - source.y) / 2;
    commands.push({ op: "L", x: source.x, y: midY });
    commands.push({ op: "L", x: target.x, y: midY });
  }
  commands.push({ op: "L", x: target.x, y: target.y });
  return commands;
}

function curveCommands(source: EdgePortPoint, target: EdgePortPoint, force = false): EdgePathCommand[] {
  const sourceNormal = normal(source.side);
  const targetNormal = normal(target.side);
  const span = force
    ? Math.max(32, Math.min(140, distance(source, target) * 0.28))
    : Math.max(40, Math.min(180, distance(source, target) * 0.45));
  return [
    { op: "M", x: source.x, y: source.y },
    {
      op: "C",
      x1: source.x + sourceNormal.x * span,
      y1: source.y + sourceNormal.y * span,
      x2: target.x + targetNormal.x * span,
      y2: target.y + targetNormal.y * span,
      x: target.x,
      y: target.y,
    },
  ];
}

export function route(ports: EdgePorts, style: EdgeRouteStyle): EdgePath {
  const { source, target } = ports;
  let commands: EdgePathCommand[];
  if (style === "line") {
    commands = [{ op: "M", x: source.x, y: source.y }, { op: "L", x: target.x, y: target.y }];
  } else if (style === "orthogonal") {
    commands = orthogonalCommands(source, target);
  } else if (style === "force-link") {
    commands = curveCommands(source, target, true);
  } else {
    commands = curveCommands(source, target);
  }
  const last = commands[commands.length - 1];
  if (!last || commandEnd(last).x !== target.x || commandEnd(last).y !== target.y) {
    throw new Error("EdgeRoute invariant failed: path target endpoint changed.");
  }
  return { d: commandsToD(commands), commands, source, target, style };
}

