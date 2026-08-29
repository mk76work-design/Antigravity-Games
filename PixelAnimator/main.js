// main.js — Pixel Animator のアプリ本体（配線）

import { createEmptyProject, ProjectStore } from './state.js';
import {
    generateWithSelfCheck,
    regenerateFrame,
    checkCliHealth,
    getModel,
    setModel,
    getSelfCheckEnabled,
    setSelfCheckEnabled,
    getMaxIterations,
    setMaxIterations,
} from './aiClient.js';
import { renderPaletteStrip, renderFrameStrip } from './renderer.js';
import { Animator } from './animator.js';
import { PixelEditor } from './editor.js';
import { exportSpritesheetPng, exportAnimatedGif, exportProjectJson, parseProjectJson } from './exporter.js';

const $ = (id) => document.getElementById(id);

const promptInput = $('promptInput');
const sizeSelect = $('sizeSelect');
const frameCountInput = $('frameCountInput');
const paletteSizeInput = $('paletteSizeInput');
const loopSelect = $('loopSelect');
const generateBtn = $('generateBtn');
const statusLine = $('statusLine');
const agentLog = $('agentLog');

const toolGroup = $('toolGroup');
const undoBtn = $('undoBtn');
const redoBtn = $('redoBtn');
const zoomRange = $('zoomRange');

const editCanvas = $('editCanvas');
const paletteStripEl = $('paletteStrip');

const playBtn = $('playBtn');
const fpsRange = $('fpsRange');
const fpsValue = $('fpsValue');
const playCanvas = $('playCanvas');

const frameStripEl = $('frameStrip');
const dupFrameBtn = $('dupFrameBtn');
const delFrameBtn = $('delFrameBtn');
const regenFrameBtn = $('regenFrameBtn');

const exportPngBtn = $('exportPngBtn');
const exportGifBtn = $('exportGifBtn');
const exportJsonBtn = $('exportJsonBtn');
const importJsonInput = $('importJsonInput');

const settingsBtn = $('settingsBtn');
const settingsDialog = $('settingsDialog');
const settingsForm = $('settingsForm');
const modelInput = $('modelInput');
const selfCheckToggle = $('selfCheckToggle');
const maxIterationsInput = $('maxIterationsInput');
const checkCliBtn = $('checkCliBtn');
const cliStatusLine = $('cliStatusLine');

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function setStatus(text, kind = '') {
    statusLine.textContent = text;
    statusLine.className = 'status-line' + (kind ? ` ${kind}` : '');
}

function clearLog() {
    agentLog.innerHTML = '';
}

function appendLog(text, kind = '') {
    const line = document.createElement('div');
    line.className = 'agent-log-entry' + (kind ? ` ${kind}` : '');
    line.textContent = text;
    agentLog.appendChild(line);
    agentLog.scrollTop = agentLog.scrollHeight;
}

function handleAgentProgress(event) {
    const tag = `[${event.iteration}/${event.maxIterations}]`;
    switch (event.type) {
        case 'generating':
            appendLog(`🪄 ${tag} 生成中...`);
            break;
        case 'heuristic-checking':
            appendLog(`🔍 ${tag} 機械的な品質チェック中...`);
            break;
        case 'heuristic-failed':
            appendLog(`⚠️ ${tag} 問題を検出: ${event.issues.join(' / ')}`, 'warn');
            appendLog(event.willRetry ? `↻ ${tag} フィードバックを添えて再生成します。` : `⏹ ${tag} 上限回数に達しました。ユーザーの確認が必要です。`, 'warn');
            break;
        case 'vision-reviewing':
            appendLog(`👁 ${tag} AIエージェントが自分の絵を画像として確認中...`);
            break;
        case 'vision-review-error':
            appendLog(`⚠️ ${tag} 画像レビューに失敗（機械的チェックの合格分を採用）: ${event.message}`, 'warn');
            break;
        case 'vision-needs-fix':
            appendLog(`📝 ${tag} 自己採点 ${event.score}/10（ドット絵らしさ ${event.pixelArtAuthenticity}/10、シェーディング ${event.shadingQuality}/10）→ 修正: ${event.issues.map((i) => i.problem).join(' / ')}`, 'warn');
            appendLog(event.willRetry ? `↻ ${tag} フィードバックを添えて再生成します。` : `⏹ ${tag} 上限回数に達しました。ユーザーの確認が必要です。`, 'warn');
            break;
        case 'done':
            if (event.verdict === 'approved') {
                appendLog(`✅ ${tag} 自己チェック合格（スコア ${event.score}/10、ドット絵らしさ ${event.pixelArtAuthenticity}/10、シェーディング ${event.shadingQuality}/10）。`, 'ok');
            } else if (event.verdict === 'skipped') {
                appendLog('ℹ️ 自己チェックは無効化されています。');
            }
            break;
    }
}

