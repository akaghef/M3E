/** In-memory CPU counters only: recording never schedules work or touches the DOM. */
export const RENDER_UPDATE_KEYS = ["render", "projection", "applyZoom", "setCamera", "draw"] as const;
export type RenderUpdateKey = typeof RENDER_UPDATE_KEYS[number];
export interface RenderUpdateMetric { count: number; maxMs: number }
export interface RenderUpdateSnapshot {
  at: number;
  generation: number;
  metrics: Record<RenderUpdateKey, RenderUpdateMetric>;
}
const emptyMetrics = (): RenderUpdateSnapshot["metrics"] => Object.fromEntries(
  RENDER_UPDATE_KEYS.map(key => [key, { count: 0, maxMs: 0 }]),
) as RenderUpdateSnapshot["metrics"];

export class RenderUpdateMetrics {
  private metrics = emptyMetrics();
  private generation = 0;
  record(key: RenderUpdateKey, elapsedMs: number): void {
    const metric = this.metrics[key];
    metric.count++;
    metric.maxMs = Math.max(metric.maxMs, elapsedMs);
  }
  snapshot(): RenderUpdateSnapshot {
    return {
      at: performance.now(), generation: this.generation,
      metrics: Object.fromEntries(RENDER_UPDATE_KEYS.map(key => [key, { ...this.metrics[key] }])) as RenderUpdateSnapshot["metrics"],
    };
  }
  reset(): void { this.metrics = emptyMetrics(); this.generation++; }
}

export function renderUpdateRate(key: RenderUpdateKey, previous: RenderUpdateSnapshot, next: RenderUpdateSnapshot): number {
  const elapsed = next.at - previous.at;
  if (elapsed <= 0 || previous.generation !== next.generation) return 0;
  return Math.max(0, next.metrics[key].count - previous.metrics[key].count) * 1000 / elapsed;
}

export const renderUpdateMetrics = new RenderUpdateMetrics();
