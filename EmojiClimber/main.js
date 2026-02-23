/**
 * main.js — ゲームループ・初期化・モジュール統合
 * requestAnimationFrame + deltaTime ベース
 */

import { CONFIG } from './config.js';
import { InputManager } from './input.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { createLevel, getZoneIndex, getZoneCheckpointY } from './level.js';
import {
    applyGravity, applyFriction, applyAirResistance,
    checkCollisions, resolveCollision, updateCrumblingPlatforms,
} from './physics.js';
import {
    drawBackground, drawPlatforms, drawPlayer,
    drawChargeGauge, drawParticles, drawTauntMessage, drawZoneName,
} from './renderer.js';
import { UI } from './ui.js';

// ── キャンバス初期化 ──────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.CANVAS_WIDTH;
canvas.height = CONFIG.CANVAS_HEIGHT;

// ── ゲームオブジェクト初期化 ──────────────────────────
const input = new InputManager();
const camera = new Camera(CONFIG.CANVAS_HEIGHT);
const ui = new UI();
let platforms = createLevel();
let player = new Player(400, 4470);
let particles = [];
let fallStartY = 0;
let isFalling = false;
let lastSaveTime = 0;
let highestZone = 0;

function saveProgress() {
    const data = { highestZone, playTime: ui.getPlayTime(), highestY: player.highestY };
    try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data)); } catch (e) { }
}

function loadProgress() {
    try {
        const raw = localStorage.getItem(CONFIG.SAVE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        highestZone = data.highestZone || 0;
        ui.setPlayTime(data.playTime || 0);
        player.highestY = data.highestY || 4500;
        if (highestZone > 0) {
            const checkY = getZoneCheckpointY(highestZone);
            player.pos.y = checkY - 30;
            player.pos.x = 400;
        }
    } catch (e) { }
}

// ── パーティクル生成 ──────────────────────────────────
function spawnLandParticles(x, y, intensity) {
    const count = Math.min(Math.floor(intensity * 8), 12);
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y, vx: (Math.random() - 0.5) * 200 * intensity,
            vy: -Math.random() * 150 * intensity,
            size: 3 + Math.random() * 3, alpha: 1, color: '#8B6914',
            life: 0.5 + Math.random() * 0.3,
        });
    }
}

function spawnJumpParticles(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 20, y: y + 10,
            vx: (Math.random() - 0.5) * 80, vy: Math.random() * 40,
            size: 14, alpha: 0.8, emoji: '🌀', life: 0.4,
        });
    }
}

function spawnRecordParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x, y, vx: (Math.random() - 0.5) * 150,
            vy: -100 - Math.random() * 100,
            size: 16, alpha: 1, emoji: '⭐', life: 0.8 + Math.random() * 0.4,
        });
    }
}

function spawnHardLandParticles(x, y) {
    particles.push({ x, y: y - 10, vx: 0, vy: -30, size: 32, alpha: 1, emoji: '💥', life: 0.5 });
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 300 * dt;
        p.life -= dt;
        p.alpha = Math.max(0, p.life / 0.5);
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// ── メインゲームループ ────────────────────────────────
let lastTime = 0;
let previousRecord = player.highestY;

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    // 入力処理
    let moveDir = 0;
    if (input.isDown('ArrowLeft')) moveDir -= 1;
    if (input.isDown('ArrowRight')) moveDir += 1;

    if (input.wasPressed('Space')) {
        if (player.grounded || input.isCoyoteActive) {
            player.startCharge();
        } else {
            input.bufferAction('jump');
        }
    }

    if (player.isCharging && input.isDown('Space')) {
        player.updateCharge(dt, moveDir);
    }

    if (input.wasReleased('Space') && player.isCharging) {
        player.releaseCharge();
        spawnJumpParticles(player.pos.x, player.pos.y);
    }

    player.move(moveDir, dt);

    // 物理
    if (!player.grounded) applyGravity(player, dt);

    player.pos.x += player.vel.x * dt;
    player.pos.y += player.vel.y * dt;

    // 壁判定
    if (player.pos.x < player.radius) { player.pos.x = player.radius; player.vel.x = 0; }
    if (player.pos.x > CONFIG.CANVAS_WIDTH - player.radius) {
        player.pos.x = CONFIG.CANVAS_WIDTH - player.radius; player.vel.x = 0;
    }

    // 衝突判定
    const wasGrounded = player.grounded;
    player.grounded = false;
    let currentFriction = CONFIG.FRICTION_NORMAL;

    const collisions = checkCollisions(player, platforms);
    for (const col of collisions) {
        const result = resolveCollision(player, col);
        if (result.grounded) {
            if (!wasGrounded) {
                player.land(result.landSpeed);
                camera.triggerFallShake(result.landSpeed);
                const intensity = Math.min(result.landSpeed / 1000, 1);
                spawnLandParticles(player.pos.x, player.pos.y, intensity);
                if (result.landSpeed > 800) spawnHardLandParticles(player.pos.x, player.pos.y);
                if (input.consumeBuffered('jump')) player.startCharge();
                if (isFalling) {
                    const fallDist = player.pos.y - fallStartY;
                    if (fallDist > 300) ui.showTaunt();
                    isFalling = false;
                }
            }
            player.grounded = true;
            currentFriction = result.friction;
        }
        if (result.bounced) player.bounce();
    }

    if (wasGrounded && !player.grounded && !player.isCharging) {
        input.startCoyoteTime();
        player.leavePlatform();
        fallStartY = player.pos.y;
        isFalling = true;
    }

    if (player.grounded) { applyFriction(player, currentFriction); }
    else { applyAirResistance(player); }

    updateCrumblingPlatforms(platforms, dt);
    player.update(dt);

    if (player.pos.y < previousRecord - 50) {
        spawnRecordParticles(player.pos.x, player.pos.y);
        previousRecord = player.pos.y;
    }

    camera.update(player.pos.y, dt);
    ui.update(dt, player);
    updateParticles(dt);

    // セーブ
    const currentZone = getZoneIndex(player.pos.y);
    if (currentZone > highestZone) { highestZone = currentZone; saveProgress(); }
    lastSaveTime += dt;
    if (lastSaveTime > CONFIG.SAVE_INTERVAL) { lastSaveTime = 0; saveProgress(); }

    // 描画
    ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    drawBackground(ctx, camera.y, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    drawPlatforms(ctx, platforms, camera);
    drawParticles(ctx, particles, camera);
    drawPlayer(ctx, player, camera);
    drawChargeGauge(ctx, player, camera);
    drawTauntMessage(ctx, ui.tauntMessage, ui.tauntAlpha);
    drawZoneName(ctx, ui.zoneName, ui.zoneAlpha);
    ui.draw(ctx, player);

    input.endFrame();
    requestAnimationFrame(gameLoop);
}

// ── ゲーム開始 ────────────────────────────────────────
input.enable();
loadProgress();
camera.y = player.pos.y - CONFIG.CANVAS_HEIGHT * 0.4;
previousRecord = player.highestY;
requestAnimationFrame(gameLoop);
