#!/usr/bin/env node
/**
 * scripts/extract-routes.js
 * Programmatically extracts all registered API endpoints from the Express router stack.
 *
 * Single Source of Truth:
 * Reality wins. This script introspects the live Express 5 / Router 2.x stack
 * starting from server/routes/v1/index.js and resolves every mounted sub-router,
 * capturing the HTTP method, normalized mount path, source file, and line number.
 */

const path = require('node:path');
const fs = require('node:fs');
const { METHODS } = require('node:http');

const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Patch Router and Route prototypes to record mount paths and caller source locations.
 * Must run before requiring server/routes/v1/index.js.
 */
function setupRouterInstrumentation() {
    const Router = require('router');
    const Route = require('router/lib/route.js');

    // Intercept router.use to record mount prefix on each created layer
    if (!Router.prototype.__origUse) {
        Router.prototype.__origUse = Router.prototype.use;
        Router.prototype.use = function(pathArg, ...fns) {
            const hasPath = (typeof pathArg === 'string' || Array.isArray(pathArg) || pathArg instanceof RegExp);
            const mountPath = hasPath ? pathArg : '/';
            const beforeLen = this.stack ? this.stack.length : 0;
            const res = Router.prototype.__origUse.apply(this, arguments);
            const afterLen = this.stack ? this.stack.length : 0;

            for (let i = beforeLen; i < afterLen; i++) {
                if (this.stack[i]) {
                    this.stack[i].__mountPath = mountPath;
                }
            }
            return res;
        };
    }

    // Intercept router.route to record route path on the layer
    if (!Router.prototype.__origRoute) {
        Router.prototype.__origRoute = Router.prototype.route;
        Router.prototype.route = function(pathArg) {
            const route = Router.prototype.__origRoute.apply(this, arguments);
            if (this.stack && this.stack.length > 0) {
                const layer = this.stack[this.stack.length - 1];
                if (layer) {
                    layer.__mountPath = pathArg;
                }
            }
            return route;
        };
    }

    // Intercept Route method verbs to capture caller source file & line
    const httpMethods = METHODS.map(m => m.toLowerCase()).concat('all');
    httpMethods.forEach(method => {
        if (Route.prototype[method] && !Route.prototype['__orig_' + method]) {
            const orig = Route.prototype[method];
            Route.prototype['__orig_' + method] = orig;
            Route.prototype[method] = function(...handlers) {
                if (!this.__sources) {
                    this.__sources = {};
                }
                const err = new Error();
                const callerLine = (err.stack || '')
                    .split('\n')
                    .slice(1)
                    .find(line =>
                        !line.includes('node_modules') &&
                        !line.includes('node:internal') &&
                        !line.includes('scripts' + path.sep + 'extract-routes.js') &&
                        !line.includes('scripts/extract-routes.js')
                    );

                if (callerLine) {
                    const match = callerLine.match(/\((.*?):(\d+):(\d+)\)/) || callerLine.match(/at (.*?):(\d+):(\d+)/);
                    if (match) {
                        const rawFile = match[1];
                        const lineNum = parseInt(match[2], 10);
                        const relFile = path.relative(PROJECT_ROOT, rawFile).replace(/\\/g, '/');
                        this.__sources[method.toUpperCase()] = {
                            file: relFile,
                            line: lineNum,
                            loc: `${relFile}:${lineNum}`
                        };
                    }
                }

                return orig.apply(this, handlers);
            };
        }
    });
}

/**
 * Normalizes combined URL path segments.
 */
function normalizePath(...parts) {
    const combined = parts
        .flat()
        .map(p => {
            if (typeof p === 'string') return p.trim();
            if (p instanceof RegExp) return p.source;
            return '';
        })
        .filter(Boolean)
        .join('/');

    const cleaned = '/' + combined.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
    return cleaned === '' ? '/' : cleaned;
}

/**
 * Recursively walks the Express/router stack and collects all endpoints.
 */
function walkRouter(router, basePath = '') {
    const routes = [];
    if (!router || !router.stack) return routes;

    for (const layer of router.stack) {
        const mount = layer.__mountPath || '/';
        const mountPaths = Array.isArray(mount) ? mount : [mount];

        for (const mPath of mountPaths) {
            // Case 1: Route endpoint (layer.route is defined)
            if (layer.route) {
                const subPath = typeof layer.route.path === 'string'
                    ? layer.route.path
                    : (layer.route.path instanceof RegExp ? layer.route.path.source : '');

                const fullPath = normalizePath(basePath, subPath);
                const methods = Object.keys(layer.route.methods || {})
                    .filter(m => layer.route.methods[m])
                    .map(m => m === '_all' ? 'ALL' : m.toUpperCase());

                for (const method of methods) {
                    const srcInfo = (layer.route.__sources && layer.route.__sources[method]) || null;
                    routes.push({
                        method,
                        path: fullPath,
                        sourceFile: srcInfo ? srcInfo.file : '',
                        sourceLine: srcInfo ? srcInfo.line : 0,
                        source: srcInfo ? srcInfo.loc : ''
                    });
                }
            }
            // Case 2: Sub-router mounted via router.use(prefix, subRouter)
            else if (layer.handle && layer.handle.stack) {
                const prefixStr = typeof mPath === 'string'
                    ? mPath
                    : (mPath instanceof RegExp ? mPath.source : '');
                const nextBase = normalizePath(basePath, prefixStr);
                routes.push(...walkRouter(layer.handle, nextBase));
            }
        }
    }

    return routes;
}

/**
 * Main extractor function that loads the v1Router and returns normalized, deduplicated routes.
 */
function extractAllRoutes(options = {}) {
    setupRouterInstrumentation();

    const routerPath = options.routerPath || path.resolve(PROJECT_ROOT, 'server/routes/v1/index.js');
    const basePrefix = options.basePrefix !== undefined ? options.basePrefix : '/api/v1';

    // Clear module cache for router so instrumentation takes full effect
    try {
        delete require.cache[require.resolve(routerPath)];
    } catch {}

    const v1Router = require(routerPath);
    const rawRoutes = walkRouter(v1Router, basePrefix);

    // Deduplicate identical method + path combinations
    const seen = new Set();
    const uniqueRoutes = [];

    for (const r of rawRoutes) {
        const key = `${r.method} ${r.path}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueRoutes.push(r);
        }
    }

    // Sort deterministically by path then method
    uniqueRoutes.sort((a, b) => {
        if (a.path !== b.path) {
            return a.path.localeCompare(b.path);
        }
        return a.method.localeCompare(b.method);
    });

    return uniqueRoutes;
}

// CLI Execution support
if (require.main === module) {
    const args = process.argv.slice(2);
    const writeJson = args.includes('--write') || args.includes('-w');
    const outputFile = args.find(a => a.startsWith('--out='))?.split('=')[1] || path.resolve(PROJECT_ROOT, 'docs/routes.json');

    const routes = extractAllRoutes();

    if (writeJson) {
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
        fs.writeFileSync(outputFile, JSON.stringify(routes, null, 2), 'utf8');
        console.log(`[extract-routes] Extracted ${routes.length} unique routes to ${path.relative(PROJECT_ROOT, outputFile)}`);
    } else {
        console.log(JSON.stringify(routes, null, 2));
    }
}

module.exports = {
    extractAllRoutes,
    normalizePath
};
