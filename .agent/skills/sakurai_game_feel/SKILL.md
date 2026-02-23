---
name: "Sakurai Game Feel"
description: "桜井政博氏の知見に基づく操作感・手応え（ゲームフィール）の実装ガイドライン。ヒットストップ、先行入力、モーション設計、画面振動の具体的なパターンとコード例を提供する。"
---

# Sakurai Game Feel スキル

桜井政博氏の知見に基づく、**操作感（ゲームフィール）と手応え**の実装ガイドライン。
コード実装フェーズで本スキルを参照し、プレイヤーの「気持ちよさ」を担保する。

> **出典:** [Documents/Sakurai_Knowledge/](file:///c:/Users/pusap/work/Antigravity-Games/Documents/Sakurai_Knowledge/Index.md) カテゴリ C, D, G, H, K, M

---

## 1. レスポンス設計 —「遅さは罪」（D-3）

> 入力からアクションまでの時間は最短にする。

### 基本原則

- **60fps（16.67ms/フレーム）** を基準単位とする
- 入力→画面反映は **1〜2フレーム以内** を目標にする
- アニメーションの「見栄え」よりも「操作の応答性」を優先する

### フレーム感覚の基準（C-9, M-1）

| フレーム数 | 時間 | 用途の目安 |
|-----------|------|-----------|
| 1F | 16.67ms | 入力検出・即時反応 |
| 2-3F | 33-50ms | 操作の応答として許容される最大遅延 |
| 4-6F | 67-100ms | 予備動作（攻撃の溜め） |
| 8-12F | 133-200ms | ヒットストップの標準範囲 |
| 15-30F | 250-500ms | フォロースルー（攻撃後の戻り） |

---

## 2. ヒットストップ（D-1）

> 攻撃がヒットした瞬間にゲームを数フレーム停止させ、「手応え」を生む。

### 8つのパラメータ

ヒットストップを実装する際、以下を定義すること：

| # | パラメータ | 説明 |
|---|----------|------|
| 1 | **停止のフレーム長** | 弱攻撃: 3-5F / 強攻撃: 8-12F |
| 2 | **停止対象** | 攻撃者のみ / 被撃者のみ / 両方 |
| 3 | **ガード時の挙動** | ガード時はフレーム数を短縮するか |
| 4 | **重ね掛け処理** | 複数ヒットが重なった場合の処理 |
| 5 | **停止中の演出** | 振動、フラッシュ、パーティクル |
| 6 | **停止の緩急** | 即停止 or 減速→停止 |
| 7 | **解除タイミング** | フレーム消化 or 入力割り込み可能か |
| 8 | **カメラへの影響** | ズーム、揺れの同期 |

### 実装パターン

```javascript
// ヒットストップのシンプルな実装例
class HitStop {
  constructor() {
    this.duration = 0;
    this.elapsed = 0;
  }

  trigger(frames) {
    this.duration = frames;
    this.elapsed = 0;
  }

  get isActive() {
    return this.elapsed < this.duration;
  }

  update() {
    if (this.isActive) {
      this.elapsed++;
      return true; // ゲームロジックを停止
    }
    return false;
  }
}

// ゲームループでの使用
function gameLoop(deltaTime) {
  if (hitStop.update()) {
    renderOnly(); // 描画のみ（ロジック停止）
    return;
  }
  updateGameLogic(deltaTime);
  render();
}
```

---

## 3. 先行入力（D-2）

> 着地直前のジャンプ入力を許容し、操作の快適性を高める。

```javascript
// 先行入力バッファの実装例
class InputBuffer {
  constructor(bufferFrames = 6) {
    this.buffer = [];
    this.bufferFrames = bufferFrames;
  }

  record(action) {
    this.buffer.push({
      action,
      framesRemaining: this.bufferFrames
    });
  }

  consume(allowedAction) {
    const index = this.buffer.findIndex(
      entry => entry.action === allowedAction
    );
    if (index !== -1) {
      this.buffer.splice(index, 1);
      return true;
    }
    return false;
  }

  update() {
    this.buffer = this.buffer.filter(entry => {
      entry.framesRemaining--;
      return entry.framesRemaining > 0;
    });
  }
}

// 使用例：着地時にバッファされたジャンプを確認
function onLanding() {
  if (inputBuffer.consume('jump')) {
    player.jump(); // 着地前に押されたジャンプを実行
  }
}
```

---

## 4. モーションの3構成（G-1）

> すべてのアクションを「予備動作」→「発生」→「フォロースルー」で設計する。

```
[予備動作]     [発生]       [フォロースルー]
  ┃              ┃              ┃
  ▼              ▼              ▼
  溜め・引き      瞬間の動き      余韻・戻り
  2-6F           1-3F           8-20F
  （誇張する）    （高速）        （丁寧に作る）
```

### 設計ルール

| フェーズ | ルール | 桜井氏の知見 |
|---------|--------|-------------|
| **予備動作** | 瞬時かつ誇張する | プレイヤーに「何が来るか」を予感させる |
| **発生** | 可能な限り高速にする | レスポンス優先 |
| **フォロースルー** | 丁寧に余韻を作る | キャラの印象・個性がここで決まる |

### ケレン味（誇張表現）（G-2）

- モーションは**現実より大きく、誇張**する
- 現実の動きのコピーはテンポが遅く、力強く見えない
- 遠目のカメラでも映える大きな動きを意識する

---

## 5. 画面振動（スクリーンシェイク）（H-3）

> 振動は「大中小」のパターンを作り、最初は強く、徐々に減衰させる。

```javascript
// 画面振動の実装例
class ScreenShake {
  constructor() {
    this.intensity = 0;
    this.duration = 0;
    this.elapsed = 0;
  }

  /**
   * @param {number} intensity - 振動の強さ（ピクセル）
   * @param {number} duration  - 持続フレーム数
   */
  trigger(intensity, duration) {
    this.intensity = intensity;
    this.duration = duration;
    this.elapsed = 0;
  }

  update() {
    if (this.elapsed >= this.duration) return { x: 0, y: 0 };
    this.elapsed++;

    // 減衰率（最初は強く、徐々に弱く）
    const decay = 1 - (this.elapsed / this.duration);
    const power = this.intensity * decay;

    return {
      x: (Math.random() - 0.5) * 2 * power,
      y: (Math.random() - 0.5) * 2 * power
    };
  }
}

// 強弱のプリセット
const SHAKE_PRESETS = {
  light:  { intensity: 2,  duration: 4  }, // 弱い衝撃
  medium: { intensity: 5,  duration: 8  }, // 通常ヒット
  heavy:  { intensity: 12, duration: 15 }, // 強攻撃・爆発
  boss:   { intensity: 20, duration: 25 }, // ボス撃破
};
```

---

## 6. エフェクトシーケンス — 爆発の5段階（H-1）

| 段階 | 名称 | 説明 | フレーム目安 |
|------|------|------|------------|
| 1 | **閃光** | 白いフラッシュ | 1-3F |
| 2 | **爆沸** | 急速に拡大する炎 | 3-8F |
| 3 | **爆炎** | 最大サイズの炎 | 5-15F |
| 4 | **残煙** | 煙が広がり残る | 15-40F |
| 5 | **収束** | フェードアウト | 30-60F |

---

## 7. データ駆動型設計 — 骨と筋肉の分離（K-1）

> 攻撃力や速度などの数値はプログラムに直接書かず、外部データから読み込む。

```javascript
// NG: ハードコーディング
function attack() {
  const damage = 25;
  const knockback = 10;
}

// OK: 設定ファイルから読み込み
// config.js
export const PLAYER_CONFIG = {
  attacks: {
    light: { damage: 10, knockback: 3, hitStopFrames: 3 },
    heavy: { damage: 25, knockback: 10, hitStopFrames: 8 },
    special: { damage: 40, knockback: 15, hitStopFrames: 12 },
  },
  movement: {
    speed: 5,
    jumpForce: 12,
    gravity: 0.6,
  },
};
```

---

## エージェントへの実装チェックリスト

コード実装時に以下を確認すること：

- [ ] 入力→画面反映は **2フレーム以内** か
- [ ] ヒットストップが実装されているか（攻撃があるゲームの場合）
- [ ] 先行入力バッファが実装されているか（アクションゲームの場合）
- [ ] モーションが「予備動作→発生→フォロースルー」の3構成か
- [ ] 画面振動は **減衰つき** で実装されているか
- [ ] 数値パラメータは **設定ファイルに分離** されているか
- [ ] エフェクトに **メリハリ（芯のある構成）** があるか
