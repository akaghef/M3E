const {test,expect}=require('@playwright/test');
const {laneServer,surfaceAction,ready}=require('./lane_helpers');
const {research,bar,chip,choose,domain,geometry,paint,laneSets,hitTargets,settled}=require('./viewer_filter_helpers');
const open=laneServer(test);
const fixture=require('../fixtures/lane_asys_domains.json');
const original=require('../fixtures/lane_asys.json');
const links=Object.values(original.state.links);
const researchLinks=links.filter(l=>research.has(l.sourceNodeId)&&research.has(l.targetNodeId));
const currentResearch=researchLinks.filter(l=>l.attributes?.confidence==='system-evidenced');
for(const direction of ['down','right'])test(`Lane ${direction}: independent sets, counts, geometry, reset and persistence`,async({page})=>{
 const {read}=await open(page,fixture);
 await surfaceAction(page,'view','lane-surface','lane-direction',`lane-direction-${direction}`);await ready(page);
 await page.mouse.move(1,1);await page.keyboard.press('Escape');await settled(page);
 const saved=await read(),before=await geometry(page),basePaint=await paint(page),hits=await hitTargets(page);
 expect(research.size).toBe(12);expect(researchLinks.length).toBe(26);expect(currentResearch.length).toBe(1);
 await domain(page,'Research');expect(await hitTargets(page)).toEqual(hits);await laneSets(page,research,new Set(researchLinks.map(l=>l.id)));
 expect(await geometry(page)).toEqual(before);
 await choose(page,'実現段階','CURRENT');
 await laneSets(page,new Set(['item_mac','item_dell']),new Set(currentResearch.map(l=>l.id)));
 expect(await geometry(page)).toEqual(before);
 await page.waitForTimeout(2700);await expect(page.locator('.viewer-filter-count')).toHaveText('node 2/25 · GraphLink 1/82');
 // Selecting a dim body must preserve the filtered appearance after selection patch.
 await page.locator('.node-visual-box[data-node-id="item_chats"]').click();
 await expect.poll(()=>page.locator('.node-shape[data-node-id="item_chats"]').evaluate(e=>Number(getComputedStyle(e).opacity))).toBeLessThan(1);
 await bar(page).getByRole('button',{name:'解除',exact:true}).click();
 await expect(page.locator('.viewer-filter-count')).toHaveCount(0);expect(await geometry(page)).toEqual(before);
 // Return selection to the original root before comparing selection-dependent opacity.
 await page.locator('#board').focus();await page.keyboard.press('k');await page.keyboard.press('k');
 await expect(page.locator('[data-lane-header][data-node-id="asys"]')).toHaveClass(/selected/);
 expect(await paint(page)).toEqual(basePaint);
 await choose(page,'実現段階','CURRENT');
 const current=links.filter(l=>l.attributes?.confidence==='system-evidenced');
 await laneSets(page,new Set(current.flatMap(l=>[l.sourceNodeId,l.targetNodeId])),new Set(current.map(l=>l.id)));
 expect((await read()).nodes).toEqual(saved.nodes);expect((await read()).links).toEqual(saved.links);
 await page.reload();await ready(page);await expect(page.locator('.viewer-filter-count')).toHaveCount(0);
});
test('menus, keyboard, disabled explanations, zero counts and map reset',async({page})=>{
 await open(page,fixture);await surfaceAction(page,'view','lane-surface','lane-direction','lane-direction-down');await ready(page);
 for(const name of ['実現段階','重要度','緊急度','所属'])await expect(chip(page,name)).toBeVisible();
 for(const name of ['重要度','緊急度']){await expect(chip(page,name)).toBeDisabled();await expect(chip(page,name)).toHaveAccessibleDescription('この map には値がありません');}
 await chip(page,'実現段階').click();await expect(bar(page).getByRole('menu')).toHaveCount(1);await expect(bar(page).getByText('含む',{exact:true})).toHaveCount(1);
 const chipBox=await chip(page,'実現段階').boundingBox(),menuBox=await bar(page).getByRole('menu').boundingBox();expect(menuBox.y).toBeGreaterThanOrEqual(chipBox.y+chipBox.height);expect(Math.abs(menuBox.x-chipBox.x)).toBeLessThan(2);
 await chip(page,'実現段階').click();await expect(bar(page).getByRole('menu')).toHaveCount(0);
 await chip(page,'所属').click();await chip(page,'実現段階').click();await expect(bar(page).getByRole('menu')).toHaveCount(1);
 await page.keyboard.press('Escape');await expect(chip(page,'実現段階')).toBeFocused();await expect(chip(page,'実現段階')).toHaveAttribute('aria-expanded','false');
 await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowUp');await page.keyboard.press('Space');await expect(chip(page,'実現段階')).toBeFocused();await expect(bar(page).getByRole('menu')).toHaveCount(0);
 await chip(page,'所属').focus();await page.keyboard.press('Space');
 const check=bar(page).getByRole('menuitemcheckbox',{name:'Research',exact:true});await check.focus();await page.keyboard.press('Space');await expect(check).toHaveAttribute('aria-checked','true');await expect(check).toBeFocused();
 await bar(page).getByRole('menuitemcheckbox',{name:'すべて',exact:true}).click();await expect(check).toHaveAttribute('aria-checked','false');
 await check.click();await page.keyboard.press('Tab');await expect(bar(page).getByRole('menu')).toHaveCount(0);await expect(bar(page).getByRole('button',{name:'解除',exact:true})).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(chip(page,'所属')).toBeFocused();
 await bar(page).getByRole('button',{name:'解除',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('.viewer-filter-count')).toHaveCount(0);
 await domain(page,'Research');await choose(page,'実現段階','CURRENT');
 // Same-map view changes retain selections; the denominator is recomputed.
 await surfaceAction(page,'view','tree');await expect(chip(page,'所属')).toContainText('Research');await expect(chip(page,'実現段階')).toContainText('CURRENT');
 const second=structuredClone(fixture);Object.values(second.state.nodes).forEach(n=>{if(n.attributes?.domain)n.attributes.domain='Other';});
 await open(page,second);await expect(page.locator('.viewer-filter-count')).toHaveCount(0);await expect(chip(page,'所属')).toContainText('すべて');
});
