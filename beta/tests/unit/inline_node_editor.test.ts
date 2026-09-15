import { afterEach, describe, expect, it, vi } from "vitest";
import { autoSizeInlineEditor, InlineNodeEditorPreview, measureInlineDraft, nodeLabelEditAction } from "../../src/browser/inline_node_editor";
import type { NodeDrawInput } from "../../src/shared/node_draw_port";

afterEach(() => vi.unstubAllGlobals());

const key = (value: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key:value, ctrlKey:false, metaKey:false, shiftKey:false, altKey:false, isComposing:false, ...modifiers,
});

describe("node label editing contract (SVG and WebGL)", () => {
  it("Escape finishes with the draft retained, rather than cancelling it", () => {
    expect(nodeLabelEditAction(key("Escape"))).toBe("finish");
  });
  it("preserves Enter/Tab creation and Shift+Enter newline semantics", () => {
    expect(nodeLabelEditAction(key("Enter"))).toBe("sibling");
    expect(nodeLabelEditAction(key("Tab"))).toBe("child");
    expect(nodeLabelEditAction(key("Enter",{shiftKey:true}))).toBe("none");
  });
  it("keeps the draft when moving to the next editor via Control/Command+Enter", () => {
    expect(nodeLabelEditAction(key("Enter",{ctrlKey:true}))).toBe("next");
    expect(nodeLabelEditAction(key("Enter",{metaKey:true}))).toBe("next");
  });
  it("does not finish or create nodes while IME is composing", () => {
    for (const value of ["Enter","Escape","Tab"]) {
      expect(nodeLabelEditAction(key(value,{isComposing:true}))).toBe("none");
    }
  });
  it("grows for wrapped/multiline drafts and shrinks after removing text", () => {
    const input = {style:{height:"53px"},scrollHeight:159} as HTMLTextAreaElement;
    autoSizeInlineEditor(input);
    expect(input.style.height).toBe("159px");
    Object.defineProperty(input,"scrollHeight",{value:53,configurable:true});
    autoSizeInlineEditor(input);
    expect(input.style.height).toBe("53px");
  });
  it("measures just the current draft, with the renderer's line spacing", () => {
    expect(measureInlineDraft("日本語\n長い行です",44,(line)=>line.length*44)).toMatchObject({width:240,height:110,lineHeight:55});
    expect(measureInlineDraft("",44,()=>0)).toMatchObject({width:100,height:55});
  });
  it("changes only the draft box, retaining source geometry and typography", () => {
    const makeElement = () => ({style:{},dataset:{},append:vi.fn(),setAttribute:vi.fn(),querySelectorAll:()=>[],remove:vi.fn(),innerHTML:""});
    const context = {measureText:(text:string)=>({width:text.length*10,fontBoundingBoxAscent:16,fontBoundingBoxDescent:4})};
    vi.stubGlobal("document",{createElement:(tag:string)=>tag==="canvas"?{getContext:()=>context}:makeElement(),createElementNS:makeElement});
    const source: NodeDrawInput = {
      node:{id:"one",type:"text",kind:"plain",label:"original",alias:"none",isFolder:false,isRoot:false,isLatex:false,isScopePortal:false},
      position:{x:100,y:200,w:120,h:34,depth:1},style:{},surface:{view:"Tree",structuredMode:"Tree"},
      view:{selected:true,primarySelected:true,multiSelected:true,linkSource:false,cutPending:false,reparentSource:false,dragSource:false,dropTarget:false,lockedBy:"none"},
      content:{kind:"plainLabel",labelLines:["original"],fontSize:20},
    };
    const before = JSON.stringify(source);
    const input = {...makeElement(),value:"original"} as unknown as HTMLTextAreaElement;
    const css = {fontFamily:"Yu Gothic UI",fontSize:"20px",fontWeight:"600",fontStyle:"italic",letterSpacing:"0px",fill:"#123456",textDecorationLine:"underline"} as CSSStyleDeclaration;
    const preview = new InlineNodeEditorPreview(input,source,css);
    preview.refresh();
    expect(preview.element.style.width).toBe("120px");
    input.value = "a much longer draft label\nsecond line";
    preview.refresh();
    expect(parseFloat(preview.element.style.width)).toBeGreaterThan(120);
    expect(parseFloat(preview.element.style.height)).toBeGreaterThan(34);
    expect(input.style).toMatchObject({fontFamily:"Yu Gothic UI",fontSize:"20px",fontWeight:"600",fontStyle:"italic",lineHeight:"25px"});
    input.value = "original";
    preview.refresh();
    expect(preview.element.style.width).toBe("120px");
    expect(JSON.stringify(source)).toBe(before);
  });
});
