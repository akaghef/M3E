const {expect}=require('@playwright/test');
const research = new Set(['res','obsidian','chrome','miro','mac','dell','ipad','gd','chats','codex','ha','akos'].map(id=>'item_'+id));
const bar = page => page.getByRole('toolbar',{name:'フィルタ',exact:true});
const chip = (page,label) => bar(page).getByRole('button',{name:new RegExp('^'+label)});
async function choose(page,label,value){await chip(page,label).click();await bar(page).getByRole('menuitemradio',{name:new RegExp(value)}).click();}
async function domain(page,name){await chip(page,'所属').click();await bar(page).getByRole('menuitemcheckbox',{name,exact:true}).click();await bar(page).getByRole('button',{name:'閉じる',exact:true}).click();}
async function geometry(page){return page.locator('#canvas').evaluate(svg=>Array.from(svg.querySelectorAll('.node-hit,.graph-link,.edge,.scatter-guide,.timeline-stem')).map(e=>({tag:e.tagName,id:e.getAttribute('data-node-id')||e.getAttribute('data-link-id'),attrs:['x','y','width','height','cx','cy','r','d','x1','y1','x2','y2'].map(a=>e.getAttribute(a))})));}
async function paint(page){return page.locator('#canvas').evaluate(svg=>Object.fromEntries(Array.from(svg.querySelectorAll('.node-shape,.root-box,.folder-box,.graph-link,.edge,.edge-label,text[data-node-id],.graph-link-label')).map((e,i)=>[`${e.tagName}:${e.getAttribute('class')}:${e.getAttribute('data-node-id')||e.getAttribute('data-link-id')||i}`,Number(getComputedStyle(e).opacity)])));}
async function laneSets(page,nodes,links){
 const actual=await page.locator('#canvas').evaluate(svg=>({nodes:Array.from(svg.querySelectorAll('.node-shape')).filter(e=>Number(getComputedStyle(e).opacity)>.9).map(e=>e.getAttribute('data-node-id')).sort(),links:Array.from(svg.querySelectorAll('.graph-link')).filter(e=>Number(getComputedStyle(e).opacity)>.9).map(e=>e.getAttribute('data-link-id')).sort()}));
 expect(actual).toEqual({nodes:[...nodes].sort(),links:[...links].sort()});
 await expect(page.locator('.viewer-filter-count')).toHaveText(`node ${nodes.size}/25 · GraphLink ${links.size}/82`);
}
async function settled(page){
 await expect.poll(async()=>{const a=await geometry(page);await page.waitForTimeout(150);return JSON.stringify(a)===JSON.stringify(await geometry(page));},{timeout:10000}).toBe(true);
}
module.exports={research,bar,chip,choose,domain,geometry,paint,laneSets,settled};
