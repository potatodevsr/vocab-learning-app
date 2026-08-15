// Generates the brand raster assets that metadata and the web manifest point at:
// the social preview card and the installable app icons.
//
// Why hand-rolled: these are flat vector shapes in two brand colours, and every
// alternative drags in weight we do not want. `next/og` (satori + resvg wasm) would run
// on the Worker for an image that never changes, and it cannot render Thai without a
// font file we do not ship. An image library would be a build dependency for six PNGs
// that change roughly never. zlib is in Node already, and a PNG is a header plus a
// zlib-compressed scanline stream.
//
// The mark matches the `Sparkles` glyph the app bar uses, so the installed icon and the
// header are visibly the same product.
//
//   node scripts/generate-brand-assets.mjs
//
// Re-run after changing --brand in app/globals.css. Output is committed: the build must
// not depend on this script having been run.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- colour ---------- */

// The palette is authored in oklch (app/globals.css). Converting here rather than
// pasting hex keeps one source of truth: change the token, re-run, get matching assets.
const oklchToSrgb = (L, C, hDeg) => {
    const h = (hDeg * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);

    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

    const lin = [
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];

    return lin.map((v) => {
        const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
        return Math.max(0, Math.min(255, Math.round(c * 255)));
    });
};

const BRAND = oklchToSrgb(0.54, 0.19, 250);   // --brand
const CANVAS = oklchToSrgb(0.985, 0.012, 95); // --background
const INK = oklchToSrgb(0.16, 0.02, 250);     // --ink, near enough for a border
const WHITE = [255, 255, 255];

/* ---------- geometry (signed distance fields, supersampled) ---------- */

const roundedRect = (x, y, w, h, r) => {
    const dx = Math.abs(x) - w / 2 + r;
    const dy = Math.abs(y) - h / 2 + r;
    const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
    return outside + Math.min(Math.max(dx, dy), 0) - r;
};

/**
 * A four-point star with concave sides — the `Sparkles` silhouette.
 *
 * An astroid: the superellipse |x|^n + |y|^n = r^n with n below 1, which pulls the edges
 * inward between the four axis points. n = 1 would give a diamond and n = 2 a circle; an
 * earlier attempt averaged Chebyshev and Manhattan distance and drew a flat octagon.
 *
 * The return value is an inside/outside test, not a true distance — the caller relies on
 * supersampling for its edges rather than on the magnitude.
 */
const sparkle = (x, y, radius) => {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    return (Math.sqrt(ax) + Math.sqrt(ay)) ** 2 - radius;
};

const SS = 4; // supersampling factor per axis — 16 samples per pixel

const render = (width, height, shade) => {
    const px = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let r = 0, g = 0, b = 0, a = 0;

            for (let sy = 0; sy < SS; sy += 1) {
                for (let sx = 0; sx < SS; sx += 1) {
                    const px_ = x + (sx + 0.5) / SS;
                    const py_ = y + (sy + 0.5) / SS;
                    const [cr, cg, cb, ca] = shade(px_, py_);
                    r += cr; g += cg; b += cb; a += ca;
                }
            }

            const n = SS * SS;
            const o = (y * width + x) * 4;
            px[o] = Math.round(r / n);
            px[o + 1] = Math.round(g / n);
            px[o + 2] = Math.round(b / n);
            px[o + 3] = Math.round(a / n);
        }
    }

    return px;
};

/**
 * Paint `over` on top of `under` wherever the shape function says "inside".
 *
 * A hard test rather than a distance ramp: the shape functions below are not all true
 * signed distance fields, so a ramp would smear the ones whose gradient is not 1. Edge
 * smoothing comes from the 16 samples per pixel in `render`, which is geometry-agnostic.
 */
const layer = (under, over, inside) => (inside < 0 ? [over[0], over[1], over[2], 255] : under);

/* ---------- PNG encoding ---------- */

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
};

const encodePng = (width, height, rgba) => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // colour type: RGBA
    // 10..12 stay zero: deflate, adaptive filtering, no interlace.

    // One filter byte (0 = None) per scanline, then the raw row.
    const raw = Buffer.alloc(height * (width * 4 + 1));
    for (let y = 0; y < height; y += 1) {
        const src = y * width * 4;
        const dst = y * (width * 4 + 1);
        raw[dst] = 0;
        rgba.copy(raw, dst + 1, src, src + width * 4);
    }

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
};

const write = (relPath, width, height, shade) => {
    const out = join(ROOT, relPath);
    mkdirSync(dirname(out), { recursive: true });
    const png = encodePng(width, height, render(width, height, shade));
    writeFileSync(out, png);
    console.log(`${relPath}  ${width}×${height}  ${(png.length / 1024).toFixed(1)} KB`);
};

/* ---------- the assets ---------- */

/** App icon: brand tile, white sparkle. `inset` leaves room for maskable safe area. */
const iconShade = (size, { inset = 0, radius = 0.22, bg = BRAND, mark = WHITE } = {}) =>
    (x, y) => {
        const cx = x - size / 2;
        const cy = y - size / 2;
        const tile = size * (1 - inset);
        const tileDist = roundedRect(cx, cy, tile, tile, tile * radius);

        // Outside the tile is transparent rather than canvas-coloured: a launcher
        // composites a maskable icon onto its own background, and an opaque square would
        // show as a card sitting on top of it.
        if (tileDist >= 0) return [0, 0, 0, 0];

        const c = layer(bg, mark, sparkle(cx, cy, tile * 0.34));
        return [c[0], c[1], c[2], 255];
    };

for (const [file, size, opts] of [
    ["public/icon-192.png", 192, {}],
    ["public/icon-512.png", 512, {}],
    ["public/icon-maskable-512.png", 512, { inset: 0.2, radius: 0.5 }],
    ["public/apple-icon.png", 180, {}],
]) {
    write(file, size, size, iconShade(size, opts));
}

/**
 * Social preview card, 1200×630 — the size Facebook, X, LINE and Discord all crop to.
 *
 * Deliberately typeless: rendering the Thai headline would mean shipping and embedding a
 * Thai font, and every platform already draws `og:title` and `og:description` as live
 * text beside the image. The image's job is to be unmistakably this product at thumbnail
 * size, which a brandmark does and a paragraph does not.
 */
const OG_W = 1200;
const OG_H = 630;

write("public/og.png", OG_W, OG_H, (x, y) => {
    let c = [...CANVAS];

    // A brand band down the left third, the same split the site's hero bands use.
    c = layer(c, BRAND, x - OG_W * 0.42);

    const seam = OG_W * 0.42;

    // Ink keyline along the seam, matching the 3px borders the UI uses everywhere.
    c = layer(c, INK, Math.abs(x - seam) - 4);

    // Oversized sparkle straddling the seam, inverting its colour as it crosses, so the
    // mark reads at thumbnail size against either ground.
    const inStar = sparkle(x - seam, y - OG_H / 2, 215);
    c = layer(c, x < seam ? WHITE : BRAND, inStar);

    // Three ascending bars bottom-left: the level ladder A1→B2, and something to stop the
    // composition reading as centred clip art.
    for (let i = 0; i < 3; i += 1) {
        c = layer(c, WHITE, roundedRect(x - (120 + i * 78), y - (540 - i * 26), 54, 14, 7));
    }

    return c;
});
