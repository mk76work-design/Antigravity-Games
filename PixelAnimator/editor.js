// editor.js — ペンシル / 消しゴム / スポイト / バケツによるピクセル編集

import { drawFrame } from './renderer.js';

export class PixelEditor {
    constructor(canvas, store) {
        this.canvas = canvas;
        this.store = store;
        this.tool = 'pencil';
        this.activeColor = 1;
        this.cellSize = 16;
        this.drawing = false;
        this.onColorPicked = null;

        canvas.addEventListener('pointerdown', this.handlePointerDown);
        canvas.addEventListener('pointermove', this.handlePointerMove);
        window.addEventListener('pointerup', this.handlePointerUp);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setTool(tool) {
        this.tool = tool;
    }

    setColor(index) {
        this.activeColor = index;
    }

    setCellSize(size) {
        this.cellSize = size;
        this.redraw();
    }

    redraw() {
        const p = this.store.project;
        drawFrame(this.canvas, this.store.getPixels(), p.width, p.height, p.palette, this.cellSize);
        if (this.cellSize >= 8) this.drawGrid(p.width, p.height);
    }

    drawGrid(width, height) {
        const ctx = this.canvas.getContext('2d');
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.cellSize + 0.5, 0);
            ctx.lineTo(x * this.cellSize + 0.5, height * this.cellSize);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * this.cellSize + 0.5);
            ctx.lineTo(width * this.cellSize, y * this.cellSize + 0.5);
            ctx.stroke();
        }
    }

    cellFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const px = (e.clientX - rect.left) * scaleX;
        const py = (e.clientY - rect.top) * scaleY;
        const x = Math.floor(px / this.cellSize);
        const y = Math.floor(py / this.cellSize);
        const { width, height } = this.store.project;
        if (x < 0 || y < 0 || x >= width || y >= height) return null;
        return { x, y, index: y * width + x };
    }

    handlePointerDown = (e) => {
        const cell = this.cellFromEvent(e);
        if (!cell) return;
        this.drawing = true;

        if (this.tool === 'eyedropper') {
            const value = this.store.getPixels()[cell.index];
            this.activeColor = value;
            if (this.onColorPicked) this.onColorPicked(value);
            this.drawing = false;
            return;
        }

        this.store.snapshotBeforeEdit();

        if (this.tool === 'bucket') {
            this.floodFill(cell.index);
            this.store.commitEdit();
            this.drawing = false;
            return;
        }

        this.applyBrush(cell, e);
        this.redraw();
    };

    handlePointerMove = (e) => {
        if (!this.drawing) return;
        if (this.tool !== 'pencil' && this.tool !== 'eraser') return;
        const cell = this.cellFromEvent(e);
        if (!cell) return;
        this.applyBrush(cell, e);
        this.redraw();
    };

    handlePointerUp = () => {
        if (!this.drawing) return;
        this.drawing = false;
        if (this.tool === 'pencil' || this.tool === 'eraser') {
            this.store.commitEdit();
        }
    };

    applyBrush(cell, e) {
        const isRightClick = e.buttons === 2;
        const value = this.tool === 'eraser' || isRightClick ? -1 : this.activeColor;
        this.store.setPixel(cell.index, value);
    }

    floodFill(startIndex) {
        const { width, height } = this.store.project;
        const pixels = this.store.getPixels();
        const target = pixels[startIndex];
        const replacement = this.activeColor;
        if (target === replacement) return;

        const stack = [startIndex];
        const visited = new Uint8Array(width * height);

        while (stack.length) {
            const idx = stack.pop();
            if (visited[idx]) continue;
            visited[idx] = 1;
            if (pixels[idx] !== target) continue;
            pixels[idx] = replacement;

            const x = idx % width;
            const y = Math.floor(idx / width);
            if (x > 0) stack.push(idx - 1);
            if (x < width - 1) stack.push(idx + 1);
            if (y > 0) stack.push(idx - width);
            if (y < height - 1) stack.push(idx + width);
        }
    }
}
