/**
 * renderer.js — Canvas描画エンジン
 * 絵文字プレイヤー・地形・背景・パーティクルを描画
 */

import { CONFIG, TERRAIN_EMOJI, ZONES } from './config.js';
import { getZoneIndex } from './level.js';

export function drawBackground(ctx, cameraY, canvasW, canvasH) {
    const centerY = cameraY + canvasH / 2;
    const zoneIdx = getZoneIndex(centerY);
    const zone = ZONES[zoneIdx];

    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, zone.bgTop);
    grad.addColorStop(1, zone.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
}

export function drawPlatforms(ctx, platforms, camera) {
    for (const plat of platforms) {
        if (plat.fallen) continue;
        const screenY = camera.worldToScreen(plat.y);
        const screenX = plat.x + camera.getScreenOffsetX();
        if (screenY > CONFIG.CANVAS_HEIGHT + 50 || screenY + plat.h < -50) continue;
        const shakeX = plat.shakeOffset || 0;
        const emoji = TERRAIN_EMOJI[plat.type] || '🟫';
        const tileSize = plat.h + 8;
        const cols = Math.ceil(plat.w / tileSize);
        ctx.save();
        ctx.font = `${tileSize}px serif`;
        ctx.textBaseline = 'top';
        if (plat.crumbling && plat.crumbleTimer < 0.5) {
            ctx.globalAlpha = Math.max(0.2, plat.crumbleTimer / 0.5);
        }
        for (let c = 0; c < cols; c++) {
            ctx.fillText(emoji, screenX + c * tileSize + shakeX, screenY);
        }
        ctx.restore();
    }
}

export function drawPlayer(ctx, player, camera) {
    const screenX = player.pos.x + camera.getScreenOffsetX();
    const screenY = camera.worldToScreen(player.pos.y);
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(player.angle);
    ctx.scale(player.scaleX, player.scaleY);
    const fontSize = player.radius * 2;
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.emoji, 0, 0);
    ctx.restore();
}

export function drawChargeGauge(ctx, player, camera) {
    if (!player.isCharging) return;
    const screenX = player.pos.x + camera.getScreenOffsetX();
    const screenY = camera.worldToScreen(player.pos.y);
    const ratio = player.getChargeRatio();
    const barW = 50, barH = 6;
    const barX = screenX - barW / 2;
    const barY = screenY - player.radius - 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    let color = ratio < 0.33 ? '#4caf50' : ratio < 0.66 ? '#ffc107' : '#f44336';
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
}

export function drawParticles(ctx, particles, camera) {
    for (const p of particles) {
        const screenX = p.x + camera.getScreenOffsetX();
        const screenY = camera.worldToScreen(p.y);
        ctx.save();
        ctx.globalAlpha = p.alpha;
        if (p.emoji) {
            ctx.font = `${p.size}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.emoji, screenX, screenY);
        } else {
            ctx.fillStyle = p.color || '#8B6914';
            ctx.beginPath();
            ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

export function drawTauntMessage(ctx, message, alpha) {
    if (!message || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 24px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(message, CONFIG.CANVAS_WIDTH / 2 + 2, CONFIG.CANVAS_HEIGHT * 0.75 + 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(message, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT * 0.75);
    ctx.restore();
}

export function drawZoneName(ctx, name, alpha) {
    if (!name || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 36px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(name, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT * 0.3);
    ctx.restore();
}