function flatTo2D(flat, width, height) {
    const rows = [];
    for (let y = 0; y < height; y++) rows.push(flat.slice(y * width, (y + 1) * width));
    return rows;
}

// ── 初期化 ──

const initialProject = createEmptyProject({ width: 16, height: 16, frameCount: 6, fps: 8, loopMode: 'loop' });
const store = new ProjectStore(initialProject);
const editor = new PixelEditor(editCanvas, store);
const animator = new Animator(playCanvas);

let activeColorIndex = 1;
editor.setColor(activeColorIndex);
editor.setCellSize(Number(zoomRange.value));

editor.onColorPicked = (value) => {
    activeColorIndex = value;
    renderPalette();
};

function renderPalette() {
    renderPaletteStrip(paletteStripEl, store.project.palette, activeColorIndex, (index) => {
        activeColorIndex = index;
        editor.setColor(index);
        renderPalette();
    });
}

function updateHistoryButtons() {
    undoBtn.disabled = store.undoStack.length === 0;
    redoBtn.disabled = store.redoStack.length === 0;
}

function selectFrame(index) {
    store.currentFrame = index;
    renderAll(store.project);
}

function renderAll(project) {
    editor.redraw();
    renderPalette();
    renderFrameStrip(frameStripEl, project, store.currentFrame, selectFrame);
    animator.setProject(project);
    updateHistoryButtons();
}

store.onChange(renderAll);
renderAll(store.project);

// ── ツール切り替え ──

toolGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;
    toolGroup.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    editor.setTool(btn.dataset.tool);
});

undoBtn.addEventListener('click', () => store.undo());
redoBtn.addEventListener('click', () => store.redo());
zoomRange.addEventListener('input', () => editor.setCellSize(Number(zoomRange.value)));

// ── 再生 ──

playBtn.addEventListener('click', () => {
    const playing = animator.toggle();
    playBtn.textContent = playing ? '⏸' : '▶';
});

fpsRange.addEventListener('input', () => {
    fpsValue.textContent = fpsRange.value;
    store.project.fps = Number(fpsRange.value);
});

// ── フレーム操作 ──

dupFrameBtn.addEventListener('click', () => store.duplicateFrame(store.currentFrame));
delFrameBtn.addEventListener('click', () => store.deleteFrame(store.currentFrame));

regenFrameBtn.addEventListener('click', async () => {
    const description = promptInput.value.trim();
    if (!description) {
        setStatus('先頭の入力欄にアニメーション全体の説明を入力してください（フレーム再生成にも使われます）。', 'error');
        return;
    }
    const { project, currentFrame } = store;
    const neighborFrames = [];
    if (currentFrame > 0) {
        neighborFrames.push({ index: currentFrame - 1, pixels: flatTo2D(project.frames[currentFrame - 1], project.width, project.height) });
    }
    if (currentFrame < project.frames.length - 1) {
        neighborFrames.push({ index: currentFrame + 1, pixels: flatTo2D(project.frames[currentFrame + 1], project.width, project.height) });
    }

    regenFrameBtn.disabled = true;
    setStatus(`フレーム ${currentFrame + 1} を再生成中...`, '');
    try {
        const pixels = await regenerateFrame({
            description,
            width: project.width,
            height: project.height,
            palette: project.palette,
            neighborFrames,
            frameIndex: currentFrame,
        });
        store.snapshotBeforeEdit();
        store.replaceFrame(currentFrame, pixels);
        setStatus(`フレーム ${currentFrame + 1} を再生成しました。`, 'ok');
    } catch (err) {
        console.error(err);
        setStatus(err.message || 'フレームの再生成に失敗しました。', 'error');
    } finally {
        regenFrameBtn.disabled = false;
    }
});

// ── AIエージェントによる生成 ──

