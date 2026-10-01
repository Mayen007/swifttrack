#!/usr/bin/env node
/**
 * tests/docs/test-api-doc-parity.js
 * 
 * CI-enforced documentation parity verification.
 * 
 * Invariants:
 * 1. REALITY WINS: Express route stack is the single source of truth.
 * 2. Every documented endpoint in `docs/API.md` MUST exist in the live Express router.
 * 3. Every endpoint in `server/docs/openapi.json` MUST exist in the live Express router.
 * 4. Undocumented routes are flagged with warnings so coverage gaps remain visible.
 */

const path = require('node:path');
const fs = require('node:fs');
const { extractAllRoutes, normalizePath } = require('../../scripts/extract-routes.js');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const API_DOC_PATH = path.resolve(PROJECT_ROOT, 'docs/API.md');
const OPENAPI_PATH = path.resolve(PROJECT_ROOT, 'server/docs/openapi.json');

// Color helpers for terminal reporting
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

/**
 * Normalizes an API path for parameter-agnostic pattern matching.
 * Replaces both `:param` (Express) and `{param}` (OpenAPI) with a generic `{param}` token.
 */
function normalizeParamTokens(apiPath) {
    return apiPath
        .replace(/:[a-zA-Z0-9_]+/g, '{param}')
        .replace(/\{[a-zA-Z0-9_]+\}/g, '{param}');
}

/**
 * Parses all documented endpoints from docs/API.md.
 */
