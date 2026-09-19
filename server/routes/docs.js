// server/routes/docs.js
// Interactive OpenAPI 3.1 Documentation & Specification Route
const express = require('express');
const router = express.Router();
const path = require('node:path');
const fs = require('node:fs');

const OPENAPI_PATH = path.resolve(__dirname, '../docs/openapi.json');

// GET /api/v1/openapi.json & /api/openapi.json
router.get('/openapi.json', (req, res) => {
    if (fs.existsSync(OPENAPI_PATH)) {
        res.sendFile(OPENAPI_PATH);
    } else {
        res.status(404).json({ error: 'OpenAPI specification document not found' });
    }
});

// GET /api/v1/docs & /api/docs - Interactive API Explorer
router.get(['/', '/docs'], (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SwiftTrack Kenya — OpenAPI 3.1 Interactive Documentation</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0c0e12;
            --bg-secondary: #13171f;
            --bg-tertiary: #1b202c;
            --border-subtle: #262d3d;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-blue: #3b82f6;
            --accent-emerald: #10b981;
            --accent-amber: #f59e0b;
            --accent-rose: #ef4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 32px 24px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        header {
            border-bottom: 1px solid var(--border-subtle);
            padding-bottom: 24px;
            margin-bottom: 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .badge {
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
            font-family: 'JetBrains Mono', monospace;
        }
        .btn-raw {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-subtle);
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }
        .btn-raw:hover {
            border-color: var(--accent-blue);
            color: var(--accent-blue);
        }
        .hero {
            background: var(--bg-secondary);
            border: 1px solid var(--border-subtle);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
        }
        .hero h2 { font-size: 18px; margin-bottom: 8px; color: var(--text-primary); }
        .hero p { color: var(--text-secondary); font-size: 14px; margin-bottom: 16px; }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
        }
        .meta-card {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-subtle);
            padding: 12px 16px;
            border-radius: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
        }
        .meta-card .label { color: var(--text-secondary); font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
        .meta-card .val { color: #38bdf8; font-weight: 600; }
        .section-title {
            font-size: 20px;
            font-weight: 700;
            margin: 32px 0 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .endpoint-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            margin-bottom: 12px;
            overflow: hidden;
            transition: border-color 0.2s;
        }
        .endpoint-card:hover { border-color: #3b82f6; }
        .endpoint-header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            gap: 16px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
        }
        .method {
            padding: 4px 10px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 11px;
            min-width: 60px;
            text-align: center;
        }
        .method-get { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .method-post { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
        .method-put { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
        .method-delete { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .path { color: var(--text-primary); font-weight: 600; flex: 1; }
        .desc { color: var(--text-secondary); font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="brand">
                <h1 style="font-size: 22px; font-weight: 700;">SwiftTrack Kenya API</h1>
                <span class="badge">OpenAPI 3.1.0</span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.3);">v1.4 Production</span>
            </div>
            <a href="/api/v1/openapi.json" class="btn-raw" target="_blank">
                <span>View Raw OpenAPI JSON</span> ↗
            </a>
        </header>

        <div class="hero">
            <h2>Enterprise Multi-Branch Logistics & Retail POS Platform API</h2>
            <p>Authoritative REST interface supporting standard response envelopes, request correlation IDs, tiered rate limits, idempotency keys, and strict Kenyan fiscal VAT calculations.</p>
            <div class="meta-grid">
                <div class="meta-card">
                    <div class="label">Primary Base URL</div>
                    <div class="val">/api/v1</div>
                </div>
                <div class="meta-card">
                    <div class="label">Backward Compatible Alias</div>
                    <div class="val">/api</div>
                </div>
                <div class="meta-card">
                    <div class="label">Authentication</div>
                    <div class="val">Bearer JWT (15-min rotation)</div>
                </div>
                <div class="meta-card">
                    <div class="label">Idempotency Header</div>
                    <div class="val">Idempotency-Key</div>
                </div>
            </div>
        </div>

        <h3 class="section-title">Core Endpoints</h3>

        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/auth/login</span>
                <span class="desc">Authenticate operator and issue access + refresh tokens</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/auth/refresh</span>
                <span class="desc">Rotate refresh token and issue new 15-minute access token</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/auth/logout</span>
                <span class="desc">Blacklist token JTI and terminate active device session</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/products</span>
                <span class="desc">Search catalog with pagination, price sorting, and stock levels</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/pos/checkout</span>
                <span class="desc">Process retail counter sale with KRA 16% VAT and M-Pesa STK push</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/inventory</span>
                <span class="desc">Branch-scoped multi-warehouse stock balances and low stock alerts</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/inventory/transfers</span>
                <span class="desc">Initiate inter-branch stock transfer manifest</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/dispatch/board</span>
                <span class="desc">Real-time delivery Kanban pipeline and driver assignments</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/deliveries/{id}/pod</span>
                <span class="desc">Submit digital Proof of Delivery with OTP, signature, and GPS</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/refunds/request</span>
                <span class="desc">Submit customer refund request into dual-control approval queue</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/reports/vat</span>
                <span class="desc">Statutory KRA 16% Fiscal Output VAT turnover breakdown</span>
            </div>
        </div>
        <div class="endpoint-card">
            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/audit</span>
                <span class="desc">Query immutable append-only audit trail with role and date filters</span>
            </div>
        </div>
    </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

module.exports = router;
