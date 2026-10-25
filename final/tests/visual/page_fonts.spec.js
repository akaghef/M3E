// @ts-check
const { test, expect } = require("@playwright/test");

// Standalone pages share viewer.css; their text must use the body font stack, not the browser's serif default.
for (const page of ["home.html", "artifacts.html"]) {
  test(`${page} text uses the body font stack`, async ({ page: tab }) => {
    await tab.goto(`/${page}`);
    const fonts = await tab.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      root: getComputedStyle(document.documentElement).fontFamily,
    }));
    expect(fonts.body).toContain("Segoe UI");
    expect(fonts.body).not.toBe(fonts.root);
  });
}
