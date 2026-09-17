// Mode-transition regressions: isolated fixture, no personal workspace/clipboard.
const { test, expect } = require("@playwright/test");
const fixture = require("../fixtures/shortcut_test.json");
// Software WebGL for correctness coverage, never a GPU benchmark.
test.use({launchOptions:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]}});

for (const platform of ["MacIntel", "Win32"]) {
  for (const renderer of ["svg", "webgl"]) {
    test.describe(`${platform} ${renderer} keyboard modes`, () => {
      const primary = platform === "MacIntel" ? "Meta" : "Control";
      const secondary = platform === "MacIntel" ? "Control" : "Meta";
      test.beforeEach(async ({ page }) => {
        await page.addInitScript((platform) => {
          Object.defineProperty(navigator,"platform",{get:()=>platform});
          // Do not change the operator's clipboard during tests.
          Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{},readText:async()=>""},configurable:true});
        },platform);
        // Serve the fixture from initialization, not a racing file import.
        // All API effects stay in this page; never reach a real workspace.
        await page.route("**/api/**", route => {
          const url=new URL(route.request().url());
          if(url.pathname==="/api/maps/keyboard-fixture" && route.request().method()==="GET") return route.fulfill({json:fixture});
          if(url.pathname.startsWith("/api/system-clipboard/")) return route.fulfill({json:{ok:true,text:""}});
          return route.fulfill({json:{ok:true,enabled:false,available:false}});
        });
        await page.goto(`/viewer.html?renderer=${renderer}&map=keyboard-fixture&testRun=keyboard-${platform}-${renderer}-${Date.now()}`);
        await expect(page.locator("#board")).toHaveAttribute("data-ready","true");
        await expect(page.locator("#meta")).toContainText("nodes: 7");
        if (renderer === "webgl") {
          // Do not silently count SVG fallback as a passing WebGL regression.
          await expect.poll(()=>page.evaluate(()=>Boolean(window.__m3eWebGLProjection?.getDebugState().active))).toBe(true);
        }
        await page.locator("#board").focus();
        await expect(page.locator("#board")).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id","child-a");
      });

      test("Edit input, Escape and next-editor retain text without navigating twice",async ({page})=>{
        const board=page.locator("#board");
        const editor=page.locator("textarea.inline-node-editor");
        await page.keyboard.press("Enter");
        await expect(board).toHaveAttribute("data-keyboard-mode","edit");
        await expect(editor).toBeFocused();
        await expect(editor).toHaveValue("Child A");
        await expect.poll(()=>editor.evaluate(el=>[el.selectionStart,el.selectionEnd])).toEqual([7,7]);
        await editor.fill("保持する日本語");
        await page.keyboard.press("Shift+Enter");
        await page.keyboard.insertText("二行目");
        await expect(page.locator('#canvas text.label-node[data-node-id="child-a"]')).toHaveText("Child A");
        await page.keyboard.press("ArrowUp");
        await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id","child-a");
        await page.keyboard.press("Escape");
        await expect(editor).toHaveCount(0);
        await expect(board).toHaveAttribute("data-keyboard-mode","navigate");
        await expect(board).toBeFocused();
        await page.keyboard.press("F2");
        await expect(editor).toHaveValue("保持する日本語\n二行目");
        await expect.poll(()=>editor.evaluate(el=>[el.selectionStart,el.selectionEnd])).toEqual([0,"保持する日本語\n二行目".length]);
        await editor.fill("次へ移っても保持");
        await page.keyboard.press(`${primary}+Enter`);
        await expect(editor).toHaveAttribute("data-node-id","child-b");
        await expect(editor).toBeFocused();
        await expect(editor).toHaveValue("Child B");
        await expect(page.locator('#canvas text.label-node[data-node-id="child-a"]')).toHaveText("次へ移っても保持");
        await expect(page.locator("#meta")).toContainText("nodes: 7");
        await editor.fill("blurでも保持");
        await board.focus();
        await expect(editor).toHaveCount(0);
        await expect(board).toHaveAttribute("data-keyboard-mode","navigate");
        await page.keyboard.press("Shift+Enter");
        await expect(editor).toHaveValue("blurでも保持");
        await expect.poll(()=>editor.evaluate(el=>[el.selectionStart,el.selectionEnd])).toEqual([0,"blurでも保持".length]);
        await page.keyboard.press("Escape");
        await page.keyboard.press(`${primary}+Enter`);
        await expect(editor).toHaveAttribute("data-node-id","child-c");
      });

      test("Tab and Enter create exactly one node each and edit it before the next paint",async ({page})=>{
        const editor=page.locator("textarea.inline-node-editor");
        // Check synchronously in the same browser task, before RAF can refresh
        // the retained snapshot: this is the original regression boundary.
        const first=await page.locator("#board").evaluate(board=>{
          board.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));
          const el=document.querySelector("textarea.inline-node-editor");
          return {mode:board.dataset.keyboardMode,editing:el?.dataset.nodeId,selected:document.querySelector("#meta").dataset.selectedNodeId,focused:document.activeElement===el};
        });
        expect(first.mode).toBe("edit");
        expect(first.editing).toBe(first.selected);
        expect(first.focused).toBe(true);
        await expect(page.locator("#meta")).toContainText("nodes: 8");
        await editor.fill("新規ノード");
        await page.keyboard.press("Enter");
        await expect(editor).toBeFocused();
        await expect(editor).toHaveValue("");
        await expect(page.locator("#meta")).toContainText("nodes: 9");
        const sibling=await editor.getAttribute("data-node-id");
        expect(sibling).not.toBe(first.editing);
        await editor.fill("子を追加する親");
        await page.keyboard.press("Tab");
        await expect(editor).toBeFocused();
        await expect(editor).toHaveValue("");
        await expect(page.locator("#meta")).toContainText("nodes: 10");
        await page.keyboard.press("Escape");
        await page.keyboard.press("ArrowLeft");
        await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id",sibling);
      });

      test("platform shortcuts, IME and native text events cannot leak into Navigate",async ({page}, testInfo)=>{
        const editor=page.locator("textarea.inline-node-editor");
        await page.keyboard.press(`${secondary}+a`);
        await expect(page.locator("#meta")).toContainText("selected: Child A (1)");
        await page.keyboard.press(`${primary}+a`);
        await expect(page.locator("#meta")).toContainText("(7)");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowDown");
        await expect(page.locator("#meta")).toHaveAttribute("data-selected-node-id","child-b");
        await page.keyboard.press("Enter");
        await editor.fill("draft only");
        const before=await editor.getAttribute("data-node-id");
        // Real DOM bubbling, including editor teardown. Synthetic composition
        // events test dispatch ownership, not the operating system's IME UI.
        for(const key of ["Enter","Tab","Escape"]) {
          await editor.dispatchEvent("keydown",{key,isComposing:true,bubbles:true,cancelable:true});
          await expect(editor).toHaveAttribute("data-node-id",before);
        }
        await editor.dispatchEvent("keydown",{key:"Enter",[platform==="MacIntel"?"ctrlKey":"metaKey"]:true,bubbles:true,cancelable:true});
        await expect(editor).toHaveAttribute("data-node-id",before);
        await expect(page.locator("#meta")).toContainText("nodes: 7");
        await editor.dispatchEvent("keydown",{key:"a",[platform==="MacIntel"?"metaKey":"ctrlKey"]:true,bubbles:true,cancelable:true});
        await expect(page.locator("#meta")).toContainText("(1)");
        await page.keyboard.press("Escape");
        // Only the platform primary modifier triggers the map copy command.
        const copiedBefore=await page.locator("#status").textContent();
        await page.keyboard.press(`${secondary}+c`);
        expect(await page.locator("#status").textContent()).toBe(copiedBefore);
        await page.keyboard.down(primary);
        await page.keyboard.press("c");
        await expect(page.locator("#status")).toContainText("Copied");
        // A consumed shortcut must cancel the bare-modifier hold timer.
        await page.waitForTimeout(450);
        await expect(page.locator("#shortcut-cheatsheet")).toBeHidden();
        await page.keyboard.up(primary);
        await page.keyboard.press(`${primary}+v`);
        await expect(page.locator("#meta")).toContainText("nodes: 8");
        await page.keyboard.press(`${primary}+z`);
        await expect(page.locator("#meta")).toContainText("nodes: 7");
        await page.keyboard.press(`${primary}+Shift+z`);
        await expect(page.locator("#meta")).toContainText("nodes: 8");
        await page.getByRole("button",{name:"Help and shortcuts",exact:true}).click();
        await expect(page.locator(".wb-help-modal")).toContainText(`${platform==="MacIntel"?"Command":"Ctrl"}+C / X / V`);
        await page.screenshot({path:testInfo.outputPath("keyboard-help.png")});
      });
    });
  }
}
