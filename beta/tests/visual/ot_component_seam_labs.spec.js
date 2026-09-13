const { test, expect } = require("@playwright/test");

const routes = [
  ["deck", ["wrap"], "render"],
  ["network", ["gsvg", "net"], "buildEls"],
  ["detail", ["term"], "openPanel"],
  ["edge", ["edrawer"], "openDrawer"],
  ["mail", ["gsvg"], "mailDrain"],
  ["replay", ["replayBar", "gsvg"], "startReplay"],
  ["runtime", ["spawnmd"], "openSpawnModal"],
];

for (const [component, representativeIds, action] of routes) {
  test(`OT ${component} production preview`, async ({ page }, testInfo) => {
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const badResponses = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText}`));
    page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

    await page.route("**/api/**", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, now: 1700000010, events: [], messages: [], agents: [] }) });
    });

    const response = await page.goto(`/src/labs/ot/routes/${component}.html`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    for (const representativeId of representativeIds) await expect(page.locator(`#${representativeId}`)).toBeAttached();
    await expect(page.locator("#ot-lab-root")).not.toBeEmpty();
    await expect(page.locator("#ot-lab-root")).toHaveAttribute("data-ot-action-invoked", action);
    const syntaxError = await page.locator("#ot-lab-root").getAttribute("data-ot-syntax-error");
    expect(syntaxError, `${component} reported a syntax error`).toBeNull();
    expect(failedRequests, failedRequests.join("\n")).toEqual([]);
    expect(badResponses, badResponses.join("\n")).toEqual([]);

    const classification = await page.locator("#ot-lab-root").getAttribute("data-ot-classification");
    const actionEffect = await page.locator("#ot-lab-root").getAttribute("data-ot-action-effect");
    expect(["interactive", "rendered-partial"]).toContain(classification);
    expect(["observed", "not-observed"]).toContain(actionEffect);
    if (classification === "interactive") expect(actionEffect).toBe("observed");
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
    expect(consoleErrors.filter((message) => /SyntaxError/.test(message)), consoleErrors.join("\n")).toEqual([]);
    console.log(JSON.stringify({ component, action, classification, actionEffect, actionResult: await page.locator("#ot-lab-root").getAttribute("data-ot-action-result"), visibleError: (await page.locator("[data-ot-error]").textContent())?.trim() || null, consoleErrors, pageErrors }));
    await testInfo.attach(`${component}-dom`, { body: await page.locator("#ot-lab-root").innerHTML(), contentType: "text/html" });
  });
}
