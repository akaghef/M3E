import RBush from 'rbush';

export interface SvgBox { x:number; y:number; width:number; height:number }
export interface SvgPart { element:SVGGElement; order:number }
interface Entry { minX:number; minY:number; maxX:number; maxY:number; key:string }
const parkedRoots=new WeakMap<Element,SVGSVGElement>();
/** Detached fragments keep canonical ownership; they are not browser layout work. */
export function logicalSvgRoot(element:Element):Element { return parkedRoots.get(element)||element; }

export class SvgViewport {
  private tree=new RBush<Entry>();
  private entries=new Map<string,Entry>();
  private pinned=new Set<string>();
  private mounted=new Set<string>();
  private parking:SVGSVGElement;
  private active=false;
  private view:SvgBox|null=null;
  constructor(private root:SVGSVGElement,private parts:Map<string,SvgPart>,private bounds:(key:string)=>SvgBox|null|undefined) {
    this.parking=root.cloneNode(false) as SVGSVGElement;parkedRoots.set(this.parking,root);
    for(const key of parts.keys()) {this.index(key);this.mounted.add(key);}
  }
  private index(key:string):void {
    const old=this.entries.get(key);if(old)this.tree.remove(old);
    this.entries.delete(key);this.pinned.delete(key);
    const box=this.bounds(key);
    // Non-geometric fragments (defs, controls) and unknown geometry stay mounted.
    if(!box||(!box.width&&!box.height)){this.pinned.add(key);return;}
    const entry={key,minX:box.x,minY:box.y,maxX:box.x+box.width,maxY:box.y+box.height};
    this.entries.set(key,entry);this.tree.insert(entry);
  }
  changed(key:string):void { this.index(key); }
  refresh(box?:SvgBox):void {
    if(box)this.view=box;
    if(!this.view)return;
    this.active=true;
    const b=this.view,live=new Set([...this.pinned,...this.tree.search({minX:b.x,minY:b.y,maxX:b.x+b.width,maxY:b.y+b.height}).map(e=>e.key)]);
    for(const key of this.mounted) if(!live.has(key))this.parking.append(this.parts.get(key)!.element);
    const ordered=[...live].sort((a,b)=>this.parts.get(a)!.order-this.parts.get(b)!.order);
    let cursor=this.root.firstElementChild;
    for(const key of ordered){const el=this.parts.get(key)!.element;if(el!==cursor)this.root.insertBefore(el,cursor);cursor=el.nextElementSibling;}
    this.mounted=live;
  }
  /** Full render/capture/export is an explicit materialization boundary. */
  materialize():void {
    if(!this.active)return;
    const batch=this.root.ownerDocument.createDocumentFragment();
    for(const part of [...this.parts.values()].sort((a,b)=>a.order-b.order)) batch.append(part.element);
    this.root.append(batch);
    this.active=false;this.mounted=new Set(this.parts.keys());
  }
}

/** CSS-pixel overscan stays constant as the camera zoom changes. */
export function viewportBox(x:number,y:number,zoom:number,width:number,height:number,margin=256):SvgBox {
  return {x:(-x-margin)/zoom,y:(-y-margin)/zoom,width:(width+2*margin)/zoom,height:(height+2*margin)/zoom};
}
