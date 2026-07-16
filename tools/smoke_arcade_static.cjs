#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function loadPlaywright() {
  try { return require("playwright"); } catch (_) {}
  const appdata = process.env.APPDATA;
  if (appdata) {
    return require(path.join(appdata, "npm", "node_modules", "playwright"));
  }
  throw new Error("Playwright is not installed");
}

const { chromium } = loadPlaywright();
const base = (process.argv[2] || "http://127.0.0.1:8765").replace(/\/$/, "");
const out = path.resolve(__dirname, "..", "output", "arcade_static_smoke");
fs.mkdirSync(out, { recursive: true });

async function inspect(browser, name, route, action, viewport = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport });
  const faults = [];
  page.on("pageerror", error => faults.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") faults.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", request => {
    if (request.url().startsWith(base)) faults.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ""}`);
  });
  page.on("response", response => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      faults.push(`http ${response.status()}: ${response.url()}`);
    }
  });
  const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response || response.status() >= 400) throw new Error(`${name}: navigation failed`);
  await page.waitForTimeout(1200);
  if (action) await action(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
  if (faults.length) throw new Error(`${name}:\n${faults.join("\n")}`);
  const result = { name, route, title: await page.title(), url: page.url() };
  await page.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    results.push(await inspect(browser, "landing_desktop", "/arcade/", async page => {
      const count = await page.locator('a[href^="/arcade/custom/"]').count();
      if (count < 40) throw new Error(`landing exposes only ${count} local game links`);
      if (!(await page.title()).includes("Super Arcade")) throw new Error("landing title guard failed");
    }));
    results.push(await inspect(browser, "landing_mobile", "/arcade/", async page => {
      if (await page.locator("body").evaluate(el => el.scrollWidth > window.innerWidth + 8)) {
        throw new Error("mobile landing has horizontal overflow");
      }
    }, { width: 390, height: 844 }));
    results.push(await inspect(browser, "signal_crown", "/arcade/custom/vorath-signal-crown/", async page => {
      await page.locator("#start").click();
      await page.keyboard.press("ArrowRight");
      if (!(await page.locator("#game").isVisible())) throw new Error("signal crown canvas is not visible");
    }));
    results.push(await inspect(browser, "hypernova", "/arcade/custom/hypernova-swarm/", async page => {
      await page.locator("#startBtn").click();
      await page.keyboard.press("Space");
      if (!(await page.locator("#game").isVisible())) throw new Error("hypernova canvas is not visible");
    }));
    results.push(await inspect(browser, "terrarium_3d", "/arcade/custom/digital-terrarium-3d/", async page => {
      await page.waitForSelector("#webgl-canvas", { state: "visible", timeout: 30000 });
      const size = await page.locator("#webgl-canvas").evaluate(el => [el.width, el.height]);
      if (!size[0] || !size[1]) throw new Error("3D terrarium canvas did not initialize");
    }));
    results.push(await inspect(browser, "gem_shark", "/arcade/custom/gem-shark/", async page => {
      await page.locator("#startBtn").waitFor({ state: "visible", timeout: 60000 });
      await page.locator("#startBtn").click();
      if (!(await page.locator("canvas").isVisible())) throw new Error("Gem Shark canvas is not visible");
    }));
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ ok: true, base, results }, null, 2) + "\n");
  console.log(`OK: ${results.length} real-browser arcade checks`);
  for (const row of results) console.log(`OK: ${row.name} -> ${row.url}`);
  console.log(`EVIDENCE=${out}`);
})().catch(error => { console.error(error.stack || error); process.exit(1); });
