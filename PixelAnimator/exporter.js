// exporter.js — スプライトシート PNG / アニメーション GIF / プロジェクト JSON の書き出しと読み込み

function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function triggerDownload(blobOrUrl, filename) {
    const url = blobOrUrl instanceof Blob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (blobOrUrl instanceof Blob) URL.revokeObjectURL(url);
}

export async function exportSpritesheetPng(project) {
    const { width, height, palette, frames } = project;
    const sheet = document.createElement('canvas');
    sheet.width = width * frames.length;
    sheet.height = height;
    const ctx = sheet.getContext('2d');

    frames.forEach((pixels, frameIdx) => {
        const imgData = ctx.createImageData(width, height);
        for (let i = 0; i < pixels.length; i++) {
            const v = pixels[i];
            const o = i * 4;
            if (v === -1 || v === undefined) {
                imgData.data[o + 3] = 0;
                continue;
            }
            const [r, g, b] = hexToRgb(palette[v] || '#ff00ff');
            imgData.data[o] = r;
            imgData.data[o + 1] = g;
            imgData.data[o + 2] = b;
            imgData.data[o + 3] = 255;
        }
        ctx.putImageData(imgData, frameIdx * width, 0);
    });

    const blob = await new Promise((resolve) => sheet.toBlob(resolve, 'image/png'));
    triggerDownload(blob, 'pixel-animation-spritesheet.png');
}

export async function exportAnimatedGif(project) {
    const { GIFEncoder } = await import('gifenc');
    const { width, height, palette, frames, fps } = project;

    const rgbPalette = palette.map(hexToRgb);
    const transparentIndex = rgbPalette.length; // 空きインデックスを透明色に割り当てる
    rgbPalette.push([0, 0, 0]);

    const gif = GIFEncoder();
    const delay = Math.max(20, Math.round(1000 / Math.max(1, fps)));

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
    const blob = new Blob([gif.bytes()], { type: 'image/gif' });
    triggerDownload(blob, 'pixel-animation.gif');
}

export function exportProjectJson(project) {
    const payload = {
        type: 'pixel-animator-project',
        version: 1,
        ...project,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, 'pixel-animation-project.json');
}

export function parseProjectJson(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.frames) || !Array.isArray(data.palette) || !data.width || !data.height) {
        throw new Error('不正なプロジェクトJSONです。');
    }
    return {
        width: data.width,
        height: data.height,
        fps: data.fps || 8,
        loopMode: data.loopMode || 'loop',
        palette: data.palette,
        frames: data.frames,
    };
}
