/**
 * config.js — 全物理定数・ゲーム設定
 * チューニングはすべてここで行う
 */

export const CONFIG = {
    // ── キャンバス ─────────────────────────────────
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLAYER_RADIUS: 28,

    // ── 重力 ─────────────────────────────────────────
    GRAVITY: 2400,
    TERMINAL_VELOCITY: 1800,

    // ── 移動 ─────────────────────────────────────────
    ACCEL: 800,
    MAX_SPEED_X: 400,
    AIR_CONTROL: 0.4,

    // ── 摩擦（地形別） ────────────────────────────────
    FRICTION_NORMAL: 0.85,
    FRICTION_ICE: 0.98,
    FRICTION_SLOPE: 0.90,
    AIR_RESISTANCE: 0.98,

    // ── タメジャンプ ───────────────────────────────────
    JUMP_MIN_VY: -400,
    JUMP_MAX_VY: -1200,
    JUMP_CHARGE_MAX: 600,
    JUMP_ANGLE_MAX: 60,

    // ── ゲームフィール ─────────────────────────────────
    COYOTE_FRAMES: 4,
    INPUT_BUFFER_FRAMES: 6,

    // ── スクワッシュ＆ストレッチ ───────────────────────
    SQUASH_FACTOR: 0.5,
    STRETCH_FACTOR: 1.3,
    SQUASH_RECOVERY: 0.15,

    // ── カメラ ────────────────────────────────────────
    CAMERA_LERP: 0.08,
    SHAKE_THRESHOLD: 800,
    SHAKE_INTENSITY: 12,
    SHAKE_DURATION: 15,

    // ── 崩れる足場 ────────────────────────────────────
    CRUMBLE_DELAY: 1.5,
    CRUMBLE_SHAKE_FRAMES: 30,

    // ── 進捗セーブ ────────────────────────────────────
    SAVE_KEY: 'emoji_climber_save',
    SAVE_INTERVAL: 10,
};

// ── 地形タイプ定義 ────────────────────────────────────
export const TERRAIN = {
    NORMAL: 'normal',
    ICE: 'ice',
    CLOUD: 'cloud',
    SLOPE: 'slope',
    BOUNCE: 'bounce',
    CRUMBLE: 'crumble',
};

// ── 地形絵文字マッピング ──────────────────────────────
export const TERRAIN_EMOJI = {
    [TERRAIN.NORMAL]: '🟫',
    [TERRAIN.ICE]: '🧊',
    [TERRAIN.CLOUD]: '☁️',
    [TERRAIN.SLOPE]: '📐',
    [TERRAIN.BOUNCE]: '🍄',
    [TERRAIN.CRUMBLE]: '🧱',
};

// ── 地形別摩擦マッピング ──────────────────────────────
export const TERRAIN_FRICTION = {
    [TERRAIN.NORMAL]: CONFIG.FRICTION_NORMAL,
    [TERRAIN.ICE]: CONFIG.FRICTION_ICE,
    [TERRAIN.SLOPE]: CONFIG.FRICTION_SLOPE,
    [TERRAIN.CLOUD]: CONFIG.FRICTION_NORMAL,
    [TERRAIN.BOUNCE]: CONFIG.FRICTION_NORMAL,
    [TERRAIN.CRUMBLE]: CONFIG.FRICTION_NORMAL,
};

// ── プレイヤー表情定義 ────────────────────────────────
export const EMOTIONS = {
    IDLE: '🥺',
    CHARGE_LOW: '😤',
    CHARGE_HIGH: '😬',
    RISING: '🤩',
    FALLING: '😱',
    LAND_SOFT: '😮\u200D💨',
    LAND_HARD: '💀',
    RECORD: '🥳',
    BORED: '😐',
};

// ── 煽りメッセージ ────────────────────────────────────
export const TAUNT_MESSAGES = [
    'また最初からですね',
    '惜しかった（本当に？）',
    '物理は嘘をつかない',
    'キーボードは悪くない',
    'もう一回？（どうせやるでしょ）',
    '上には上がある（文字通り）',
    '重力には勝てない',
    '練習あるのみ',
];

// ── ゾーン定義 ─────────────────────────────────────
export const ZONES = [
    { name: '🟫 土の丘', startY: 0, endY: 500, bgTop: '#4a7c2e', bgBottom: '#2d5016' },
    { name: '🧊 氷の断崖', startY: 500, endY: 1200, bgTop: '#4a8fa8', bgBottom: '#1a3a4a' },
    { name: '☁️ 雲の迷宮', startY: 1200, endY: 2200, bgTop: '#f5f5f5', bgBottom: '#e8e8e8' },
    { name: '📐 鋭角の塔', startY: 2200, endY: 3500, bgTop: '#e89030', bgBottom: '#c94c10' },
    { name: '🌑 頂上の試練', startY: 3500, endY: 4500, bgTop: '#1a1a4e', bgBottom: '#0a0a2e' },
];
