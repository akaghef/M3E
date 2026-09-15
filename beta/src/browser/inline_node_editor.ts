import { renderNode, lineHeightForFont, multilineTextStartY } from "../shared/node_draw_svg";
import type { NodeDrawInput } from "../shared/node_draw_port";

/** Editing semantics are shared by SVG and WebGL; a renderer must not change them. */
export function nodeLabelEditAction(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "isComposing">): "none" | "finish" | "next" | "child" | "sibling" {
  if (event.isComposing) return "none";
  if (event.key === "Escape") return "finish";
  if (event.key === "Tab") return "child";
  if (event.key !== "Enter" || event.shiftKey) return "none";
  if ((event.ctrlKey || event.metaKey) && !event.altKey) return "next";
  return "sibling";
}

/** Never constrain the draft to the old label's height (including IME/newlines). */
export function autoSizeInlineEditor(input: HTMLTextAreaElement): void {
  input.style.height = "auto";
  input.style.height = `${Math.max(44, input.scrollHeight)}px`;
}

export function measureInlineDraft(text: string, fontSize: number, measure: (line: string) => number) {
  const lines = text.replaceAll("\r", "").split("\n");
  const lineHeight = lineHeightForFont(fontSize);
  return { lines, lineHeight, width: lines.reduce((width,line) => Math.max(width,Math.ceil(measure(line))+20),100),
    height: Math.max(34, lines.length*lineHeight) };
}

/** Owns one draft only. No map, layout engine, persistence or renderer reference. */
export class InlineNodeEditorPreview {
  readonly element = document.createElement("div");
  private shape = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  private measure = document.createElement("canvas").getContext("2d")!;
  private left = 0;
  private top = 0;
  private fontSize: number;
  private baselineOffset: number;
  private initialDraft: ReturnType<typeof measureInlineDraft>;
  private camera = { x:0, y:0, zoom:1 };

  constructor(private input: HTMLTextAreaElement, private source: NodeDrawInput, labelCss: CSSStyleDeclaration) {
    this.element.className = "inline-node-preview";
    this.element.dataset.nodeId = source.node.id;
    this.element.style.cssText = "position:absolute;z-index:20;contain:layout style;pointer-events:none;transform-origin:top left;";
    this.shape.style.cssText = "position:absolute;overflow:visible;pointer-events:none;";
    this.shape.setAttribute("aria-hidden", "true");
    this.input.style.pointerEvents = "auto";
    this.input.style.minWidth = "0";
    this.input.style.padding = "0";
    this.input.style.fontFamily = labelCss.fontFamily;
    this.input.style.fontSize = labelCss.fontSize;
    this.input.style.fontWeight = labelCss.fontWeight;
    this.input.style.fontStyle = labelCss.fontStyle;
    this.input.style.letterSpacing = labelCss.letterSpacing;
    this.input.style.color = labelCss.fill;
    this.input.style.textDecoration = labelCss.textDecorationLine;
    this.input.wrap = "off";
    this.fontSize = parseFloat(labelCss.fontSize) || source.position.fontSize || 44;
    this.measure.font = `${labelCss.fontStyle} ${labelCss.fontWeight} ${this.fontSize}px ${labelCss.fontFamily}`;
    this.measure.letterSpacing = labelCss.letterSpacing;
    const metrics = this.measure.measureText("Mg");
    const ascent = metrics.fontBoundingBoxAscent ?? this.fontSize*0.8;
    const descent = metrics.fontBoundingBoxDescent ?? this.fontSize*0.2;
    this.baselineOffset = ascent + (lineHeightForFont(this.fontSize)-ascent-descent)/2;
    this.initialDraft = measureInlineDraft(input.value,this.fontSize,(line) => this.measure.measureText(line).width);
    this.element.append(this.shape,input);
  }

  refresh(): void {
    const draft = measureInlineDraft(this.input.value,this.fontSize,(line) => this.measure.measureText(line).width);
    const centered = Boolean(this.source.node.isRoot && !this.source.surface.rootless);
    const scatter = this.source.surface.view === "Disperse";
    // A Disperse circle denotes a node, not its text width. Its label editor
    // grows independently; structured node boxes follow the draft dimensions.
    const width = scatter ? this.source.position.w : Math.max(100,this.source.position.w+draft.width-this.initialDraft.width);
    const height = scatter ? this.source.position.h : Math.max(34,this.source.position.h+draft.height-this.initialDraft.height);
    this.left = this.source.position.x + (centered ? (this.source.position.w-width)/2 : 0);
    this.top = this.source.position.y-height/2;
    const local: NodeDrawInput = { ...this.source,
      position:{...this.source.position,x:0,y:height/2,w:width,h:height,fontSize:this.fontSize},
      content:{kind:"plainLabel",labelLines:draft.lines,fontSize:this.fontSize,textAnchor:centered?"middle":"start"},
    };
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.shape.setAttribute("width",String(width));
    this.shape.setAttribute("height",String(height));
    this.shape.setAttribute("viewBox",`0 0 ${width} ${height}`);
    // This is a one-node render, never the map SVG or retained scene.
    this.shape.innerHTML = renderNode(local).svg;
    this.shape.querySelectorAll(".label-root,.label-node").forEach((label) => label.setAttribute("visibility","hidden"));
    // Decorations and collapse controls remain in the retained scene; don't
    // duplicate them in the draft box or change their interactions mid-edit.
    this.shape.querySelectorAll(".alias-badge,.confidence-badge,.confidence-badge-text,.lock-icon,[data-collapse-node-id]").forEach((badge) => badge.remove());
    const labelX = centered ? (width-draft.width)/2 : scatter ? width+7 : this.source.node.isScopePortal ? 12 : 0;
    const baseline = scatter ? height/2+this.fontSize*0.35
      : multilineTextStartY(height/2,draft.lines.length,this.fontSize,draft.lineHeight);
    this.input.style.left = `${labelX}px`;
    this.input.style.top = `${baseline-this.baselineOffset}px`;
    this.input.style.width = `${draft.width}px`;
    this.input.style.lineHeight = `${draft.lineHeight}px`;
    this.input.style.textAlign = centered ? "center" : "left";
    this.input.style.height = `${draft.lines.length*draft.lineHeight}px`;
    this.setCamera(this.camera);
  }

  setCamera(camera: {x:number;y:number;zoom:number}): void {
    this.camera = camera;
    this.element.style.left = `${camera.x+this.left*camera.zoom}px`;
    this.element.style.top = `${camera.y+this.top*camera.zoom}px`;
    this.element.style.transform = `scale(${camera.zoom})`;
  }
  destroy(): void { this.element.remove(); }
}
