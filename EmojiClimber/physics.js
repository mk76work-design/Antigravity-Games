/**
 * physics.js — カスタム物理エンジン
 * AABB衝突判定・重力・摩擦・斜面・特殊地形を処理
 */

import { CONFIG, TERRAIN, TERRAIN_FRICTION } from './config.js';

/**
 * 重力を適用
 * @param {object} entity - vel.y を持つエンティティ
 * @param {number} dt - デルタタイム（秒）
 */
export function applyGravity(entity, dt) {
    entity.vel.y += CONFIG.GRAVITY * dt;
    // 終端速度でクランプ
    if (entity.vel.y > CONFIG.TERMINAL_VELOCITY) {
        entity.vel.y = CONFIG.TERMINAL_VELOCITY;
    }
}

/**
 * 摩擦を適用
 * @param {object} entity - vel.x を持つエンティティ
 * @param {number} friction - 摩擦係数（1 に近いほど滑る）
 */
export function applyFriction(entity, friction) {
    entity.vel.x *= friction;
    // 微小速度をゼロにスナップ
    if (Math.abs(entity.vel.x) < 1) {
        entity.vel.x = 0;
    }
}

/**
 * 空気抵抗を適用
 * @param {object} entity - vel.x を持つエンティティ
 */
export function applyAirResistance(entity) {
    entity.vel.x *= CONFIG.AIR_RESISTANCE;
}

/**
 * AABB衝突判定 — プレイヤー（円近似の矩形）と足場
 * @param {object} entity - { pos, vel, radius }
 * @param {Array} platforms - 足場配列
 * @returns {Array} 衝突結果の配列
 */
export function checkCollisions(entity, platforms) {
    const results = [];
    const r = entity.radius;

    // プレイヤーのAABB
    const eLeft = entity.pos.x - r;
    const eRight = entity.pos.x + r;
    const eTop = entity.pos.y - r;
    const eBottom = entity.pos.y + r;

    for (const plat of platforms) {
        // 非アクティブな足場（崩壊済み）をスキップ
        if (plat.fallen) continue;

        const pLeft = plat.x;
        const pRight = plat.x + plat.w;
        const pTop = plat.y;
        const pBottom = plat.y + plat.h;

        // AABB オーバーラップ判定
        if (eRight <= pLeft || eLeft >= pRight ||
            eBottom <= pTop || eTop >= pBottom) {
            continue;
        }

        // めり込み量を計算（各方向）
        const overlapLeft = eRight - pLeft;
        const overlapRight = pRight - eLeft;
        const overlapTop = eBottom - pTop;
        const overlapBottom = pBottom - eTop;

        // 最小めり込み方向を採用
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        let normalX = 0;
        let normalY = 0;

        if (minOverlap === overlapTop) {
            normalY = -1; // 上面に衝突（着地）
        } else if (minOverlap === overlapBottom) {
            normalY = 1;  // 下面に衝突（頭ぶつけ）
        } else if (minOverlap === overlapLeft) {
            normalX = -1; // 左面に衝突
        } else {
            normalX = 1;  // 右面に衝突
        }

        results.push({
            platform: plat,
            overlap: minOverlap,
            normalX,
            normalY,
        });
    }
    return results;
}

/**
 * 衝突を解決
 * @param {object} entity - プレイヤー
 * @param {object} collision - checkCollisions の結果
 * @returns {object} { grounded, friction, bounced, landSpeed }
 */
export function resolveCollision(entity, collision) {
    const { platform, overlap, normalX, normalY } = collision;
    const type = platform.type || TERRAIN.NORMAL;
    let grounded = false;
    let bounced = false;
    let landSpeed = 0;
    let friction = TERRAIN_FRICTION[type] || CONFIG.FRICTION_NORMAL;

    // めり込み解消
    entity.pos.x += normalX * overlap;
    entity.pos.y += normalY * overlap;

    // 上面に着地
    if (normalY === -1) {
        landSpeed = entity.vel.y;

        // 雲（トランポリン）
        if (type === TERRAIN.CLOUD) {
            entity.vel.y *= -0.7;
            bounced = true;
            return { grounded: false, friction, bounced, landSpeed };
        }

        // バウンド台
        if (type === TERRAIN.BOUNCE) {
            entity.vel.y *= -1.5;
            bounced = true;
            return { grounded: false, friction, bounced, landSpeed };
        }

        // 通常着地
        entity.vel.y = 0;
        grounded = true;

        // 崩れる足場のタイマー開始
        if (type === TERRAIN.CRUMBLE && !platform.crumbling) {
            platform.crumbling = true;
            platform.crumbleTimer = CONFIG.CRUMBLE_DELAY;
        }

        // 斜面: 重力の斜面成分でドリフト
        if (type === TERRAIN.SLOPE && platform.angle) {
            const rad = (platform.angle * Math.PI) / 180;
            const slopeForce = CONFIG.GRAVITY * Math.sin(rad) * 0.02;
            entity.vel.x += slopeForce;
        }
    }

    // 下面にぶつかった（頭ゴッツン）
    if (normalY === 1) {
        entity.vel.y = Math.max(entity.vel.y, 0);
    }

    // 横面にぶつかった
    if (normalX !== 0) {
        entity.vel.x = 0;
    }

    return { grounded, friction, bounced, landSpeed };
}

/**
 * 崩れる足場を更新
 * @param {Array} platforms - 足場配列
 * @param {number} dt - デルタタイム
 */
export function updateCrumblingPlatforms(platforms, dt) {
    for (const plat of platforms) {
        if (!plat.crumbling) continue;

        plat.crumbleTimer -= dt;

        // 予兆: 残り時間が短くなったら震える
        if (plat.crumbleTimer > 0) {
            plat.shakeOffset = plat.crumbleTimer < 0.5
                ? (Math.random() - 0.5) * 4
                : 0;
        } else {
            // 崩壊: 足場を落下させる
            plat.fallen = true;
        }
    }
}
