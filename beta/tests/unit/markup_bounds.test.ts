import { describe, expect, it } from "vitest";
import { markupBounds, pathMidpoint } from "../../src/browser/markup_bounds";

const measure = (text: string, fontSize: number): number => text.length * fontSize * 0.5;

describe("markupBounds", () => {
  it("unions rects, circles and lines", () => {
    const box = markupBounds('<rect class="a" x="10" y="20" width="30" height="40" rx="4" /><circle cx="100" cy="0" r="5"/><line x1="-3" y1="1" x2="2" y2="70"/>', measure);
    expect(box).toEqual({ x: -3, y: -5, width: 108, height: 75 });
  });

  it("bounds a cubic path inside its control polygon and through its end points", () => {
    const box = markupBounds('<path class="edge" d="M 0 0 C 50 0, 50 100, 100 100" />', measure)!;
    expect(box.x).toBeCloseTo(0); expect(box.y).toBeCloseTo(0);
    expect(box.width).toBeCloseTo(100); expect(box.height).toBeCloseTo(100);
  });

  it("places text lines by anchor, tspan x and dy", () => {
    const box = markupBounds('<text class="label-node" x="100" y="50" text-anchor="start" style="font-size:10px"><tspan x="100">abcd</tspan><tspan x="100" dy="12">ab&amp;cdef</tspan></text>', measure)!;
    expect(box.x).toBe(100);
    expect(box.width).toBe(35);
    expect(box.y).toBeCloseTo(41);
    expect(box.y + box.height).toBeCloseTo(64.5);
    const middle = markupBounds('<text x="100" y="50" text-anchor="middle" style="font-size:10px">abcd</text>', measure)!;
    expect(middle.x).toBe(90);
  });

  it("skips the HTML inside a foreignObject", () => {
    expect(markupBounds('<foreignObject x="1" y="2" width="3" height="4"><div xmlns="http://www.w3.org/1999/xhtml"><span>x</span></div></foreignObject>', measure))
      .toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });

  it("answers null for anything it cannot tell from the text", () => {
    expect(markupBounds('<g><rect x="0" y="0" width="1" height="1"/></g>', measure)).toBeNull();
    expect(markupBounds('<rect transform="translate(5,5)" x="0" y="0" width="1" height="1"/>', measure)).toBeNull();
    expect(markupBounds('<path d="M 0 0 a 5 5 0 0 1 10 10"/>', measure)).toBeNull();
    expect(markupBounds('<text x="0" y="0">no font size</text>', measure)).toBeNull();
    expect(markupBounds("", measure)).toBeNull();
  });
});

describe("pathMidpoint", () => {
  it("is half way along a polyline by length", () => {
    expect(pathMidpoint("M 0 0 L 10 0 L 10 30")).toEqual({ x: 10, y: 10 });
  });
  it("is the centre of a symmetric cubic", () => {
    const mid = pathMidpoint("M 0 0 C 50 0, 50 100, 100 100")!;
    expect(mid.x).toBeCloseTo(50, 0); expect(mid.y).toBeCloseTo(50, 0);
  });
  it("answers null for a path it cannot read", () => {
    expect(pathMidpoint("M 0 0 a 5 5 0 0 1 10 10")).toBeNull();
  });
});