generateBtn.addEventListener('click', async () => {
    const description = promptInput.value.trim();
    if (!description) {
        setStatus('どんなアニメーションが欲しいか入力してください。', 'error');
        return;
    }

    const size = Number(sizeSelect.value);
    const frameCount = clamp(Number(frameCountInput.value) || 6, 2, 16);
    const paletteLimit = clamp(Number(paletteSizeInput.value) || 12, 2, 32);
    const loopMode = loopSelect.value;

    generateBtn.disabled = true;
    clearLog();
    setStatus('AIエージェントが描画・自己チェック中...（数十秒〜数分かかることがあります）', '');
    try {
        const result = await generateWithSelfCheck({
            description,
            width: size,
            height: size,
            frameCount,
            paletteLimit,
            loopMode,
            maxIterations: getMaxIterations(),
            selfCheckEnabled: getSelfCheckEnabled(),
            onProgress: handleAgentProgress,
        });
        const project = {
            width: size,
            height: size,
            fps: Number(fpsRange.value),
            loopMode,
            palette: result.palette,
            frames: result.frames,
        };
        activeColorIndex = 0;
        store.replaceProject(project, 0);
        setStatus(summarizeResult(result), result.verdict === 'needs_review' ? 'warn' : 'ok');
        if (result.verdict === 'needs_review' && result.reasons?.length) {
            appendLog('— 最終チェックで残った指摘 —', 'warn');
            result.reasons.forEach((reason) => appendLog(`• ${reason}`, 'warn'));
        }
    } catch (err) {
        console.error(err);
        setStatus(err.message || '生成に失敗しました。', 'error');
    } finally {
        generateBtn.disabled = false;
    }
});

function summarizeResult(result) {
    const concept = result.concept ? `「${result.concept}」` : '';
    switch (result.verdict) {
        case 'approved':
            return `✅ ${result.iterations}回の試行で自己チェックに合格しました（スコア${result.score}/10、ドット絵らしさ${result.pixelArtAuthenticity}/10、シェーディング${result.shadingQuality}/10）。${concept}`;
        case 'approved-heuristic-only':
            return `✅ 機械的な品質チェックには合格しました（AIによる画像レビューは失敗のためスキップ）。${concept}`;
        case 'skipped':
            return `完成しました（自己チェックは無効）。${concept}`;
        case 'needs_review':
            return `⚠️ ${result.iterations}回試しましたが自己チェックを通過できませんでした。詳細は下のログを確認し、必要なら手直しするか再生成してください。`;
        default:
            return `完成しました。${concept}`;
    }
}

// ── 書き出し / 読み込み ──

exportPngBtn.addEventListener('click', () => exportSpritesheetPng(store.project));

exportGifBtn.addEventListener('click', async () => {
    exportGifBtn.disabled = true;
    setStatus('GIFを書き出し中...', '');
    try {
        await exportAnimatedGif(store.project);
        setStatus('GIFを書き出しました。', 'ok');
    } catch (err) {
        console.error(err);
        setStatus('GIFの書き出しに失敗しました。', 'error');
    } finally {
        exportGifBtn.disabled = false;
    }
});

exportJsonBtn.addEventListener('click', () => exportProjectJson(store.project));

importJsonInput.addEventListener('change', async () => {
    const file = importJsonInput.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const project = parseProjectJson(text);
        activeColorIndex = 1;
        store.replaceProject(project, 0);
        sizeSelect.value = String(project.width);
        frameCountInput.value = String(project.frames.length);
        paletteSizeInput.value = String(Math.max(project.palette.length, Number(paletteSizeInput.value)));
        loopSelect.value = project.loopMode;
        fpsRange.value = String(project.fps);
        fpsValue.textContent = String(project.fps);
        setStatus('プロジェクトを読み込みました。', 'ok');
    } catch (err) {
        console.error(err);
        setStatus(err.message || 'JSONの読み込みに失敗しました。', 'error');
    } finally {
        importJsonInput.value = '';
    }
});

// ── 設定ダイアログ ──

async function refreshCliStatus(targetEl) {
    targetEl.textContent = '確認中...';
    targetEl.className = 'status-line';
    const health = await checkCliHealth();
    if (health.available) {
        targetEl.textContent = `✅ claude CLIに接続できました（${health.version || 'version不明'}）。`;
        targetEl.className = 'status-line ok';
    } else {
        targetEl.textContent = `⚠️ ${health.message}`;
        targetEl.className = 'status-line warn';
    }
    return health;
}

settingsBtn.addEventListener('click', () => {
    modelInput.value = getModel();
    selfCheckToggle.checked = getSelfCheckEnabled();
    maxIterationsInput.value = String(getMaxIterations());
    settingsDialog.showModal();
    refreshCliStatus(cliStatusLine);
});

settingsForm.addEventListener('submit', () => {
    setModel(modelInput.value.trim());
    setSelfCheckEnabled(selfCheckToggle.checked);
    setMaxIterations(Number(maxIterationsInput.value));
});

checkCliBtn.addEventListener('click', () => refreshCliStatus(cliStatusLine));

// 起動時にもさりげなく確認しておく（未接続ならメイン画面のステータス欄で知らせる）
checkCliHealth().then((health) => {
    if (!health.available) {
        setStatus(`⚠️ ${health.message}`, 'warn');
    }
});
