// server/pngRender.js — DOM（Canvas）を使わない、Node専用のPNG/GIFレンダリング。
//
// ブラウザ版（renderer.js / exporter.js）はCanvas2D APIに依存しているが、
// CLI（cli.js）はブラウザを介さずAIエージェントが直接叩くことを想定しているため、
// pngjs（純粋JS、ネイティブ依存なし）でピクセルバッファから直接PNGを組み立てる。
// GIFは gifenc（既にDOM非依存の純粋JS実装）をそのまま使う。

import { PNG } from 'pngjs';
import gifencPkg from 'gifenc';

const { GIFEncoder } = gifencPkg;

function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 等倍・透過ありのネイティブ解像度スプライトシート（アセット書き出し用）。
// exporter.js の exportSpritesheetPng と同じレイアウト。
export function buildNativeSpritesheetPng(project) {
    const { width, height, palette, frames } = project;
    const sheetW = width * frames.length;
    const sheetH = height;
    const png = new PNG({ width: sheetW, height: sheetH });
    png.data.fill(0); // 全ピクセルalpha=0(透明)で初期化

    frames.forEach((pixels, frameIdx) => {
        const ox = frameIdx * width;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const v = pixels[y * width + x];
                const idx = (sheetW * y + (ox + x)) << 2;
                if (v === -1 || v === undefined) continue;
                const [r, g, b] = hexToRgb(palette[v] || '#ff00ff');
                png.data[idx] = r;
                png.data[idx + 1] = g;
                png.data[idx + 2] = b;
                png.data[idx + 3] = 255;
            }
        }
    });

    return PNG.sync.write(png);
}

// 拡大・市松模様の背景付きスプライトシート（AIによる画像レビュー用）。
// exporter.js の buildReviewSpritesheetCanvas と同じレイアウト・拡大率ロジック。
function buildReviewSpritesheetPng(project) {
    const { width, height, palette, frames } = project;
    const maxSheetWidth = 1400;
    const scale = Math.max(2, Math.min(12, Math.floor(maxSheetWidth / (width * frames.length))));
    const checkerUnit = Math.max(2, Math.floor(scale / 2));

    const sheetW = width * scale * frames.length;
    const sheetH = height * scale;
    const png = new PNG({ width: sheetW, height: sheetH });

    for (let y = 0; y < sheetH; y++) {
        for (let x = 0; x < sheetW; x++) {
            const even = (Math.floor(x / checkerUnit) + Math.floor(y / checkerUnit)) % 2 === 0;
            const c = even ? 0x3a : 0x24;
            const idx = (sheetW * y + x) << 2;
            png.data[idx] = c;
            png.data[idx + 1] = c;
            png.data[idx + 2] = c;
            png.data[idx + 3] = 255;
        }
    }

    frames.forEach((pixels, frameIdx) => {
        const ox = frameIdx * width * scale;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const v = pixels[y * width + x];
                if (v === -1 || v === undefined) continue;
                const [r, g, b] = hexToRgb(palette[v] || '#ff00ff');
                for (let dy = 0; dy < scale; dy++) {
                    const py = y * scale + dy;
                    for (let dx = 0; dx < scale; dx++) {
                        const px = ox + x * scale + dx;
                        const idx = (sheetW * py + px) << 2;
                        png.data[idx] = r;
                        png.data[idx + 1] = g;
                        png.data[idx + 2] = b;
                        png.data[idx + 3] = 255;
                    }
                }
            }
        }
        if (frameIdx > 0) {
            for (let y = 0; y < sheetH; y++) {
                const idx = (sheetW * y + ox) << 2;
                png.data[idx] = 255;
                png.data[idx + 1] = 255;
                png.data[idx + 2] = 255;
                png.data[idx + 3] = 255;
            }
        }
    });

    return PNG.sync.write(png);
}

// core.js の generateWithSelfCheck に渡す renderReviewImage 実装。
export async function renderReviewImageBase64(project) {
    return buildReviewSpritesheetPng(project).toString('base64');
}

export function buildAnimatedGif(project) {
    const { width, height, palette, frames, fps } = project;
    const rgbPalette = palette.map(hexToRgb);
    const transparentIndex = rgbPalette.length; // 空きインデックスを透明色に割り当てる
    rgbPalette.push([0, 0, 0]);

    const gif = GIFEncoder();
    const delay = Math.max(20, Math.round(1000 / Math.max(1, fps || 8)));

    frames.forEach((pixels, i) => {
        const index = new Uint8Array(width * height);
        for (let p = 0; p < pixels.length; p++) {
            index[p] = pixels[p] === -1 || pixels[p] === undefined ? transparentIndex : pixels[p];
        }
        gif.writeFrame(index, width, height, {
            palette: i === 0 ? rgbPalette : undefined,
            delay,
            transparent: true,
            transparentIndex,
            dispose: 2,
            first: i === 0,
        });
    });

    gif.finish();
    return Buffer.from(gif.bytes());
}
