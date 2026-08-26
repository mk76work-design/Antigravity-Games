// state.js — プロジェクトの状態管理と Undo/Redo 履歴

const HISTORY_LIMIT = 60;

export function createEmptyProject({ width, height, frameCount, fps = 8, loopMode = 'loop' }) {
    const frames = [];
    for (let i = 0; i < frameCount; i++) {
        frames.push(new Array(width * height).fill(-1));
    }
    return {
        width,
        height,
        fps,
        loopMode,
        palette: ['#ffffff', '#000000'],
        frames,
    };
}

export class ProjectStore {
    constructor(project) {
        this.project = project;
        this.currentFrame = 0;
        this.undoStack = [];
        this.redoStack = [];
        this.listeners = new Set();
    }

    onChange(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    emit() {
        for (const fn of this.listeners) fn(this.project);
    }

    replaceProject(project, frameIndex = 0) {
        this.project = project;
        this.currentFrame = Math.min(frameIndex, project.frames.length - 1);
        this.undoStack = [];
        this.redoStack = [];
        this.emit();
    }

    getPixels(frameIndex = this.currentFrame) {
        return this.project.frames[frameIndex];
    }

    // 1ストロークの前にスナップショットを保存する
    snapshotBeforeEdit() {
        const snap = this.project.frames[this.currentFrame].slice();
        this.undoStack.push({ frame: this.currentFrame, pixels: snap });
        if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
        this.redoStack = [];
    }

    setPixel(index, value) {
        this.project.frames[this.currentFrame][index] = value;
    }

    commitEdit() {
        this.emit();
    }

    undo() {
        const entry = this.undoStack.pop();
        if (!entry) return false;
        const current = this.project.frames[entry.frame].slice();
        this.redoStack.push({ frame: entry.frame, pixels: current });
        this.project.frames[entry.frame] = entry.pixels;
        this.currentFrame = entry.frame;
        this.emit();
        return true;
    }

    redo() {
        const entry = this.redoStack.pop();
        if (!entry) return false;
        const current = this.project.frames[entry.frame].slice();
        this.undoStack.push({ frame: entry.frame, pixels: current });
        this.project.frames[entry.frame] = entry.pixels;
        this.currentFrame = entry.frame;
        this.emit();
        return true;
    }

    addPaletteColor(hex) {
        if (!this.project.palette.includes(hex)) {
            this.project.palette.push(hex);
        }
        return this.project.palette.indexOf(hex);
    }

    duplicateFrame(index) {
        const copy = this.project.frames[index].slice();
        this.project.frames.splice(index + 1, 0, copy);
        this.currentFrame = index + 1;
        this.emit();
    }

    deleteFrame(index) {
        if (this.project.frames.length <= 1) return;
        this.project.frames.splice(index, 1);
        this.currentFrame = Math.max(0, Math.min(this.currentFrame, this.project.frames.length - 1));
        this.emit();
    }

    replaceFrame(index, pixels) {
        this.project.frames[index] = pixels;
        this.emit();
    }
}
