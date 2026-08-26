// animator.js — 再生キャンバス上でのアニメーション再生ループ

import { drawFrame } from './renderer.js';

export class Animator {
    constructor(canvas) {
        this.canvas = canvas;
        this.project = null;
        this.playing = false;
        this.frameIndex = 0;
        this.direction = 1;
        this.lastTime = 0;
        this.rafId = null;
        this.onFrameChange = null;
    }

    setProject(project) {
        this.project = project;
        this.frameIndex = Math.min(this.frameIndex, project.frames.length - 1);
        this.direction = 1;
        this.renderCurrent();
    }

    renderCurrent() {
        if (!this.project) return;
        const cellSize = Math.max(1, Math.floor(128 / Math.max(this.project.width, this.project.height)));
        drawFrame(this.canvas, this.project.frames[this.frameIndex], this.project.width, this.project.height, this.project.palette, cellSize);
    }

    play() {
        if (this.playing || !this.project) return;
        this.playing = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    pause() {
        this.playing = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    toggle() {
        if (this.playing) this.pause();
        else this.play();
        return this.playing;
    }

    loop = (now) => {
        if (!this.playing || !this.project) return;
        const frameDuration = 1000 / Math.max(1, this.project.fps);
        if (now - this.lastTime >= frameDuration) {
            this.lastTime = now;
            this.advance();
        }
        this.renderCurrent();
        this.rafId = requestAnimationFrame(this.loop);
    };

    advance() {
        const count = this.project.frames.length;
        if (this.project.loopMode === 'once') {
            if (this.frameIndex < count - 1) this.frameIndex++;
            else this.pause();
        } else if (this.project.loopMode === 'pingpong') {
            this.frameIndex += this.direction;
            if (this.frameIndex >= count - 1) {
                this.frameIndex = count - 1;
                this.direction = -1;
            } else if (this.frameIndex <= 0) {
                this.frameIndex = 0;
                this.direction = 1;
            }
        } else {
            this.frameIndex = (this.frameIndex + 1) % count;
        }
        if (this.onFrameChange) this.onFrameChange(this.frameIndex);
    }
}
