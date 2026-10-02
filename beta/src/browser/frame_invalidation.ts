/** Coalesce state changes; a frame reads the latest state exactly once. */
export class FrameInvalidation {
  private frame: number | null = null;
  constructor(
    private readonly draw: () => void,
    private readonly request = (fn: FrameRequestCallback) => requestAnimationFrame(fn),
    private readonly cancel = (id: number) => cancelAnimationFrame(id),
  ) {}
  invalidate(): void {
    if (this.frame !== null) return;
    this.frame = this.request(() => {
      this.frame = null;
      this.draw();
    });
  }
  flush(): void {
    this.clear();
    this.draw();
  }
  clear(): void {
    if (this.frame !== null) this.cancel(this.frame);
    this.frame = null;
  }
}
