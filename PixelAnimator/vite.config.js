import { defineConfig } from 'vite';
import { handleClaudeApi, checkClaudeCliHealth } from './server/claudeApi.js';

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

// ローカルの Claude Code CLI（サブスクリプション認証）を叩くためのAPIを、
// Vite開発サーバーのミドルウェアとして生やすプラグイン。
// ブラウザからは同一オリジンの /api/claude, /api/claude/health として見える。
function claudeCliProxyPlugin() {
    return {
        name: 'pixel-animator-claude-cli-proxy',
        configureServer(server) {
            server.middlewares.use('/api/claude/health', async (req, res) => {
                const health = await checkClaudeCliHealth();
                res.setHeader('content-type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify(health));
            });

            server.middlewares.use('/api/claude', async (req, res) => {
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end('Method Not Allowed');
                    return;
                }
                try {
                    const payload = await readJsonBody(req);
                    const result = await handleClaudeApi(payload);
                    res.setHeader('content-type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify(result));
                } catch (err) {
                    res.setHeader('content-type', 'application/json');
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message || String(err) }));
                }
            });
        },
    };
}

export default defineConfig({
    plugins: [claudeCliProxyPlugin()],
});
