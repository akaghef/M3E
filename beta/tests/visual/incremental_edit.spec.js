const {test,expect}=require("@playwright/test");
const base=require("../fixtures/shortcut_test.json");
test.use({launchOptions:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]}});

for(const renderer of ["svg","webgl"]) {
  test.describe(`${renderer} incremental editing`,()=>{
    let errors;
    test.beforeEach(async({page})=>{
      errors=[]; page.on("pageerror",error=>errors.push(error.message));
      const fixture=structuredClone(base);
      for(let i=0;i<300;i++) {
        const id=`extra-${i}`;
        fixture.state.nodes[id]={...fixture.state.nodes["child-b"],id,text:`Node ${i}`,children:[]};
        fixture.state.nodes.root.children.push(id);
      }
      if(test.info().title.includes("alias")) {
        Object.assign(fixture.state.nodes["extra-299"],{nodeType:"alias",targetNodeId:"child-b",aliasLabel:"",access:"read"});
        fixture.state.links={related:{id:"related",sourceNodeId:"child-b",targetNodeId:"child-c",label:"関連",style:"default",direction:"forward",color:"#7c3aed"}};
      }
      await page.addInitScript(()=>Object.defineProperty(navigator,"platform",{get:()=>"MacIntel"}));
      await page.route("**/api/**",route=>{
        const url=new URL(route.request().url());
        if(url.pathname==="/api/maps/incremental-fixture" && route.request().method()==="GET") return route.fulfill({json:fixture});
        return route.fulfill({json:{ok:true,enabled:false,available:false}});
      });
      await page.goto(`/viewer.html?renderer=${renderer}&map=incremental-fixture&testRun=incremental-${renderer}-${Date.now()}`);
      await expect(page.locator("#board")).toHaveAttribute("data-ready","true");
      await expect(page.locator("#meta")).toContainText("nodes: 307");
      if(renderer==="webgl") await expect.poll(()=>page.evaluate(()=>Boolean(window.__m3eWebGLProjection?.getDebugState().active))).toBe(true);
      await page.locator("#board").focus();
      await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowDown");
      await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id","child-b");
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    });
    test.afterEach(()=>expect(errors).toEqual([]));

    test("remeasures a resized label only, keeps distant DOM, updates curve and hit box",async({page},testInfo)=>{
      await page.evaluate(()=>{
        window.retainedLabel=document.querySelector('text[data-node-id="extra-299"]');
        window.oldHit=document.querySelector('.node-hit[data-node-id="child-b"]').getAttribute("width");
        window.oldEdge=document.querySelector('.edge[data-target-node-id="child-b"]').getAttribute("d");
      });
      await page.keyboard.press("F2");
      const editor=page.locator("textarea.inline-node-editor");
      await editor.fill("日本語の編集でボックスの横幅が大きく伸びることを確認する長いラベル");
      const revision=await page.locator("#board").getAttribute("data-render-revision");
      await page.keyboard.press("Escape");
      await expect(editor).toHaveCount(0);
      const work=await page.locator("#board").evaluate(el=>JSON.parse(el.dataset.editWork));
      expect(work.incremental).toBe(true); expect(work.measured).toBe(1);
      expect(work.nodes).toBeLessThan(10);
      expect(Number(await page.locator("#board").getAttribute("data-render-revision"))).toBe(Number(revision)+1);
      expect(await page.evaluate(()=>window.retainedLabel===document.querySelector('text[data-node-id="extra-299"]'))).toBe(true);
      expect(await page.evaluate(()=>Number(document.querySelector('.node-hit[data-node-id="child-b"]').getAttribute("width"))>Number(window.oldHit))).toBe(true);
      if(renderer==="webgl") {
        await expect.poll(()=>page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot().nodes.find(n=>n.id==="child-b").label)).toContain("日本語");
        const box=await page.locator('.node-hit[data-node-id="child-b"]').evaluate(el=>({x:Number(el.getAttribute("x")),width:Number(el.getAttribute("width"))}));
        const hit=await page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot().nodes.find(n=>n.id==="child-b"));
        expect(hit.x).toBe(box.x); expect(hit.width).toBe(box.width);
      }
      await page.keyboard.press("F2"); await editor.fill("複数行\n二行目\n三行目\n四行目"); await page.keyboard.press("Escape");
      expect(await page.evaluate(()=>document.querySelector('.edge[data-target-node-id="child-b"]').getAttribute("d")!==window.oldEdge)).toBe(true);
      await page.keyboard.press("0"); await page.keyboard.press("F2"); await page.keyboard.press("Escape");
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      // The camera intentionally refines raster quality 120 ms after zoom stops.
      await page.waitForTimeout(200);
      await page.screenshot({path:testInfo.outputPath(`incremental-${renderer}.png`)});
      await page.keyboard.press("Meta+z");
      await expect(page.locator('text.label-node[data-node-id="child-b"]')).toContainText("日本語");
    });

    test("commit + sibling/child insertion renders once and preserves two Undo steps",async({page})=>{
      const editor=page.locator("textarea.inline-node-editor");
      await page.keyboard.press("F2"); await editor.fill("確定した名前");
      const revision=Number(await page.locator("#board").getAttribute("data-render-revision"));
      await page.keyboard.press("Enter");
      await expect(editor).toBeFocused(); await expect(editor).toHaveValue("");
      await expect(page.locator("#meta")).toContainText("nodes: 308");
      expect(Number(await page.locator("#board").getAttribute("data-render-revision"))).toBe(revision+1);
      const work=await page.locator("#board").evaluate(el=>JSON.parse(el.dataset.editWork));
      expect(work.measured).toBe(2);
      await page.keyboard.press("Escape"); await page.keyboard.press("Meta+z");
      await expect(page.locator("#meta")).toContainText("nodes: 307");
      await expect(page.locator('text.label-node[data-node-id="child-b"]')).toHaveText("確定した名前");
      await page.keyboard.press("Meta+z");
      await expect(page.locator('text.label-node[data-node-id="child-b"]')).toHaveText("Child B");
      await page.keyboard.press("F2"); await editor.fill("子を持つ親");
      const beforeTab=Number(await page.locator("#board").getAttribute("data-render-revision"));
      await page.keyboard.press("Tab");
      await expect(editor).toBeFocused(); await expect(editor).toHaveValue("");
      expect(Number(await page.locator("#board").getAttribute("data-render-revision"))).toBe(beforeTab+1);
      await expect(page.locator("#meta")).toContainText("nodes: 308");
    });

    test("alias followers and GraphLink geometry update with the resized target",async({page})=>{
      const link=page.locator('path.graph-link[data-link-id="related"]');
      const before=await link.getAttribute("d");
      await page.keyboard.press("F2");
      await page.locator("textarea.inline-node-editor").fill("参照先の文字を変更\n複数行のサイズ");
      await page.keyboard.press("Escape");
      const work=await page.locator("#board").evaluate(el=>JSON.parse(el.dataset.editWork));
      expect(work.measured).toBe(2);
      await expect(page.locator('text.label-node[data-node-id="extra-299"]')).toContainText("参照先の文字を変更");
      expect(await link.getAttribute("d")).not.toBe(before);
      if(renderer==="webgl") {
        await expect.poll(()=>page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot().nodes.find(n=>n.id==="extra-299").label)).toContain("参照先の文字を変更");
        expect(await page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot().graphLinks[0].points.length)).toBeGreaterThan(2);
      }
    });
  });
}
