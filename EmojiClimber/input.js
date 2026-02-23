/**
 * input.js — 入力管理
 * 先行入力バッファ・コヨーテタイム・キー状態を一括管理
 */

import { CONFIG } from './config.js';

/**
 * 先行入力バッファ
 * 着地前の入力を記憶し、着地直後に消費する
 */
class InputBuffer {
    constructor(bufferFrames) {
        this.bufferFrames = bufferFrames;
        this.entries = [];
    }

    /** バッファに入力を記録 */
    record(action) {
        this.entries.push({
            action,
            framesRemaining: this.bufferFrames,
        });
    }

    /** バッファから指定アクションを消費（成功時 true） */
    consume(action) {
        const idx = this.entries.findIndex(e => e.action === action);
        if (idx !== -1) {
            this.entries.splice(idx, 1);
            return true;
        }
        return false;
    }

    /** フレームごとの減衰処理 */
    update() {
        this.entries = this.entries.filter(e => {
            e.framesRemaining--;
            return e.framesRemaining > 0;
        });
    }
}

/**
 * InputManager
 * キー状態・先行入力バッファ・コヨーテタイムを統合管理
 */
export class InputManager {
    constructor() {
        this.keys = {};
        this.prevKeys = {};
        this.buffer = new InputBuffer(CONFIG.INPUT_BUFFER_FRAMES);
        this.coyoteCounter = 0;

        this._onKeyDown = (e) => {
            // ゲームで使うキーのデフォルト動作を抑止
            if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
            this.keys[e.code] = true;
        };
        this._onKeyUp = (e) => {
            this.keys[e.code] = false;
        };
    }

    /** イベントリスナー登録 */
    enable() {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    /** イベントリスナー解除 */
    disable() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    /** キーが現在押されているか */
    isDown(code) {
        return !!this.keys[code];
    }

    /** 今フレームで押された瞬間か */
    wasPressed(code) {
        return !!this.keys[code] && !this.prevKeys[code];
    }

    /** 今フレームで離された瞬間か */
    wasReleased(code) {
        return !this.keys[code] && !!this.prevKeys[code];
    }

    /** 先行入力をバッファに記録 */
    bufferAction(action) {
        this.buffer.record(action);
    }

    /** バッファから消費 */
    consumeBuffered(action) {
        return this.buffer.consume(action);
    }

    /** コヨーテタイムを開始（足場を離れた瞬間に呼ぶ） */
    startCoyoteTime() {
        this.coyoteCounter = CONFIG.COYOTE_FRAMES;
    }

    /** コヨーテタイム中か */
    get isCoyoteActive() {
        return this.coyoteCounter > 0;
    }

    /** フレーム末尾で呼ぶ */
    endFrame() {
        this.prevKeys = { ...this.keys };
        this.buffer.update();
        if (this.coyoteCounter > 0) {
            this.coyoteCounter--;
        }
    }
}
