# Webゲーム開発ルール

HTML5 Canvas / WebGL / Web Audio API を使用したWebゲーム開発における
ベストプラクティスと禁止パターン。

---

## バージョン情報
- 対象: HTML5, Canvas 2D API, WebGL 2.0, Web Audio API
- 最終更新: 2026-02-22

---

## 推奨パターン

### ゲームループ
```javascript
// ✅ 推奨: requestAnimationFrame + deltaTime ベースのゲームループ
let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000; // 秒単位
    lastTime = timestamp;

    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

### Canvas のサイズ設定
```javascript
// ✅ 推奨: CSS と Canvas の両方でサイズを設定
const canvas = document.getElementById('game');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// リサイズ対応
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
```

### イベントリスナーの管理
```javascript
// ✅ 推奨: イベントリスナーの登録と解除をセットで管理
class InputManager {
    constructor() {
        this.keys = {};
        this._onKeyDown = (e) => { this.keys[e.code] = true; };
        this._onKeyUp = (e) => { this.keys[e.code] = false; };
    }

    enable() {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    disable() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }
}
```

### オーディオの再生
```javascript
// ✅ 推奨: ユーザーインタラクション後にAudioContextを作成
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// ボタンクリックやキー入力時に呼び出す
document.addEventListener('click', initAudio, { once: true });
```

---

## 禁止パターン

### ❌ setInterval ベースのゲームループ
```javascript
// ❌ 禁止: setIntervalは正確なタイミング制御ができない
setInterval(gameLoop, 1000 / 60); // 使用禁止
```
**理由**: `setInterval` はブラウザのタブが非アクティブ時に正確に動作せず、フレーム落ちやカクつきの原因になる。

### ❌ 固定フレームレート前提の物理計算
```javascript
// ❌ 禁止: フレームレートに依存する速度計算
player.x += 5; // 60FPSを前提とした固定値
```
**理由**: デバイスによってフレームレートが異なるため、deltaTimeを使用すること。

### ❌ Canvas のCSS-onlyサイズ指定
```css
/* ❌ 禁止: CSSだけでサイズ指定すると描画がぼやける */
canvas { width: 100%; height: 100%; }
```
**理由**: Canvas要素の `width`/`height` 属性を直接設定しないと、内部解像度が変わらずぼやける。

### ❌ ユーザーインタラクション前のオーディオ再生
```javascript
// ❌ 禁止: ページロード時にいきなり音を鳴らす
window.onload = () => { new Audio('bgm.mp3').play(); };
```
**理由**: ブラウザの自動再生ポリシーによりブロックされる。ユーザーのクリック/タッチ後に初期化すること。

### ❌ グローバル変数の乱用
```javascript
// ❌ 禁止: ゲーム状態をグローバル変数で管理
var score = 0;
var lives = 3;
var enemies = [];
```
**理由**: 名前衝突とデバッグ困難を引き起こす。クラスまたはオブジェクトでカプセル化すること。

---

## 外部ライブラリの推奨CDN

### Three.js (3Dゲーム)
```html
<!-- 推奨: unpkg または jsdelivr を使用、バージョンは必ず固定する -->
<script src="https://unpkg.com/three@0.170.0/build/three.module.js" type="module"></script>
```
> ⚠️ `master` や `latest` タグは使わず、バージョン番号を固定すること

### Matter.js (物理エンジン)
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js"></script>
```

### Howler.js (オーディオ)
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js"></script>
```

---

## パフォーマンスガイドライン

| 項目 | 推奨値 |
|------|--------|
| 目標FPS | 60 FPS |
| Canvas再描画 | 変更された部分のみ、または全画面クリア+再描画 |
| オブジェクト生成 | ゲームループ内での `new` を避け、オブジェクトプールを使用 |
| 画像アセット | スプライトシートを使用し、HTTP リクエストを削減 |
| 衝突判定 | 空間分割（グリッド、四分木）で計算量を削減 |

---

## アーキテクチャ負債パターン（追加禁止パターン）

### ❌ モノリシックファイル
```javascript
// ❌ 禁止: 全ロジックを1ファイルに記述（500行超）
// game.js に Player, Enemy, UI, GameLoop 全てが混在
```
**理由**: コンテキストウィンドウを浪費し、AIの推論精度が低下する。1ファイル最大300行。

### ❌ 力技による修正
```javascript
// ❌ 禁止: バグの根本原因を修正せず、表面的な回避策を積み重ねる
if (player.x < 0) player.x = 0; // 壁の外に出るバグを力技で回避
if (player.x > 800) player.x = 800; // マジックナンバーのハードコーディング
```
**理由**: 設定オブジェクトに境界値を定義し、衝突判定ロジックで根本的に解決すべき。

### ❌ `var` キーワードの使用
```javascript
// ❌ 禁止: varは関数スコープのため、意図しない変数アクセスの原因になる
var playerSpeed = 5;
```
**理由**: `const`（変更不可）または `let`（変更可）を使用すること。

---

## Kaboom.js 推奨パターン（AI最高親和性フレームワーク）

> Kaboom.js は AI エージェントとの親和性が最も高いゲームフレームワークである。
> 宣言的なコンポーネント指向により、AIが物理演算の低レベルコードを記述する必要がなくなる。

### 基本セットアップ
```javascript
// ✅ 推奨: 最小ボイラープレートでゲームを開始
import kaboom from "kaboom";

kaboom({
    width: 800,
    height: 600,
    background: [0, 0, 0],
});
```

### コンポーネント指向の物理実装
```javascript
// ✅ 推奨: body(), solid() 等の宣言的コンポーネントで物理を実装
const player = add([
    sprite("player"),
    pos(100, 200),
    area(),         // 当たり判定
    body(),         // 重力と物理演算
    "player",       // タグ付け
]);

// ✅ 推奨: 衝突判定を宣言的に記述
player.onCollide("enemy", () => {
    destroy(player);
    go("gameover");
});
```

---

## 推奨モジュール設計パターン

### 設定オブジェクトの分離
```javascript
// config.js — 定数を集約（ハードコーディング禁止の対応）
export const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLAYER_SPEED: 200,    // px/sec (deltaTime前提)
    PLAYER_LIVES: 3,
    ENEMY_SPAWN_INTERVAL: 2.0,  // 秒
    GRAVITY: 980,               // px/sec^2
};
```

### ゲーム状態のカプセル化
```javascript
// ✅ 推奨: クラスでゲーム状態をカプセル化
class GameState {
    constructor() {
        this.score = 0;
        this.lives = CONFIG.PLAYER_LIVES;
        this.isGameOver = false;
    }

    addScore(points) { this.score += points; }
    loseLife() {
        this.lives--;
        if (this.lives <= 0) this.isGameOver = true;
    }
    reset() {
        this.score = 0;
        this.lives = CONFIG.PLAYER_LIVES;
        this.isGameOver = false;
    }
}
```
