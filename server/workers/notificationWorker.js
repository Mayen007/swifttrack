// server/workers/notificationWorker.js
// SwiftTrack Logistics — Stage 9: Background Notification Outbox Dispatch Worker
// PRD Section 7.13 & Section 14 (NTF-001..004): Outbox Processing Loop & Backoff Handling

const notificationService = require('../services/notificationService.js');

let workerTimer = null;
let isProcessing = false;

async function executeImmediateRun(batchSize = 25) {
    if (isProcessing) return { skipped: true, reason: 'Already processing' };
    try {
        isProcessing = true;
        const res = await notificationService.processOutboxBatch(batchSize);
        return res;
    } catch (err) {
        console.warn('[NotificationWorker] Execution error:', err.message);
        return { error: err.message };
    } finally {
        isProcessing = false;
    }
}

function startNotificationWorker(intervalMs = 15000) {
    if (workerTimer) return;

    workerTimer = setInterval(async () => {
        await executeImmediateRun();
    }, intervalMs);

    // Ensure timer doesn't block graceful Node process termination during tests
    if (workerTimer.unref) {
        workerTimer.unref();
    }

    console.log(`[NotificationWorker] Background notification outbox worker running (interval: ${intervalMs}ms)`);
}

function stopNotificationWorker() {
    if (workerTimer) {
        clearInterval(workerTimer);
        workerTimer = null;
        console.log('[NotificationWorker] Background notification worker stopped');
    }
}

module.exports = {
    startNotificationWorker,
    stopNotificationWorker,
    executeImmediateRun
};
