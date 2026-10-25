const {expect}=require('@playwright/test');
const {settled}=require('./viewer_filter_helpers');
// Dedicated input. Attributes and expected sets are explicit, independent of product predicates.
const fixture={version:1,state:{rootId:'root',nodes:{},links:{},annotations:{},scopes:{},surfaces:{}}};
for(const [id,parentId,children,importance,urgency] of [
 ['root',null,['left','right'],'3','3'],['left','root',['low','high'],'3','3'],['right','root',['mid'],'3','3'],
 ['low','left',[],'1','1'],['high','left',[],'3','3'],['mid','right',[],'2','2'],
])fixture.state.nodes[id]={id,parentId,children,nodeType:'text',text:id,collapsed:false,details:'',note:'',link:'',attributes:{importance,urgency,domain:id==='low'?'Other':'Research','m3e:style':JSON.stringify({fill:'#ffffff',border:'#333333'})}};
fixture.state.links={a:{id:'a',sourceNodeId:'low',targetNodeId:'high',relationType:'uses',label:'Uses',color:'#b91c1c',direction:'both',style:'default',attributes:{confidence:'system-evidenced'}},b:{id:'b',sourceNodeId:'high',targetNodeId:'mid',relationType:'feeds',label:'Feeds',color:'#b91c1c',direction:'forward',style:'default',attributes:{confidence:'declared'}}};
async function mode(page,mode){
 // Surface/direction changes autosave and redraw asynchronously. Finish that operation
 // before measuring filter-only render counts (the filter must never save or relayout).
 await expect(page.locator('#board')).not.toHaveAttribute('data-render-pending','true');
 const saved=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.startsWith('/api/maps/'));
 const revision=Number(await page.locator('#board').getAttribute('data-render-revision'));
 await page.evaluate(mode=>window.dispatchEvent(new CustomEvent('m3e:set-surface-layout',{detail:{mode,direction:'right'}})),mode);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.surfaceViewMode)).toBe(mode);
 await (await saved).finished();
 await expect.poll(async()=>Number(await page.locator('#board').getAttribute('data-render-revision'))).toBeGreaterThan(revision);
 await page.mouse.move(1,1);await page.keyboard.press('Escape');await settled(page);
}
module.exports={fixture,mode};
