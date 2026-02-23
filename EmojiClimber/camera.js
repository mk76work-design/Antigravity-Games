/**
 * camera.js — カメラ追従
 * Lerp追従・画面振動（減衰付き）・最高到達地点記録
 */

import { CONFIG } from './config.js';

export class Camera {
    constructor(canvasHeight) {
        this.y = 0;
        this.targetY = 0;
        this.canvasHeight = canvasHeight;
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeElapsed = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.highestY = 0;
    }

    /**
     * カメラ位置を更新
     * @param {number} playerY - プレイヤーのY座標（上が大きい＝高い）
     * @param {number} dt - デルタタイム
     */
    update(playerY, dt) {
        // プレイヤーをやや下寄り（40%地点）に配置
        this.targetY = playerY - this.canvasHeight * 0.4;

        // Lerp追従
        this.y += (this.targetY - this.y) * CONFIG.CAMERA_LERP;

        // 画面振動の更新
        this.updateShake();

        // 最高到達地点の更新（Y座標が小さいほど高い）
        if (playerY < this.highestY) {
            this.highestY = playerY;
        }
    }

    /**
     * 画面振動をトリガー（桜井氏: 減衰付き振動）
     * @param {number} intensity - 振動強さ（ピクセル）
     * @param {number} duration - 持続フレーム数
     */
    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeElapsed = 0;
    }

    /** 振動オフセットを計算（減衰曲線） */
    updateShake() {
        if (this.shakeElapsed >= this.shakeDuration) {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
            return;
        }
        this.shakeElapsed++;

        // 減衰率: 最初は強く、徐々に弱く
        const decay = 1 - (this.shakeElapsed / this.shakeDuration);
        const power = this.shakeIntensity * decay;

        this.shakeOffsetX = (Math.random() - 0.5) * 2 * power;
        this.shakeOffsetY = (Math.random() - 0.5) * 2 * power;
    }

    /**
     * ワールド座標をスクリーン座標に変換
     * @param {number} worldY - ワールドY座標
     * @returns {number} スクリーンY座標
     */
    worldToScreen(worldY) {
        return worldY - this.y + this.shakeOffsetY;
    }

    /** スクリーンX座標（振動のみ） */
    getScreenOffsetX() {
        return this.shakeOffsetX;
    }

    /**
     * 落下速度に応じて振動をトリガー
     * @param {number} fallSpeed - 落下速度（正の値）
     */
    triggerFallShake(fallSpeed) {
        if (fallSpeed > CONFIG.SHAKE_THRESHOLD) {
            const ratio = Math.min((fallSpeed - CONFIG.SHAKE_THRESHOLD) / 800, 1);
            const intensity = CONFIG.SHAKE_INTENSITY * ratio;
            this.shake(intensity, CONFIG.SHAKE_DURATION);
        }
    }
}
