import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import puppeteer from "puppeteer";

// Run with the citizen site running: node --test tests/scroll-sequence.test.mjs
test("film captions stay separate when scrolling forward and backward", async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewport(viewport);
      await page.goto(process.env.TEST_SITE_URL || "http://localhost:3001", {
        waitUntil: "networkidle0",
      });
      await page.waitForSelector(".film-copy");
      let captured = false;

      const samples = [
        [0, 0], [0.1, 0], [0.145, 0], [0.175, -1],
        [0.2, 1], [0.3, 1], [0.41, 1], [0.45, -1],
        [0.48, 2], [0.6, 2], [0.7, 2], [0.74, -1],
        [0.8, 3], [0.9, 3], [1, 3],
      ];
      for (const [progress, expected] of [...samples, ...samples.toReversed()]) {
        await page.evaluate((progress) => {
          const sequence = document.querySelector(".film").parentElement;
          window.scrollTo({
            top: sequence.offsetTop + (sequence.offsetHeight - innerHeight) * progress,
            behavior: "instant",
          });
        }, progress);
        // Allow scroll timelines and their derived visibility values to paint.
        await new Promise((resolve) => setTimeout(resolve, 100));
        const captions = await page.evaluate(() =>
          [...document.querySelectorAll(".film-copy")].map((copy) => ({
            opacity: Number(getComputedStyle(copy.firstElementChild).opacity),
            visible: getComputedStyle(copy).visibility === "visible",
            visibleLink: Boolean(copy.querySelector("a") &&
              getComputedStyle(copy.querySelector("a")).visibility === "visible"),
          })),
        );
        const context = `${viewport.width}px at scroll progress ${progress}`;
        const visible = captions.flatMap((caption, index) =>
          caption.visible && caption.opacity > 0.001 ? [index] : [],
        );
        assert.deepEqual(visible, expected < 0 ? [] : [expected], context);
        captions.forEach((caption, index) => {
          if (index !== expected) assert.equal(caption.visibleLink, false, context);
        });
        if (progress >= 0.175) {
          assert.equal(captions[0].opacity, 0, `Opening caption reappeared: ${context}`);
        }
        if (progress === 0 || progress === 0.9) {
          assert.equal(await page.evaluate(() => {
            const copy = [...document.querySelectorAll(".film-copy")].find(
              (copy) => getComputedStyle(copy).visibility === "visible",
            );
            const link = copy.querySelector("a");
            const rect = link.getBoundingClientRect();
            return document.elementFromPoint(
              rect.x + rect.width / 2, rect.y + rect.height / 2,
            )?.closest("a") === link;
          }), true, `Visible CTA is blocked: ${context}`);
        }
        if (!captured && process.env.TEST_SCREENSHOT_DIR && progress === 0.3) {
          await page.waitForFunction(() => document.querySelector(".film canvas").dataset.frame === "47");
          await page.screenshot({
            path: path.join(process.env.TEST_SCREENSHOT_DIR, `scroll-sequence-${viewport.width}.png`),
          });
          captured = true;
        }
      }
      assert.deepEqual(errors, [], "Browser errors");
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test("full-resolution frames load progressively, survive failures, and release decoded memory", async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument(() => {
      const decode = window.createImageBitmap.bind(window);
      window.bitmapStats = { active: 0, peak: 0 };
      window.createImageBitmap = async (...args) => {
        const bitmap = await decode(...args);
        const close = bitmap.close.bind(bitmap);
        let closed = false;
        window.bitmapStats.active++;
        window.bitmapStats.peak = Math.max(window.bitmapStats.peak, window.bitmapStats.active);
        bitmap.close = () => {
          if (!closed) {
            closed = true;
            window.bitmapStats.active--;
          }
          close();
        };
        return bitmap;
      };
    });
    const requested = new Set();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().includes("/scroll-frames/")) requested.add(request.url());
      // Simulate one missing frame while scrubbing through the middle of the film.
      if (request.url().includes("frame-079.webp")) void request.abort();
      else void request.continue();
    });
    await page.goto(process.env.TEST_SITE_URL || "http://localhost:3001", { waitUntil: "networkidle0" });
    await page.waitForFunction(() => document.querySelector(".film canvas").dataset.frame === "0");
    assert.ok(requested.size <= 13, `Startup fetched ${requested.size} frames instead of a small window`);
    const startupRequests = requested.size;
    const rendered = await page.evaluate(async () => {
      const canvas = document.querySelector(".film canvas");
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      const digest = await crypto.subtle.digest("SHA-256", pixels);
      return {
        width: canvas.width,
        height: canvas.height,
        hash: [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""),
      };
    });
    const original = await sharp(fileURLToPath(new URL("../public/scroll-frames/frame-000.webp", import.meta.url)))
      .ensureAlpha().raw().toBuffer();
    assert.equal(rendered.width, 1920);
    assert.equal(rendered.height, 1080);
    assert.equal(rendered.hash, createHash("sha256").update(original).digest("hex"),
      "Canvas introduced scaling or pixel loss on the high-density display");

    for (const progress of [0.5, 0.85, 0.2, 0.65, 0.01]) {
      await page.evaluate((progress) => {
        const sequence = document.querySelector(".film").parentElement;
        window.scrollTo({ top: (sequence.offsetHeight - innerHeight) * progress, behavior: "instant" });
      }, progress);
      const target = Math.floor(progress * 159);
      await page.waitForFunction((target) => {
        const frame = Number(document.querySelector(".film canvas").dataset.frame);
        return target === 79 ? Math.abs(frame - target) === 1 : frame === target;
      }, {}, target);
      assert.equal(await page.$(".film-loading"), null, "Loading cleared the visible film");
    }
    const stats = await page.evaluate(() => window.bitmapStats);
    assert.ok(stats.active <= 14, `Retained too many decoded frames: ${stats.active}`);
    assert.ok(stats.peak <= 17, `Decoded frames grew without bound: ${stats.peak}`);
    console.log(`Startup requests: ${startupRequests}; peak decoded frames: ${stats.peak}`);

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.waitForFunction(() => document.querySelector(".film canvas").height === 1080);
    assert.equal(await page.$eval(".film canvas", (canvas) => canvas.width), 499);
    await page.click(".film-copy .cta");
    await page.waitForFunction(() => location.pathname === "/check" && window.bitmapStats.active === 0);
  } finally {
    await browser.close();
  }
});
