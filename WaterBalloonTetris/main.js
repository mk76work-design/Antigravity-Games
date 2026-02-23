import { COLS, ROWS, BLOCK_SIZE, SHAPES, COLORS, STATE } from './constants.js';

const PHASE = {
    PLAYING: 'playing',
    BURSTING: 'bursting',
    SETTLING: 'settling'
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = COLS * BLOCK_SIZE;
        this.canvas.height = ROWS * BLOCK_SIZE;

        this.grid = [];
        for (let r = 0; r < ROWS; r++) this.grid.push(new Array(COLS).fill(0));

        this.particles = [];
        this.score = 0;
        this.lines = 0;
        this.phase = PHASE.PLAYING;
        this.gameRunning = true;

        // Flood
        this.waterLevel = 0;
        this.targetWaterLevel = 0;

        // 排水弁アニメーション
        this.valveOpen = 0;   // 0～1 (開度)
        this.valveTimer = 0;   // 弁が開いている残り時間(ms)

        // Piece
        this.piece = null;
        this.nextPiece = null;
        this.dropCounter = 0;
        this.dropInterval = 1000;

        // Burst
        this.burstFragments = [];
        this.burstTickTimer = 0;
        this.burstTickInterval = 60;

        // Sakurai Feel
        this.hitStopTimer = 0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.flashAlpha = 0;

        // Time
        this.lastTime = 0;

        // Boot
        this.spawnPiece();
        this.bindEvents();
        requestAnimationFrame(t => { this.lastTime = t; this.loop(t); });
    }

    /* ===== ユーティリティ ===== */
    copyShape(s) { return s.map(r => [...r]); }

    /* ===== ピース生成 ===== */
    spawnPiece() {
        const types = 'IJLOSTZ';
        if (!this.nextPiece) {
            const t = types[Math.floor(Math.random() * types.length)];
            this.nextPiece = { shape: this.copyShape(SHAPES[t]), type: t };
        }
        this.piece = {
            pos: { x: Math.floor(COLS / 2) - Math.floor(this.nextPiece.shape[0].length / 2), y: 0 },
            shape: this.copyShape(this.nextPiece.shape),
            type: this.nextPiece.type
        };
        const nt = types[Math.floor(Math.random() * types.length)];
        this.nextPiece = { shape: this.copyShape(SHAPES[nt]), type: nt };
        this.drawNextPiece();

        if (this.checkCollision(this.piece.shape, this.piece.pos)) {
            this.doGameOver();
        }
    }

    doGameOver() {
        this.gameRunning = false;
        setTimeout(() => {
            alert('GAME OVER!  Score: ' + this.score);
            for (let r = 0; r < ROWS; r++) this.grid[r].fill(0);
            this.waterLevel = 0;
            this.targetWaterLevel = 0;
            this.score = 0;
            this.lines = 0;
            this.phase = PHASE.PLAYING;
            this.gameRunning = true;
            this.spawnPiece();
        }, 100);
    }

    /* ===== 衝突判定 ===== */
    checkCollision(shape, pos) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x] === 0) continue;
                const ny = y + pos.y, nx = x + pos.x;
                if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
                if (ny < 0) continue;
                if (this.grid[ny][nx] !== 0) return true;
                // 浮力
                if (this.targetWaterLevel >= 1) {
                    if (ny >= ROWS - Math.floor(this.targetWaterLevel)) return true;
                }
            }
        }
        return false;
    }

    /* ===== 操作 ===== */
    moveX(dir) {
        if (this.phase !== PHASE.PLAYING || !this.gameRunning) return;
        this.piece.pos.x += dir;
        if (this.checkCollision(this.piece.shape, this.piece.pos)) this.piece.pos.x -= dir;
    }

    softDrop() {
        if (this.phase !== PHASE.PLAYING || !this.gameRunning) return;
        this.piece.pos.y++;
        if (this.checkCollision(this.piece.shape, this.piece.pos)) {
            this.piece.pos.y--;
            this.lockPiece();
        }
        this.dropCounter = 0;
    }

    rotate(dir) {
        if (this.phase !== PHASE.PLAYING || !this.gameRunning) return;
        const old = this.piece.shape, oldX = this.piece.pos.x;
        this.piece.shape = dir > 0 ? this.rotateCW(old) : this.rotateCCW(old);
        let off = 1;
        while (this.checkCollision(this.piece.shape, this.piece.pos)) {
            this.piece.pos.x += off;
            off = -(off + (off > 0 ? 1 : -1));
            if (Math.abs(off) > this.piece.shape[0].length + 2) {
                this.piece.shape = old; this.piece.pos.x = oldX; return;
            }
        }
    }

    rotateCW(m) {
        const o = [];
        for (let c = 0; c < m[0].length; c++) {
            o.push([]);
            for (let r = m.length - 1; r >= 0; r--) o[c].push(m[r][c]);
        }
        return o;
    }
    rotateCCW(m) {
        const o = [];
        for (let c = m[0].length - 1; c >= 0; c--) {
            o.push([]);
            for (let r = 0; r < m.length; r++) o[m[0].length - 1 - c].push(m[r][c]);
        }
        return o;
    }

    /* ===== ピース固定 ===== */
    lockPiece() {
        for (let y = 0; y < this.piece.shape.length; y++) {
            for (let x = 0; x < this.piece.shape[y].length; x++) {
                if (this.piece.shape[y][x] === 0) continue;
                const ny = y + this.piece.pos.y, nx = x + this.piece.pos.x;
                if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
                    this.grid[ny][nx] = { type: this.piece.type, state: STATE.BALLOONED };
                }
            }
        }
        this.clearLines();
        if (this.phase === PHASE.PLAYING) this.spawnPiece();
    }

    /* ===== ライン消去（排水ブロック方式） ===== */
    clearLines() {
        const cleared = [];
        let drainCount = 0; // 消去した排水ブロックの数

        for (let y = ROWS - 1; y >= 0; y--) {
            let full = true;
            for (let x = 0; x < COLS; x++) {
                if (this.grid[y][x] === 0) { full = false; break; }
            }
            if (full) {
                // 排水ブロックが含まれているかチェック
                for (let x = 0; x < COLS; x++) {
                    if (this.grid[y][x].state === STATE.DRAIN) drainCount++;
                }
                cleared.push(y);
            }
        }
        if (cleared.length === 0) return;

        // ---- 水位変動 ----
        // 排水ブロックを消した分だけ水位が下がる
        if (drainCount > 0) {
            this.targetWaterLevel = Math.max(0, this.targetWaterLevel - drainCount);
            // 排水弁アニメーション開始
            this.valveTimer = 800;
        }
        // 常に水位上昇（排水ブロックの有無に関わらず消去で上がる）
        this.targetWaterLevel = Math.min(ROWS - 2, this.targetWaterLevel + cleared.length * 0.8);

        this.score += cleared.length * 100 + drainCount * 200;
        this.lines += cleared.length;

        // 演出
        this.hitStopTimer = 120;
        this.shakeTimer = 250;
        this.shakeIntensity = cleared.length * 7;
        this.flashAlpha = 0.6;

        // パーティクル生成 & 行消去
        for (const y of cleared) {
            for (let x = 0; x < COLS; x++) {
                const c = this.grid[y][x];
                if (c) {
                    const col = c.state === STATE.DRAIN ? COLORS.DRAIN : (COLORS[c.type] || '#caf0f8');
                    this.addBurstParticles(x, y, col, c.state === STATE.DRAIN);
                }
                this.grid[y][x] = 0;
            }
        }

        // ---- 排水ブロック生成（全消しでなければ） ----
        const hasBlocksLeft = this.grid.some(row => row.some(c => c !== 0));
        if (hasBlocksLeft) {
            // 盤面上の BALLOONED ブロックをランダムに1つ選んで DRAIN に変換
            const candidates = [];
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const c = this.grid[y][x];
                    if (c && c.state === STATE.BALLOONED) candidates.push({ x, y });
                }
            }
            if (candidates.length > 0) {
                const pick = candidates[Math.floor(Math.random() * candidates.length)];
                this.grid[pick.y][pick.x] = {
                    type: this.grid[pick.y][pick.x].type,
                    state: STATE.DRAIN
                };
            }
        }

        // 隣接行のブロックをフラグメント化（散乱）
        this.burstFragments = [];
        const done = new Set();
        for (const row of cleared) {
            for (let dy = -1; dy <= 1; dy++) {
                const ry = row + dy;
                if (ry < 0 || ry >= ROWS) continue;
                for (let x = 0; x < COLS; x++) {
                    const key = ry * COLS + x;
                    if (done.has(key)) continue;
                    done.add(key);
                    const c = this.grid[ry][x];
                    if (c && c.state === STATE.BALLOONED) {
                        this.grid[ry][x] = { type: c.type, state: STATE.FRAGMENT };
                        this.burstFragments.push({
                            x, y: ry, type: c.type,
                            dx: (x < COLS / 2 ? -1 : 1) * (1 + Math.random()),
                            dy: 1 + Math.random(),
                            moves: 2 + Math.floor(Math.random() * 3)
                        });
                    }
                }
            }
        }
        this.phase = this.burstFragments.length > 0 ? PHASE.BURSTING : PHASE.SETTLING;
    }

    /* ===== BURSTING ===== */
    tickBurst(dt) {
        this.burstTickTimer += dt;
        if (this.burstTickTimer < this.burstTickInterval) return;
        this.burstTickTimer = 0;
        let any = false;
        for (const f of this.burstFragments) {
            if (f.moves <= 0) continue;
            const sx = f.dx > 0 ? 1 : f.dx < 0 ? -1 : 0;
            const sy = f.dy > 0 ? 1 : 0;
            let moved = false;
            if (sx !== 0) {
                const nx = f.x + sx;
                if (nx >= 0 && nx < COLS && this.grid[f.y][nx] === 0) {
                    this.grid[f.y][f.x] = 0; f.x = nx;
                    this.grid[f.y][f.x] = { type: f.type, state: STATE.FRAGMENT };
                    f.dx -= sx; moved = true;
                }
            }
            if (sy > 0) {
                const ny = f.y + 1;
                if (ny < ROWS && this.grid[ny][f.x] === 0) {
                    this.grid[f.y][f.x] = 0; f.y = ny;
                    this.grid[f.y][f.x] = { type: f.type, state: STATE.FRAGMENT };
                    f.dy--; moved = true;
                }
            }
            if (moved) { f.moves--; any = true; } else f.moves = 0;
        }
        if (!any) { this.burstFragments = []; this.phase = PHASE.SETTLING; }
    }

    /* ===== SETTLING ===== */
    tickSettle() {
        let fell = false;
        for (let y = ROWS - 2; y >= 0; y--) {
            for (let x = 0; x < COLS; x++) {
                if (this.grid[y][x] !== 0 && this.grid[y + 1][x] === 0) {
                    this.grid[y + 1][x] = this.grid[y][x];
                    this.grid[y][x] = 0;
                    fell = true;
                }
            }
        }
        if (!fell) {
            this.phase = PHASE.PLAYING;
            this.clearLines();
            if (this.phase === PHASE.PLAYING) this.spawnPiece();
        }
    }

    /* ===== パーティクル ===== */
    addBurstParticles(x, y, color, isDrain) {
        const n = isDrain ? 25 : 8;
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x: (x + .5) * BLOCK_SIZE, y: (y + .5) * BLOCK_SIZE,
                vx: (Math.random() - .5) * (isDrain ? 20 : 14),
                vy: (Math.random() - .5) * (isDrain ? 20 : 14),
                life: 1, color
            });
        }
    }
    tickParticles() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.025;
            return p.life > 0;
        });
    }

    /* ===== メインループ ===== */
    loop(time) {
        const dt = time - this.lastTime;
        this.lastTime = time;

        if (!this.gameRunning) {
            requestAnimationFrame(t => this.loop(t)); return;
        }

        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            this.tickParticles(); this.render();
            requestAnimationFrame(t => this.loop(t)); return;
        }
        if (this.shakeTimer > 0) this.shakeTimer -= dt;

        switch (this.phase) {
            case PHASE.PLAYING:
                this.dropCounter += dt;
                if (this.dropCounter >= this.dropInterval) {
                    this.dropCounter = 0;
                    this.piece.pos.y++;
                    if (this.checkCollision(this.piece.shape, this.piece.pos)) {
                        this.piece.pos.y--;
                        this.lockPiece();
                    }
                }
                break;
            case PHASE.BURSTING: this.tickBurst(dt); break;
            case PHASE.SETTLING: this.tickSettle(); break;
        }

        // 水位アニメーション
        this.waterLevel += (this.targetWaterLevel - this.waterLevel) * 0.08;
        // 排水弁タイマー
        if (this.valveTimer > 0) {
            this.valveTimer -= dt;
            this.valveOpen = Math.min(1, this.valveOpen + 0.08);
        } else {
            this.valveOpen = Math.max(0, this.valveOpen - 0.03);
        }

        this.tickParticles();
        this.render();
        requestAnimationFrame(t => this.loop(t));
    }

    /* ===== 入力 ===== */
    bindEvents() {
        document.addEventListener('keydown', e => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
            if (e.key === 'ArrowLeft') this.moveX(-1);
            if (e.key === 'ArrowRight') this.moveX(1);
            if (e.key === 'ArrowDown') this.softDrop();
            if (e.key === 'ArrowUp' || e.key === 'w') this.rotate(1);
            if (e.key === 'q') this.rotate(-1);
        });
    }

    /* ===== 描画 ===== */
    render() {
        const ctx = this.ctx;
        ctx.save();
        if (this.shakeTimer > 0) {
            ctx.translate((Math.random() - .5) * this.shakeIntensity, (Math.random() - .5) * this.shakeIntensity);
        }
        ctx.fillStyle = '#0b132b';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.renderWater(ctx);
        this.renderGridLines(ctx);
        this.renderBlocks(ctx);
        if (this.phase === PHASE.PLAYING && this.piece) this.renderPiece(ctx);
        this.renderValve(ctx);   // 排水弁
        this.renderParticles(ctx);

        if (this.flashAlpha > 0) {
            ctx.fillStyle = `rgba(255,255,255,${this.flashAlpha})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.flashAlpha -= 0.04;
        }
        ctx.restore();

        // UI更新
        const se = document.getElementById('score');
        const le = document.getElementById('lines');
        const we = document.getElementById('water-level');
        if (se) se.textContent = this.score;
        if (le) le.textContent = this.lines;
        if (we) we.textContent = Math.floor((this.targetWaterLevel / ROWS) * 100) + '%';
    }

    renderWater(ctx) {
        const h = this.waterLevel * BLOCK_SIZE;
        if (h < 1) return;
        const g = ctx.createLinearGradient(0, this.canvas.height - h, 0, this.canvas.height);
        g.addColorStop(0, 'rgba(0,180,216,0.45)');
        g.addColorStop(1, 'rgba(3,4,94,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(0, this.canvas.height - h, this.canvas.width, h);
        // 波の白線
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(0, this.canvas.height - h - 2, this.canvas.width, 2);
    }

    /* --- 排水弁の描画 --- */
    renderValve(ctx) {
        const vw = 40, vh = 14;
        const vx = (this.canvas.width - vw) / 2;
        const vy = this.canvas.height - vh;

        // 弁の外枠
        ctx.fillStyle = '#334155';
        ctx.fillRect(vx - 2, vy - 2, vw + 4, vh + 4);

        if (this.valveOpen > 0.01) {
            // 弁が開いている → 緑に光る＋水が流れるアニメ
            const glow = `rgba(0, 255, 136, ${0.5 * this.valveOpen})`;
            ctx.fillStyle = glow;
            ctx.fillRect(vx, vy, vw, vh);
            // 流水パーティクル風のライン
            ctx.strokeStyle = `rgba(0, 255, 136, ${this.valveOpen})`;
            ctx.lineWidth = 2;
            const t = performance.now() * 0.01;
            for (let i = 0; i < 3; i++) {
                const lx = vx + 8 + i * 12;
                ctx.beginPath();
                ctx.moveTo(lx, vy);
                ctx.lineTo(lx + Math.sin(t + i) * 3, vy + vh);
                ctx.stroke();
            }
        } else {
            // 弁が閉じている → 暗いグレー
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(vx, vy, vw, vh);
        }

        // ラベル
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '8px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DRAIN', this.canvas.width / 2, vy - 4);
    }

    renderGridLines(ctx) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= COLS; x++) {
            ctx.beginPath(); ctx.moveTo(x * BLOCK_SIZE, 0); ctx.lineTo(x * BLOCK_SIZE, this.canvas.height); ctx.stroke();
        }
        for (let y = 0; y <= ROWS; y++) {
            ctx.beginPath(); ctx.moveTo(0, y * BLOCK_SIZE); ctx.lineTo(this.canvas.width, y * BLOCK_SIZE); ctx.stroke();
        }
    }

    renderBlocks(ctx) {
        for (let y = 0; y < ROWS; y++)
            for (let x = 0; x < COLS; x++) {
                const c = this.grid[y][x];
                if (c !== 0) this.renderOneBlock(ctx, x, y, c.type, c.state);
            }
    }

    renderPiece(ctx) {
        const s = this.piece.shape, o = this.piece.pos;
        for (let y = 0; y < s.length; y++)
            for (let x = 0; x < s[y].length; x++)
                if (s[y][x] !== 0) this.renderOneBlock(ctx, x + o.x, y + o.y, this.piece.type, STATE.BALLOONED);
    }

    renderOneBlock(ctx, gx, gy, type, state) {
        if (gy < 0) return;
        const px = gx * BLOCK_SIZE + 1, py = gy * BLOCK_SIZE + 1, sz = BLOCK_SIZE - 2;

        if (state === STATE.DRAIN) {
            // 排水ブロック: ネオングリーンの光るブロック
            const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.005);
            ctx.fillStyle = COLORS.DRAIN;
            ctx.globalAlpha = pulse;
            ctx.fillRect(px, py, sz, sz);
            ctx.globalAlpha = 1;
            // 排水アイコン（下向き矢印）
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            const cx = px + sz / 2, cy = py + sz / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 6);
            ctx.lineTo(cx, cy + 6);
            ctx.moveTo(cx - 4, cy + 2);
            ctx.lineTo(cx, cy + 6);
            ctx.lineTo(cx + 4, cy + 2);
            ctx.stroke();
            // 外枠グロー
            ctx.strokeStyle = `rgba(0,255,136,${pulse * 0.5})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(px - 1, py - 1, sz + 2, sz + 2);
        } else if (state === STATE.BALLOONED) {
            ctx.fillStyle = COLORS[type] || '#caf0f8';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(px + 1, py + 1, sz - 2, sz - 2, 8) : ctx.rect(px + 1, py + 1, sz - 2, sz - 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath(); ctx.arc(px + 9, py + 9, 4, 0, Math.PI * 2); ctx.fill();
        } else {
            // FRAGMENT: 水に沈む破片（濃いグレー）
            ctx.fillStyle = COLORS.FRAGMENT;
            ctx.fillRect(px, py, sz, sz);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.strokeRect(px, py, sz, sz);
        }
    }

    renderParticles(ctx) {
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 4, 4);
        }
        ctx.globalAlpha = 1;
    }

    drawNextPiece() {
        const el = document.getElementById('nextCanvas') || this.makeNextCanvas();
        if (!el) return;
        const c = el.getContext('2d');
        c.fillStyle = '#1b263b'; c.fillRect(0, 0, el.width, el.height);
        const s = this.nextPiece.shape, col = COLORS[this.nextPiece.type], sz = 16;
        const ox = (el.width - s[0].length * sz) / 2, oy = (el.height - s.length * sz) / 2;
        for (let y = 0; y < s.length; y++)
            for (let x = 0; x < s[y].length; x++)
                if (s[y][x]) {
                    c.fillStyle = col; c.beginPath();
                    c.roundRect ? c.roundRect(ox + x * sz, oy + y * sz, sz - 2, sz - 2, 4) : c.rect(ox + x * sz, oy + y * sz, sz - 2, sz - 2);
                    c.fill();
                }
    }

    makeNextCanvas() {
        const box = document.createElement('div'); box.className = 'stat-box';
        box.innerHTML = '<div class="stat-label">NEXT</div>';
        const cv = document.createElement('canvas'); cv.id = 'nextCanvas'; cv.width = 80; cv.height = 80;
        box.appendChild(cv);
        const ui = document.getElementById('ui-layer');
        if (ui) ui.insertBefore(box, ui.firstChild);
        return cv;
    }
}

const game = new Game();
