// server/claudeApi.js — ローカルの Claude Code CLI（`claude`コマンド）を子プロセスとして
// 呼び出し、Anthropic Messages API の tool_use レスポンスと同じ形（
// { content: [{ type: 'tool_use', name, input }] }）を返すプロキシ。
//
// Anthropic API キーは一切使わない。ユーザーがローカルで `claude login` 済みの
// Claude Pro/Max/Team サブスクリプションの認証（OAuth）をそのまま使い、
// API従量課金ではなくサブスクリプションの利用枠で動作する。
//
// ブラウザは子プロセスを起動できないため、この処理は Vite の開発サーバー
// ミドルウェア（vite.config.js）経由でのみ呼び出される。

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_BUFFER = 64 * 1024 * 1024;

function friendlyError(err, stderr) {
    const stderrText = (stderr || '').toString();
    if (err && err.code === 'ENOENT') {
        return new Error('ローカルに `claude` コマンド（Claude Code CLI）が見つかりません。https://claude.com/product/claude-code からインストールし、`claude login` でログインしてから再度お試しください。');
    }
    if (/not authenticated|please (log ?in|run.*login)|no valid credentials/i.test(stderrText)) {
        return new Error('Claude Code CLIがログインしていません。ターミナルで `claude login` を実行し、Claude Pro/Max/Teamアカウントでログインしてください。');
    }
    if (err && err.killed) {
        return new Error('Claude CLIの応答がタイムアウトしました。もう一度お試しください。');
    }
    return null;
}

// userText: string、または Anthropic content-block 形式の配列（{type:'text',...} / {type:'image', source:{type:'base64', media_type, data}}）
async function buildPrompt(userText, tmpDir) {
    if (typeof userText === 'string') {
        return { promptText: userText, hasImage: false };
    }

    const textParts = [];
    const imagePaths = [];
    let imageIndex = 0;

    for (const block of userText) {
        if (block.type === 'text') {
            textParts.push(block.text);
        } else if (block.type === 'image') {
            imageIndex += 1;
            const ext = (block.source.media_type || 'image/png').split('/')[1] || 'png';
            const filePath = path.join(tmpDir, `review-image-${imageIndex}.${ext}`);
            await writeFile(filePath, Buffer.from(block.source.data, 'base64'));
            imagePaths.push(filePath);
        }
    }

    let promptText = textParts.join('\n\n');
    if (imagePaths.length > 0) {
        promptText += `\n\n添付画像ファイル（必ず Read ツールで開いて内容を確認してから回答すること）:\n${imagePaths.map((p) => `- ${p}`).join('\n')}`;
    }

    return { promptText, hasImage: imagePaths.length > 0 };
}

export async function handleClaudeApi({ model, system, userText, tool, maxTokens }, { signal } = {}) {
    if (!tool || !tool.name || !tool.input_schema) {
        throw new Error('内部エラー: toolスキーマが指定されていません。');
    }

    const tmpDir = await mkdtemp(path.join(tmpdir(), 'pixel-animator-'));
    try {
        const { promptText, hasImage } = await buildPrompt(userText, tmpDir);

        const args = [
            '-p', promptText,
            '--output-format', 'json',
            '--json-schema', JSON.stringify(tool.input_schema),
            '--model', model,
            '--system-prompt', system,
            '--disable-slash-commands',
        ];

        if (hasImage) {
            args.push('--allowedTools', 'Read', '--add-dir', tmpDir, '--permission-mode', 'dontAsk');
        } else {
            args.push('--allowedTools', '');
        }

        let stdout;
        let stderr;
        try {
            ({ stdout, stderr } = await execFileAsync('claude', args, {
                cwd: PACKAGE_ROOT,
                timeout: CLI_TIMEOUT_MS,
                maxBuffer: MAX_BUFFER,
                signal,
            }));
        } catch (err) {
            if (err.name === 'AbortError' || signal?.aborted) {
                throw new Error('リクエストが中断されたため、claude CLIの呼び出しを中止しました。');
            }
            const friendly = friendlyError(err, err.stderr);
            if (friendly) throw friendly;
            throw new Error(`Claude CLIの呼び出しに失敗しました: ${(err.stderr || err.message || '').toString().slice(0, 500)}`);
        }

        let parsed;
        try {
            parsed = JSON.parse(stdout);
        } catch {
            throw new Error(`Claude CLIの出力を解析できませんでした: ${stdout.slice(0, 500)}`);
        }

        if (parsed.is_error) {
            throw new Error(`Claude CLIがエラーを返しました: ${parsed.result || stderr || '不明なエラー'}`);
        }

        let structuredOutput = parsed.structured_output;
        if (structuredOutput === undefined && typeof parsed.result === 'string') {
            try {
                structuredOutput = JSON.parse(parsed.result);
            } catch {
                throw new Error('Claude CLIの応答から構造化データを取得できませんでした。もう一度試してください。');
            }
        }
        if (structuredOutput === undefined) {
            throw new Error('Claude CLIの応答に構造化データが含まれていませんでした。');
        }

        return { content: [{ type: 'tool_use', name: tool.name, input: structuredOutput }] };
    } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
}

export async function checkClaudeCliHealth() {
    try {
        const { stdout } = await execFileAsync('claude', ['--version'], { timeout: 15000 });
        return { available: true, version: stdout.trim() };
    } catch (err) {
        const friendly = friendlyError(err, err.stderr);
        return { available: false, message: friendly ? friendly.message : (err.message || 'unknown error') };
    }
}
