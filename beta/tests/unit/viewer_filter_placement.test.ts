// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {observeFilterPlacement} from '../../src/browser/viewer-filter-placement';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
it('map edits neither rescan panel descendants nor force layout; panel resizing is batched',async()=>{
  document.body.innerHTML='<div id="shell"><div class="wb-brand"></div><div class="wb-top-actions"></div><div id="bar"></div><div id="board"><svg></svg></div></div>';
  const shell=document.querySelector<HTMLElement>('#shell')!,bar=document.querySelector<HTMLElement>('#bar')!,board=document.querySelector('#board')!;
  const pending=new Map<number,FrameRequestCallback>();let serial=0,resize:()=>void=()=>{};
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{pending.set(++serial,cb);return serial;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>pending.delete(id));
  const observe=vi.fn(),unobserve=vi.fn();
  vi.stubGlobal('ResizeObserver',class{constructor(cb:()=>void){resize=cb;}observe=observe;unobserve=unobserve;disconnect=vi.fn();});
  const geometry=vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(()=>new DOMRect(0,0,500,50));
  const scan=vi.spyOn(shell,'querySelectorAll');
  const dispose=observeFilterPlacement(bar)!;
  const flush=()=>{const jobs=[...pending.values()];pending.clear();jobs.forEach(cb=>cb(0));};
  expect(geometry).not.toHaveBeenCalled();flush();geometry.mockClear();scan.mockClear();
  for(let i=0;i<20;i++){board.querySelector('svg')!.innerHTML=`<g><circle cx="${i}"/></g>`;await Promise.resolve();}
  expect(geometry).not.toHaveBeenCalled();expect(scan).not.toHaveBeenCalled();expect(pending.size).toBe(0);
  const panel=document.createElement('aside');panel.className='wb-right-panel';shell.append(panel);await Promise.resolve();
  expect(observe).toHaveBeenCalledWith(panel);expect(geometry).not.toHaveBeenCalled();
  resize();resize();expect(pending.size).toBe(1);flush();expect(geometry).toHaveBeenCalled();
  geometry.mockClear();panel.remove();await Promise.resolve();expect(unobserve).toHaveBeenCalledWith(panel);
  dispose();expect(pending.size).toBe(0);
});