function parseDocEndpoints(markdownContent) {
    const endpoints = [];
    const lines = markdownContent.split('\n');

    // Matches `GET /api/v1/...` or GET `/api/v1/...` or `GET /api/v1/...` in code blocks/headings
    const regex = /(?:`?)(GET|POST|PUT|PATCH|DELETE)\s+`?(\/api\/v1[^\s`\?]+)(?:\?[^`\s]*)?`?/;

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        const match = trimmed.match(regex);
        if (match) {
            const method = match[1].toUpperCase();
            // Clean trailing backticks, slashes, or markdown artifacts
            let cleanPath = match[2].replace(/[`\s]+$/, '');
            if (cleanPath.endsWith('/') && cleanPath.length > 1) {
                cleanPath = cleanPath.slice(0, -1);
            }

            endpoints.push({
                method,
                path: cleanPath,
                line: idx + 1,
                raw: `${method} ${cleanPath}`
            });
        }
    });

    // Deduplicate
    const seen = new Set();
    const unique = [];
    for (const ep of endpoints) {
        const key = `${ep.method} ${ep.path}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(ep);
        }
    }

    return unique;
}

/**
 * Parses all endpoints defined in server/docs/openapi.json.
 */
function parseOpenApiEndpoints(openapiContent) {
    const endpoints = [];
    const openapi = typeof openapiContent === 'string' ? JSON.parse(openapiContent) : openapiContent;

    if (!openapi.paths) return endpoints;

    for (const [subPath, methods] of Object.entries(openapi.paths)) {
        for (const [method, spec] of Object.entries(methods)) {
            if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
                const fullPath = normalizePath('/api/v1', subPath);
                endpoints.push({
                    method: method.toUpperCase(),
                    path: fullPath,
                    summary: spec.summary || '',
                    raw: `${method.toUpperCase()} ${fullPath}`
                });
            }
        }
    }

    return endpoints;
}

/**
 * Main verification routine.
 */
function runParityVerification() {
    console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
    console.log(`${colors.bright}  SwiftTrack API Documentation Parity Verification${colors.reset}`);
    console.log(`${colors.cyan}====================================================${colors.reset}\n`);

    // 1. Extract live routes
    const liveRoutes = extractAllRoutes();
    console.log(`[1/3] Extracted ${colors.bright}${liveRoutes.length}${colors.reset} live routes from Express stack.`);

    // Build lookup sets for live routes (exact and normalized parameter matchers)
    const exactLiveSet = new Set(liveRoutes.map(r => `${r.method} ${r.path}`));
    const tokenNormalizedLiveMap = new Map();

    for (const r of liveRoutes) {
        const normKey = `${r.method} ${normalizeParamTokens(r.path)}`;
        if (!tokenNormalizedLiveMap.has(normKey)) {
            tokenNormalizedLiveMap.set(normKey, r);
        }
    }

    function routeExistsInExpress(method, routePath) {
        const exactKey = `${method} ${routePath}`;
        if (exactLiveSet.has(exactKey)) {
            return { exists: true, match: exactKey, type: 'EXACT' };
        }
        const normKey = `${method} ${normalizeParamTokens(routePath)}`;
        if (tokenNormalizedLiveMap.has(normKey)) {
            const matched = tokenNormalizedLiveMap.get(normKey);
            return { exists: true, match: `${matched.method} ${matched.path}`, type: 'PARAM_PATTERN' };
        }
        return { exists: false };
    }

    // 2. Validate docs/API.md
    if (!fs.existsSync(API_DOC_PATH)) {
        console.error(`${colors.red}Error: docs/API.md not found at ${API_DOC_PATH}${colors.reset}`);
        process.exit(1);
    }

    const docContent = fs.readFileSync(API_DOC_PATH, 'utf8');
    const documentedEndpoints = parseDocEndpoints(docContent);
    console.log(`[2/3] Checking ${colors.bright}${documentedEndpoints.length}${colors.reset} endpoints in docs/API.md...`);

    const apiDocFailures = [];
    const documentedMatchedKeys = new Set();

    for (const ep of documentedEndpoints) {
        const check = routeExistsInExpress(ep.method, ep.path);
        if (!check.exists) {
            apiDocFailures.push(ep);
        } else {
            documentedMatchedKeys.add(check.match);
        }
    }

    // 3. Validate server/docs/openapi.json
    let openapiFailures = [];
    if (fs.existsSync(OPENAPI_PATH)) {
        const openapiRaw = fs.readFileSync(OPENAPI_PATH, 'utf8');
        const openapiEndpoints = parseOpenApiEndpoints(openapiRaw);
        console.log(`[3/3] Checking ${colors.bright}${openapiEndpoints.length}${colors.reset} endpoints in server/docs/openapi.json...`);

        for (const ep of openapiEndpoints) {
            const check = routeExistsInExpress(ep.method, ep.path);
            if (!check.exists) {
                openapiFailures.push(ep);
            } else {
                documentedMatchedKeys.add(check.match);
            }
        }
    } else {
        console.warn(`${colors.yellow}Warning: server/docs/openapi.json not found${colors.reset}`);
    }

    // Report Discrepancies
    let hasErrors = false;

    if (apiDocFailures.length > 0) {
        hasErrors = true;
        console.error(`\n${colors.red}${colors.bright}❌ PARITY FAILURE: ${apiDocFailures.length} documented endpoints in docs/API.md do not exist in Express:${colors.reset}`);
        for (const fail of apiDocFailures) {
            console.error(`  - [Line ${fail.line}] ${colors.red}${fail.raw}${colors.reset} (No matching Express route)`);
        }
    }

    if (openapiFailures.length > 0) {
        hasErrors = true;
        console.error(`\n${colors.red}${colors.bright}❌ PARITY FAILURE: ${openapiFailures.length} endpoints in openapi.json do not exist in Express:${colors.reset}`);
        for (const fail of openapiFailures) {
            console.error(`  - ${colors.red}${fail.raw}${colors.reset} (${fail.summary})`);
        }
    }

    if (!hasErrors) {
        console.log(`\n${colors.green}${colors.bright}✔ All documented endpoints in docs/API.md exist in the live Express router.${colors.reset}`);
        console.log(`${colors.green}${colors.bright}✔ All OpenAPI paths in server/docs/openapi.json exist in the live Express router.${colors.reset}`);
    }

    // Coverage Analysis (Informational Warnings)
    const undocumentedRoutes = liveRoutes.filter(r => !documentedMatchedKeys.has(`${r.method} ${r.path}`));
    const coveragePercent = (((liveRoutes.length - undocumentedRoutes.length) / liveRoutes.length) * 100).toFixed(1);

    console.log(`\n${colors.bright}Documentation Coverage Statistics:${colors.reset}`);
    console.log(`  - Total Live Express Endpoints: ${liveRoutes.length}`);
    console.log(`  - Documented Endpoints (Active): ${liveRoutes.length - undocumentedRoutes.length}`);
    console.log(`  - Coverage Ratio: ${colors.cyan}${coveragePercent}%${colors.reset}`);
    console.log(`  - Undocumented Routes: ${colors.yellow}${undocumentedRoutes.length}${colors.reset} (Documented under OpenAPI / Domain scope)`);

    if (undocumentedRoutes.length > 0 && process.env.VERBOSE_DOC_COVERAGE) {
        console.log(`\n${colors.yellow}Undocumented Route Groups / Endpoints:${colors.reset}`);
        undocumentedRoutes.slice(0, 20).forEach(r => {
            console.log(`  - ${r.method.padEnd(6)} ${r.path.padEnd(45)} ${colors.gray}(${r.source})${colors.reset}`);
        });
        if (undocumentedRoutes.length > 20) {
            console.log(`  ... and ${undocumentedRoutes.length - 20} more routes.`);
        }
    }

    if (hasErrors) {
        console.error(`\n${colors.red}${colors.bright}CI Check Failed: Fix documented endpoints to match reality.${colors.reset}\n`);
        process.exit(1);
    } else {
        console.log(`\n${colors.green}${colors.bright}CI Documentation Parity Check PASSED.${colors.reset}\n`);
        process.exit(0);
    }
}

if (require.main === module) {
    runParityVerification();
}

module.exports = {
    runParityVerification,
    parseDocEndpoints,
    parseOpenApiEndpoints
};
