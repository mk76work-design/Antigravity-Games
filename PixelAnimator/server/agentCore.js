// server/agentCore.js — Node（ブラウザなし）でAIエージェントが直接ドット絵アニメーションを
// 生成・自己検証・自己修正するためのアダプタ。
//
// core.js（環境非依存の本体ロジック）に、
//   - callClaude: handleClaudeApi() をHTTPを介さずインプロセスで直接呼ぶ実装
//   - renderReviewImage: pngjs でCanvas無しにレビュー用画像を組み立てる実装
// を注入する。ブラウザ版（aiClient.js）と全く同じ自己チェックロジック・品質ルールを
// 共有しつつ、`npm run dev` でVite開発サーバーを起動する必要すらなく動く。

import * as core from '../core.js';
import { handleClaudeApi } from './claudeApi.js';
import { renderReviewImageBase64 } from './pngRender.js';

export async function generateWithSelfCheck({ model = core.DEFAULT_MODEL, ...params }) {
    const callClaude = ({ system, userText, tool, maxTokens = 16000 }) =>
        handleClaudeApi({ model, system, userText, tool, maxTokens }).then((res) => {
            const toolUse = res.content?.find((block) => block.type === 'tool_use' && block.name === tool.name);
            if (!toolUse) {
                throw new Error('AIエージェントの応答から構造化データを取得できませんでした。もう一度試してください。');
            }
            return toolUse.input;
        });

    return core.generateWithSelfCheck({
        ...params,
        callClaude,
        renderReviewImage: renderReviewImageBase64,
    });
}
