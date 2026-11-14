// Renders the app's icons (public/icons/*.png) from public/favicon.svg, so they all show the
// same leaf as the app's header. Run it after changing favicon.svg: npm run icons
// (CHROMIUM_PATH=/path/to/chrome npm run icons to use a Chromium Playwright didn't install).
import { readFile, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

const PUBLIC = new URL("../public/", import.meta.url);
// Shade 0 of the theme's green ("leaf" in src/theme.ts).
const BACKGROUND = "#e6f8ee";

// `art` is the leaf's share of the icon. A maskable icon keeps it inside the middle 80% circle
// that every launcher's shape leaves visible; Apple's icon needs an opaque background.
const ICONS = [
    { file: "icons/icon-192.png", size: 192, art: 0.8, background: null },
    { file: "icons/icon-512.png", size: 512, art: 0.8, background: null },
    { file: "icons/apple-touch-icon.png", size: 180, art: 0.6, background: BACKGROUND },
    { file: "icons/maskable-512.png", size: 512, art: 0.5, background: BACKGROUND },
];

const svg = await readFile(new URL("favicon.svg", PUBLIC), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
    const page = await browser.newPage();
    for (const { file, size, art, background } of ICONS) {
        await page.setViewportSize({ width: size, height: size });
        const leaf = Math.round(size * art);
        await page.setContent(
            `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;` +
                `background:${background ?? "transparent"}">` +
                svg.replace("<svg ", `<svg width="${leaf}" height="${leaf}" `) +
                "</body>",
        );
        const png = await page.screenshot({ omitBackground: !background });
        await writeFile(new URL(file, PUBLIC), png);
        console.log(`${file}: ${size}×${size}`);
    }
} finally {
    await browser.close();
}
