/**
 * ui.js — HUD（ヘッドアップディスプレイ）
 * 高度メーター・タイマー・ゾーン表示・煽りメッセージ管理
 */

import { CONFIG, ZONES, TAUNT_MESSAGES } from './config.js';
import { getZoneIndex } from './level.js';

export class UI {
    constructor() {
        this.tauntMessage = '';
        this.tauntAlpha = 0;
        this.tauntTimer = 0;
        this.zoneName = '';
        this.zoneAlpha = 0;
        this.zoneTimer = 0;
        this.currentZoneIndex = -1;
        this.playTime = 0;
        this.goalReached = false;
        this.goalTimer = 0;
    }

    update(dt, player) {
        this.playTime += dt;
        if (this.tauntTimer > 0) {
            this.tauntTimer -= dt;
            if (this.tauntTimer > 2.5) {
                this.tauntAlpha = Math.min(1, (3 - this.tauntTimer) * 2);
            } else if (this.tauntTimer < 0.5) {
                this.tauntAlpha = this.tauntTimer * 2;
            }
        } else {
            this.tauntAlpha = 0;
        }
        if (this.zoneTimer > 0) {
            this.zoneTimer -= dt;
            if (this.zoneTimer > 1.5) {
                this.zoneAlpha = Math.min(1, (2 - this.zoneTimer) * 2);
            } else if (this.zoneTimer < 0.5) {
                this.zoneAlpha = this.zoneTimer * 2;
            }
        } else {
            this.zoneAlpha = 0;
        }
        const zoneIdx = getZoneIndex(player.pos.y);
        if (zoneIdx !== this.currentZoneIndex) {
            this.currentZoneIndex = zoneIdx;
            this.showZoneName(ZONES[zoneIdx].name);
        }
        if (player.pos.y <= 130 && !this.goalReached) {
            this.goalReached = true;
            this.goalTimer = 5;
        }
        if (this.goalTimer > 0) this.goalTimer -= dt;
    }

    showTaunt() {
        const idx = Math.floor(Math.random() * TAUNT_MESSAGES.length);
        this.tauntMessage = TAUNT_MESSAGES[idx];
        this.tauntTimer = 3;
        this.tauntAlpha = 0;
    }

    showZoneName(name) {
        this.zoneName = name;
        this.zoneTimer = 2;
        this.zoneAlpha = 0;
    }

    draw(ctx, player) {
        this.drawAltimeter(ctx, player);
        this.drawTimer(ctx);
        if (this.goalReached && this.goalTimer > 0) this.drawGoalCelebration(ctx);
    }

    drawAltimeter(ctx, player) {
        const barX = 20, barY = 60, barW = 12;
        const barH = CONFIG.CANVAS_HEIGHT - 120;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(barX, barY, barW, barH);
        const progress = 1 - (player.pos.y - 100) / 4400;
        const currentH = Math.max(0, Math.min(barH, barH * progress));
        const grad = ctx.createLinearGradient(0, barY + barH, 0, barY);
        grad.addColorStop(0, '#4caf50');
        grad.addColorStop(0.5, '#ffc107');
        grad.addColorStop(1, '#f44336');
        ctx.fillStyle = grad;
        ctx.fillRect(barX, barY + barH - currentH, barW, currentH);
        const bestProgress = 1 - (player.highestY - 100) / 4400;
        const bestPosY = barY + barH - barH * bestProgress;
        ctx.fillStyle = '#fff';
        ctx.fillRect(barX - 3, bestPosY - 1, barW + 6, 3);
        const currentPosY = barY + barH - currentH;
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(barX + barW + 8, currentPosY, 4, 0, Math.PI * 2);
        ctx.fill();
        const zoneHeights = [4000, 3300, 2300, 1050];
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        for (const zy of zoneHeights) {
            const zp = 1 - (zy - 100) / 4400;
            const zy2 = barY + barH - barH * zp;
            ctx.beginPath();
            ctx.moveTo(barX, zy2);
            ctx.lineTo(barX + barW, zy2);
            ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.font = '12px "Outfit", sans-serif';
        ctx.textAlign = 'left';
        const meters = Math.floor((4500 - player.pos.y) / 10);
        ctx.fillText(`${meters}m`, barX, barY - 8);
    }

    drawTimer(ctx) {
        const mins = Math.floor(this.playTime / 60);
        const secs = Math.floor(this.playTime % 60);
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '18px "Outfit", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(timeStr, CONFIG.CANVAS_WIDTH - 20, 30);
    }

    drawGoalCelebration(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.goalTimer);
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎉🥳🎊', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT * 0.4);
        ctx.font = 'bold 28px "Outfit", sans-serif';
        ctx.fillStyle = '#ffeb3b';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 10;
        ctx.fillText('CONGRATULATIONS!', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT * 0.55);
        const mins = Math.floor(this.playTime / 60);
        const secs = Math.floor(this.playTime % 60);
        ctx.font = '20px "Outfit", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`クリアタイム: ${mins}分${secs}秒`, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT * 0.65);
        ctx.restore();
    }

    getPlayTime() { return this.playTime; }
    setPlayTime(time) { this.playTime = time; }
}
