# Emoji Climber — モジュールマップ

> 最終更新: 2026-02-23

## モジュール依存関係

```
main.js
├── config.js
├── input.js      ← InputManager, InputBuffer
├── player.js     ← Player
├── camera.js     ← Camera
├── level.js      ← createLevel(), getZoneIndex(), getZoneCheckpointY()
├── physics.js    ← applyGravity(), applyFriction(), applyAirResistance(),
│                    checkCollisions(), resolveCollision(), updateCrumblingPlatforms()
├── renderer.js   ← drawBackground(), drawPlatforms(), drawPlayer(),
│                    drawChargeGauge(), drawParticles(), drawTauntMessage(), drawZoneName()
└── ui.js         ← UI
```

## 主要クラス

### `InputManager` (input.js)
- `enable()` / `disable()` — イベントリスナー管理
- `isDown(code)` / `wasPressed(code)` / `wasReleased(code)` — キー状態
- `bufferAction(action)` / `consumeBuffered(action)` — 先行入力バッファ
- `startCoyoteTime()` / `isCoyoteActive` — コヨーテタイム

### `Player` (player.js)
- 状態: IDLE → RUNNING → CHARGING → AIRBORNE → LANDED
- `move(direction, dt)` — 慣性移動
- `startCharge()` / `updateCharge(dt, dir)` / `releaseCharge()` — タメジャンプ
- `land(fallSpeed)` / `bounce()` — 着地/バウンス
- `updateEmoji()` — 表情システム

### `Camera` (camera.js)
- `update(playerY, dt)` — Lerp追従
- `shake(intensity, duration)` — 減衰付き振動
- `worldToScreen(worldY)` — 座標変換

### `UI` (ui.js)
- `update(dt, player)` — ゾーン検出・煽りメッセージ管理
- `draw(ctx, player)` — HUD描画（高度計・タイマー）
