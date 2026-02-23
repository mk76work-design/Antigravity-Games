/**
 * level.js — レベルデータ
 * 全5ゾーンの足場配置を定義
 * Y座標は下が大きい（=低い）、上が小さい（=高い）
 */

import { TERRAIN } from './config.js';

/**
 * 足場を生成するヘルパー
 * @param {number} x - 左端X座標
 * @param {number} y - 上端Y座標（ワールド座標・上が小さい）
 * @param {number} w - 幅
 * @param {number} h - 高さ
 * @param {string} type - 地形タイプ
 * @param {number} [angle] - 斜面角度（度）
 */
function plat(x, y, w, h, type = TERRAIN.NORMAL, angle = 0) {
    return { x, y, w, h, type, angle, crumbling: false, fallen: false, crumbleTimer: 0, shakeOffset: 0 };
}

/**
 * 全レベルデータを生成
 * 座標系: Y=4500(地面/スタート) → Y=0(頂上/ゴール)
 */
export function createLevel() {
    const platforms = [];

    // ─── ゾーン1: 🟫 土の丘（チュートリアル）Y: 4500〜4000 ───
    // スタート地点（広い地面）
    platforms.push(plat(0, 4500, 800, 40, TERRAIN.NORMAL));
    // 基本の階段
    platforms.push(plat(100, 4400, 160, 20, TERRAIN.NORMAL));
    platforms.push(plat(350, 4320, 140, 20, TERRAIN.NORMAL));
    platforms.push(plat(550, 4240, 160, 20, TERRAIN.NORMAL));
    platforms.push(plat(300, 4160, 180, 20, TERRAIN.NORMAL));
    platforms.push(plat(80, 4080, 150, 20, TERRAIN.NORMAL));
    // セーフゾーン
    platforms.push(plat(250, 4000, 300, 25, TERRAIN.NORMAL));

    // ─── ゾーン2: 🧊 氷の断崖 Y: 3900〜3300 ───
    platforms.push(plat(450, 3900, 120, 18, TERRAIN.ICE));
    platforms.push(plat(200, 3810, 100, 18, TERRAIN.NORMAL));
    platforms.push(plat(500, 3720, 130, 18, TERRAIN.ICE));
    platforms.push(plat(100, 3630, 110, 18, TERRAIN.ICE));
    platforms.push(plat(350, 3550, 90, 18, TERRAIN.ICE));
    platforms.push(plat(600, 3460, 100, 18, TERRAIN.NORMAL));
    platforms.push(plat(300, 3380, 120, 18, TERRAIN.ICE));
    // セーフゾーン
    platforms.push(plat(150, 3300, 280, 25, TERRAIN.NORMAL));

    // ─── ゾーン3: ☁️ 雲の迷宮 Y: 3200〜2300 ───
    platforms.push(plat(400, 3150, 110, 20, TERRAIN.CLOUD));
    platforms.push(plat(150, 3050, 100, 20, TERRAIN.NORMAL));
    platforms.push(plat(500, 2950, 120, 20, TERRAIN.CLOUD));
    platforms.push(plat(250, 2830, 80, 20, TERRAIN.CLOUD));
    platforms.push(plat(600, 2720, 90, 18, TERRAIN.NORMAL));
    platforms.push(plat(100, 2620, 110, 20, TERRAIN.CLOUD));
    platforms.push(plat(380, 2500, 100, 20, TERRAIN.BOUNCE));
    platforms.push(plat(200, 2400, 80, 18, TERRAIN.CLOUD));
    // セーフゾーン
    platforms.push(plat(300, 2300, 250, 25, TERRAIN.NORMAL));

    // ─── ゾーン4: 📐 鋭角の塔 Y: 2200〜1000 ───
    platforms.push(plat(500, 2150, 100, 18, TERRAIN.SLOPE, 25));
    platforms.push(plat(200, 2060, 80, 18, TERRAIN.NORMAL));
    platforms.push(plat(550, 1960, 90, 18, TERRAIN.SLOPE, -30));
    platforms.push(plat(100, 1870, 70, 18, TERRAIN.CRUMBLE));
    platforms.push(plat(400, 1770, 80, 18, TERRAIN.SLOPE, 35));
    platforms.push(plat(620, 1680, 70, 18, TERRAIN.ICE));
    platforms.push(plat(250, 1580, 60, 18, TERRAIN.SLOPE, -20));
    platforms.push(plat(500, 1470, 80, 18, TERRAIN.CRUMBLE));
    platforms.push(plat(150, 1370, 90, 18, TERRAIN.SLOPE, 40));
    platforms.push(plat(420, 1260, 70, 18, TERRAIN.NORMAL));
    platforms.push(plat(100, 1150, 80, 18, TERRAIN.SLOPE, -25));
    // セーフゾーン
    platforms.push(plat(250, 1050, 200, 25, TERRAIN.NORMAL));

    // ─── ゾーン5: 🌑 頂上の試練 Y: 950〜100 ───
    platforms.push(plat(500, 900, 70, 16, TERRAIN.ICE));
    platforms.push(plat(200, 810, 60, 16, TERRAIN.CLOUD));
    platforms.push(plat(580, 720, 65, 16, TERRAIN.SLOPE, 30));
    platforms.push(plat(100, 630, 55, 16, TERRAIN.CRUMBLE));
    platforms.push(plat(420, 540, 60, 16, TERRAIN.ICE));
    platforms.push(plat(250, 450, 50, 16, TERRAIN.BOUNCE));
    platforms.push(plat(550, 360, 55, 16, TERRAIN.SLOPE, -35));
    platforms.push(plat(150, 270, 50, 16, TERRAIN.ICE));
    platforms.push(plat(400, 190, 60, 16, TERRAIN.CRUMBLE));
    // ゴール台座
    platforms.push(plat(250, 100, 300, 30, TERRAIN.NORMAL));

    return platforms;
}

/**
 * ゾーンインデックスを高度から算出
 * @param {number} worldY - ワールドY座標
 * @returns {number} ゾーンインデックス (0-4)
 */
export function getZoneIndex(worldY) {
    if (worldY >= 4000) return 0; // 土の丘
    if (worldY >= 3300) return 1; // 氷の断崖
    if (worldY >= 2300) return 2; // 雲の迷宮
    if (worldY >= 1050) return 3; // 鋭角の塔
    return 4;                     // 頂上の試練
}

/**
 * ゾーンのセーフゾーンY座標を取得
 * @param {number} zoneIndex - ゾーンインデックス
 * @returns {number} セーフゾーンY座標
 */
export function getZoneCheckpointY(zoneIndex) {
    const checkpoints = [4500, 3300, 2300, 1050, 100];
    return checkpoints[zoneIndex] || 4500;
}
