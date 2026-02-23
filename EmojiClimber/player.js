/**
 * player.js — プレイヤーロジック
 * 状態機械・移動・タメジャンプ・表情・スクワッシュ＆ストレッチ
 */

import { CONFIG, EMOTIONS } from './config.js';

// プレイヤー状態
const STATE = {
    IDLE: 'idle',
    RUNNING: 'running',
    CHARGING: 'charging',
    AIRBORNE: 'airborne',
    LANDED: 'landed',
};

export class Player {
    constructor(x, y) {
        this.pos = { x, y };
        this.vel = { x: 0, y: 0 };
        this.radius = CONFIG.PLAYER_RADIUS;

        // 状態機械
        this.state = STATE.IDLE;
        this.grounded = false;
        this.wasGrounded = false;

        // 表情
        this.emoji = EMOTIONS.IDLE;

        // 回転
        this.angle = 0;

        // スクワッシュ＆ストレッチ
        this.scaleX = 1;
        this.scaleY = 1;
        this.targetScaleX = 1;
        this.targetScaleY = 1;

        // タメジャンプ
        this.chargeTime = 0;
        this.isCharging = false;
        this.chargeDirection = 0;

        // 落下記録
        this.lastFallSpeed = 0;
        this.highestY = y;
        this.isNewRecord = false;
        this.recordTimer = 0;

        // 停滞検出
        this.stagnationTimer = 0;
        this.lastPlatformY = y;

        // 着地演出
        this.landTimer = 0;
    }

    /**
     * プレイヤー更新（入力処理はmain.jsから呼ぶ）
     * @param {number} dt - デルタタイム
     */
    update(dt) {
        // 回転: 速度に比例
        this.angle += this.vel.x * dt * 0.5;

        // スケール補間（バネ回復）
        const recovery = 1 - Math.pow(0.001, dt / CONFIG.SQUASH_RECOVERY);
        this.scaleX += (this.targetScaleX - this.scaleX) * recovery;
        this.scaleY += (this.targetScaleY - this.scaleY) * recovery;

        // 新記録タイマー
        if (this.recordTimer > 0) {
            this.recordTimer -= dt;
        }

        // 着地タイマー
        if (this.state === STATE.LANDED) {
            this.landTimer -= dt;
            if (this.landTimer <= 0) {
                this.state = this.vel.x !== 0 ? STATE.RUNNING : STATE.IDLE;
            }
        }

        // 停滞検出
        if (this.grounded) {
            if (Math.abs(this.pos.y - this.lastPlatformY) < 5) {
                this.stagnationTimer += dt;
            } else {
                this.stagnationTimer = 0;
                this.lastPlatformY = this.pos.y;
            }
        } else {
            this.stagnationTimer = 0;
        }

        // 表情更新
        this.updateEmoji();

        // 最高到達地点チェック（Y座標が小さいほど高い）
        if (this.pos.y < this.highestY) {
            this.highestY = this.pos.y;
            this.isNewRecord = true;
            this.recordTimer = 0.5;
        }

        // 落下速度を記録
        if (!this.grounded && this.vel.y > 0) {
            this.lastFallSpeed = this.vel.y;
        }
    }

    /**
     * 横移動（慣性付き）
     * @param {number} direction - -1:左, 0:なし, 1:右
     * @param {number} dt - デルタタイム
     */
    move(direction, dt) {
        if (direction === 0) return;

        const control = this.grounded ? 1.0 : CONFIG.AIR_CONTROL;
        const accel = CONFIG.ACCEL * control * direction * dt;

        this.vel.x += accel;

        // 最大速度クランプ
        if (this.vel.x > CONFIG.MAX_SPEED_X) this.vel.x = CONFIG.MAX_SPEED_X;
        if (this.vel.x < -CONFIG.MAX_SPEED_X) this.vel.x = -CONFIG.MAX_SPEED_X;

        if (this.grounded && this.state !== STATE.CHARGING) {
            this.state = STATE.RUNNING;
        }

        // 高速移動時のストレッチ
        const speedRatio = Math.abs(this.vel.x) / CONFIG.MAX_SPEED_X;
        if (speedRatio > 0.5) {
            this.targetScaleX = 1 + (speedRatio - 0.5) * 0.3;
            this.targetScaleY = 1 - (speedRatio - 0.5) * 0.1;
        }
    }

    /** タメジャンプ開始 */
    startCharge() {
        if (!this.grounded && !this.isCharging) return false;
        this.isCharging = true;
        this.chargeTime = 0;
        this.state = STATE.CHARGING;
        return true;
    }

