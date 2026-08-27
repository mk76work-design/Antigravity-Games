// aiClient.js — ブラウザ側のアダプタ。
//
// 実際のプロンプト構築・自己チェックロジックは core.js（環境非依存）に一本化されている。
// このファイルは (1) ローカルサーバー（/api/claude）へのfetch実装、
// (2) DOMキャンバスを使った自己レビュー用画像レンダリング、(3) 設定値の localStorage
// 永続化、という「ブラウザ固有の配線」だけを担当する。
//
// Anthropic APIキーは使わない。実際の呼び出しは /api/claude （vite.config.js の
// 開発サーバーミドルウェア）経由でローカルの `claude` コマンド（Claude Code CLI）に
// 委譲され、ユーザーがローカルで `claude login` 済みの Claude Pro/Max/Team
// サブスクリプションの認証をそのまま使う。API従量課金は発生しない。
//
// なお、ブラウザを介さずAIエージェント自身がこのツールを直接操作したい場合は
// cli.js（Node製CLI、core.js を共有）を使うこと。

import * as core from './core.js';
import { getReviewSpritesheetBase64 } from './exporter.js';

const CLAUDE_API_ENDPOINT = '/api/claude';
const CLAUDE_HEALTH_ENDPOINT = '/api/claude/health';
const MODEL_STORAGE = 'pixelAnimator.model';
const SELF_CHECK_STORAGE = 'pixelAnimator.selfCheckEnabled';
const MAX_ITERATIONS_STORAGE = 'pixelAnimator.maxIterations';

export async function checkCliHealth() {
    try {
        const res = await fetch(CLAUDE_HEALTH_ENDPOINT);
        return await res.json();
    } catch {
        return { available: false, message: 'ローカルサーバーに接続できませんでした（npm run dev で起動しているか確認してください）。' };
    }
}

export function getModel() {
    return localStorage.getItem(MODEL_STORAGE) || core.DEFAULT_MODEL;
}

export function setModel(model) {
    localStorage.setItem(MODEL_STORAGE, model || core.DEFAULT_MODEL);
}

export function getSelfCheckEnabled() {
    const v = localStorage.getItem(SELF_CHECK_STORAGE);
    return v === null ? true : v === '1';
}

export function setSelfCheckEnabled(enabled) {
    localStorage.setItem(SELF_CHECK_STORAGE, enabled ? '1' : '0');
}

export function getMaxIterations() {
    const v = Number(localStorage.getItem(MAX_ITERATIONS_STORAGE));
    return Number.isInteger(v) && v >= 1 && v <= 5 ? v : core.DEFAULT_MAX_ITERATIONS;
}

export function setMaxIterations(n) {
    localStorage.setItem(MAX_ITERATIONS_STORAGE, String(Math.min(5, Math.max(1, Math.round(n) || core.DEFAULT_MAX_ITERATIONS))));
}

async function callClaude({ system, userText, tool, maxTokens = 16000 }) {
    const res = await fetch(CLAUDE_API_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            model: getModel(),
            max_tokens: maxTokens,
            system,
            userText,
            tool,
        }),
    });

    if (!res.ok) {
        let detail = '';
        try {
            const errBody = await res.json();
            detail = errBody?.error || JSON.stringify(errBody);
        } catch {
            detail = await res.text();
        }
        throw new Error(detail || `ローカルサーバーがエラーを返しました (${res.status})`);
    }

    const data = await res.json();
    const toolUse = data.content?.find((block) => block.type === 'tool_use' && block.name === tool.name);
    if (!toolUse) {
        throw new Error('AIエージェントの応答から構造化データを取得できませんでした。もう一度試してください。');
    }
    return toolUse.input;
}

export function regenerateFrame(params) {
    return core.regenerateFrame({ ...params, callClaude });
}

export function generateWithSelfCheck(params) {
    return core.generateWithSelfCheck({
        ...params,
        callClaude,
        renderReviewImage: (project) => getReviewSpritesheetBase64(project),
    });
}
