// renderer.js — キャンバス描画（編集キャンバス・再生キャンバス・サムネイル・パレット）

export function drawFrame(canvas, pixels, width, height, palette, cellSize) {
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const v = pixels[y * width + x];
            if (v === -1 || v === undefined) continue;
            ctx.fillStyle = palette[v] || '#ff00ff';
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
    }
}

export function renderPaletteStrip(container, palette, activeIndex, onSelect) {
    container.innerHTML = '';

    const transparentSwatch = document.createElement('button');
    transparentSwatch.className = 'palette-swatch transparent-swatch' + (activeIndex === -1 ? ' active' : '');
    transparentSwatch.title = '透明';
    transparentSwatch.addEventListener('click', () => onSelect(-1));
    container.appendChild(transparentSwatch);

    palette.forEach((hex, i) => {
        const swatch = document.createElement('button');
        swatch.className = 'palette-swatch' + (i === activeIndex ? ' active' : '');
        swatch.style.background = hex;
        swatch.title = hex;
        swatch.addEventListener('click', () => onSelect(i));
        container.appendChild(swatch);
    });
}

export function renderFrameStrip(container, project, currentFrame, onSelect) {
    container.innerHTML = '';
    const cellSize = Math.max(1, Math.floor(44 / Math.max(project.width, project.height)));

    project.frames.forEach((pixels, i) => {
        const thumb = document.createElement('canvas');
        thumb.className = 'frame-thumb' + (i === currentFrame ? ' active' : '');
        drawFrame(thumb, pixels, project.width, project.height, project.palette, cellSize);
        thumb.title = `フレーム ${i + 1}`;
        thumb.addEventListener('click', () => onSelect(i));
        container.appendChild(thumb);
    });
}
