// scripts/capture-screenshots.js
// Automated visual screenshot capture for Design Review using Chrome DevTools Protocol (CDP)
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, '../.design/multi-branch-platform/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

class CDPClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.id = 0;
        this.callbacks = new Map();
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.onopen = () => resolve();
            this.ws.onerror = (e) => reject(e);
            this.ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id && this.callbacks.has(msg.id)) {
                    const { resolve, reject } = this.callbacks.get(msg.id);
                    this.callbacks.delete(msg.id);
                    if (msg.error) reject(msg.error);
                    else resolve(msg.result);
                }
            };
        });
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.id;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

async function capture() {
    console.log('📸 Starting automated design review screenshot capture...');

    // 1. Obtain admin token via API
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'superadmin', password: 'Password123!' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✔ Authenticated as Super Admin for visual review session');

    // 2. Launch headless Chrome with remote debugging
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp_design_review_'));
    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--no-sandbox',
        '--disable-gpu',
        '--window-size=1280,800',
        `--user-data-dir=${tempDir}`
    ], { stdio: 'ignore' });

    // Wait for Chrome debugging port to be ready
    let target = null;
    for (let i = 0; i < 20; i++) {
        await sleep(300);
        try {
            const listRes = await fetch('http://127.0.0.1:9222/json');
            const list = await listRes.json();
            if (list.length > 0) {
                target = list[0];
                break;
            }
        } catch {}
    }

    if (!target) {
        chrome.kill();
        throw new Error('Could not connect to Chrome debugging port');
    }

    console.log('✔ Connected to Chrome DevTools Protocol on port 9222');
    const cdp = new CDPClient(target.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    async function takeScreenshot(filename, width, height, fullPage = false) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: width <= 768
        });
        await sleep(600);
        const captureParams = { format: 'png' };
        if (fullPage) {
            captureParams.captureBeyondViewport = true;
        }
        const shot = await cdp.send('Page.captureScreenshot', captureParams);
        const buffer = Buffer.from(shot.data, 'base64');
        const outPath = path.join(SCREENSHOT_DIR, filename);
        fs.writeFileSync(outPath, buffer);
        console.log(`  📸 Saved: ${filename} (${width}x${height}, ${(buffer.length / 1024).toFixed(1)} KB)`);
    }

    async function setAppSession(theme = 'dark', branchId = '1') {
        await cdp.send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('swifttrack_token', '${token}');
                localStorage.setItem('swifttrack_theme', '${theme}');
                localStorage.setItem('swifttrack_selected_branch_id', '${branchId}');
                if ('${theme}' === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                }
            `
        });
    }

    try {
        // --- 1. Login View (Unauthenticated) ---
        console.log('\n--- Capturing Login View ---');
        await cdp.send('Runtime.evaluate', { expression: 'localStorage.clear();' });
        await cdp.send('Page.navigate', { url: 'http://localhost:5174' });
        await sleep(1500);
        await takeScreenshot('review-login-desktop-1280.png', 1280, 800);
        await takeScreenshot('review-login-tablet-768.png', 768, 1024);
        await takeScreenshot('review-login-mobile-375.png', 375, 812);

        // --- 2. Dashboard View (Dark Mode) ---
        console.log('\n--- Capturing Dashboard View (Dark Mode) ---');
        await setAppSession('dark', '1');
        await cdp.send('Page.navigate', { url: 'http://localhost:5174' });
        await sleep(2000);
        await takeScreenshot('review-dashboard-desktop-1280.png', 1280, 800);
        await takeScreenshot('review-dashboard-tablet-768.png', 768, 1024);
        await takeScreenshot('review-dashboard-mobile-375.png', 375, 812);

        // --- 3. Dashboard View (Light Mode) ---
        console.log('\n--- Capturing Dashboard View (Light Mode) ---');
        await setAppSession('light', '1');
        await cdp.send('Page.navigate', { url: 'http://localhost:5174' });
        await sleep(2000);
        await takeScreenshot('review-dashboard-light-desktop-1280.png', 1280, 800);
        await takeScreenshot('review-dashboard-light-tablet-768.png', 768, 1024);
        await takeScreenshot('review-dashboard-light-mobile-375.png', 375, 812);

        // --- 4. POS Register View ---
        console.log('\n--- Capturing POS Register View ---');
        await setAppSession('dark', '1');
        await cdp.send('Runtime.evaluate', {
            expression: `
                const posBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Cashier POS') || el.textContent.includes('POS'));
                if (posBtn) posBtn.click();
            `
        });
        await sleep(1500);
        await takeScreenshot('review-pos-desktop-1280.png', 1280, 800);
        await takeScreenshot('review-pos-mobile-375.png', 375, 812);

        // --- 5. Dispatch Kanban Board ---
        console.log('\n--- Capturing Dispatch Board View ---');
        await cdp.send('Runtime.evaluate', {
            expression: `
                const dspBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Dispatch') || el.textContent.includes('Logistics'));
                if (dspBtn) dspBtn.click();
            `
        });
        await sleep(1500);
        await takeScreenshot('review-dispatch-desktop-1280.png', 1280, 800);

        // --- 6. Reports & PnL View ---
        console.log('\n--- Capturing Reports & P&L View ---');
        await cdp.send('Runtime.evaluate', {
            expression: `
                const rptBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Reports') || el.textContent.includes('Analytics'));
                if (rptBtn) rptBtn.click();
            `
        });
        await sleep(1500);
        await takeScreenshot('review-reports-desktop-1280.png', 1280, 800);

        // --- 7. Inventory Matrix ---
        console.log('\n--- Capturing Inventory View ---');
        await cdp.send('Runtime.evaluate', {
            expression: `
                const invBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Inventory') || el.textContent.includes('Stock'));
                if (invBtn) invBtn.click();
            `
        });
        await sleep(1500);
        await takeScreenshot('review-inventory-desktop-1280.png', 1280, 800);

        console.log('\n🎉 ALL SCREENSHOTS SUCCESSFULLY CAPTURED IN .design/multi-branch-platform/screenshots/');
    } finally {
        cdp.close();
        chrome.kill();
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
    }
}

capture().catch(err => {
    console.error('Capture error:', err);
    process.exit(1);
});