    /**
     * タメジャンプ蓄積
     * @param {number} dt - デルタタイム（秒）
     * @param {number} direction - 方向キー入力
     */
    updateCharge(dt, direction) {
        if (!this.isCharging) return;

        this.chargeTime += dt * 1000; // msに変換
        if (this.chargeTime > CONFIG.JUMP_CHARGE_MAX) {
            this.chargeTime = CONFIG.JUMP_CHARGE_MAX;
        }

        this.chargeDirection = direction;

        // タメ中のスクワッシュ（縮む）
        const ratio = this.chargeTime / CONFIG.JUMP_CHARGE_MAX;
        this.targetScaleX = 1 + ratio * 0.25;
        this.targetScaleY = 1 - ratio * 0.3;
    }

    /** タメジャンプ発射（Space離した瞬間） */
    releaseCharge() {
        if (!this.isCharging) return;

        const ratio = Math.min(this.chargeTime / CONFIG.JUMP_CHARGE_MAX, 1);

        // ジャンプ速度を線形補間
        const jumpVY = CONFIG.JUMP_MIN_VY + (CONFIG.JUMP_MAX_VY - CONFIG.JUMP_MIN_VY) * ratio;

        // 斜めジャンプ: 方向キーで横速度を付与
        if (this.chargeDirection !== 0) {
            const angleRad = (CONFIG.JUMP_ANGLE_MAX * ratio * Math.PI) / 180;
            this.vel.x = Math.sin(angleRad) * Math.abs(jumpVY) * this.chargeDirection;
            this.vel.y = jumpVY * Math.cos(angleRad);
        } else {
            this.vel.y = jumpVY;
        }

        // ジャンプ時のストレッチ（縦に伸びる）
        this.targetScaleX = 0.7;
        this.targetScaleY = CONFIG.STRETCH_FACTOR;

        this.isCharging = false;
        this.chargeTime = 0;
        this.grounded = false;
        this.state = STATE.AIRBORNE;
    }

    /** タメ率を取得（0〜1） */
    getChargeRatio() {
        return Math.min(this.chargeTime / CONFIG.JUMP_CHARGE_MAX, 1);
    }

    /**
     * 着地処理
     * @param {number} fallSpeed - 着地時の落下速度
     */
    land(fallSpeed) {
        this.grounded = true;
        this.state = STATE.LANDED;
        this.landTimer = 0.1;

        // スクワッシュ: 落下速度に比例して潰れる
        const squash = Math.min(fallSpeed / 1500, CONFIG.SQUASH_FACTOR);
        this.scaleX = 1 + squash;
        this.scaleY = 1 - squash;
        this.targetScaleX = 1;
        this.targetScaleY = 1;
    }

    /** バウンス処理（雲/バウンド台） */
    bounce() {
        this.state = STATE.AIRBORNE;
        this.grounded = false;

        // バウンス時のストレッチ
        this.targetScaleX = 0.8;
        this.targetScaleY = 1.2;
    }

    /** 表情を状態に応じて更新 */
    updateEmoji() {
        // 新記録時は最優先
        if (this.recordTimer > 0) {
            this.emoji = EMOTIONS.RECORD;
            return;
        }

        switch (this.state) {
            case STATE.CHARGING: {
                const ratio = this.getChargeRatio();
                this.emoji = ratio >= 0.6 ? EMOTIONS.CHARGE_HIGH : EMOTIONS.CHARGE_LOW;
                break;
            }
            case STATE.AIRBORNE:
                if (this.vel.y < -200) {
                    this.emoji = EMOTIONS.RISING;
                } else if (this.vel.y > 300) {
                    this.emoji = EMOTIONS.FALLING;
                }
                break;
            case STATE.LANDED:
                this.emoji = this.lastFallSpeed > 800 ? EMOTIONS.LAND_HARD : EMOTIONS.LAND_SOFT;
                break;
            case STATE.IDLE:
            case STATE.RUNNING:
                if (this.stagnationTimer > 15) {
                    this.emoji = EMOTIONS.BORED;
                } else {
                    this.emoji = EMOTIONS.IDLE;
                }
                break;
        }
    }

    /** 足場を離れた時の処理 */
    leavePlatform() {
        if (this.grounded) {
            this.wasGrounded = true;
            this.grounded = false;
            if (this.state !== STATE.CHARGING) {
                this.state = STATE.AIRBORNE;
            }
        }
    }
}
