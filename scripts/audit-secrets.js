// scripts/audit-secrets.js
// Automated Secrets & Credential Leak Scanner
const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = [
    { name: 'Private Key Header', regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
    { name: 'AWS Access Key ID', regex: /\b(AKIA[0-9A-Z]{16})\b/ },
    { name: 'Stripe Live Secret Key', regex: /\bsk_live_[0-9a-zA-Z]{24}\b/ },
    { name: 'Google API Key', regex: /\bAIza[0-9A-Za-z\\-_]{35}\b/ },
    { name: 'GitHub Personal Access Token', regex: /\bghp_[0-9a-zA-Z]{36}\b/ },
    { name: 'Slack Bot Token', regex: /\bxoxb-[0-9]{11}-[0-9]{11}-[0-9a-zA-Z]{24}\b/ },
];

const IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'backups',
    '.tempmediaStorage',
    '.system_generated'
]);

function scanDirectory(dir, findings = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.gitignore') {
            continue;
        }
        if (IGNORE_DIRS.has(entry.name)) {
            continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            scanDirectory(fullPath, findings);
        } else if (entry.isFile()) {
            // Skip binary or large files
            if (/\.(png|jpg|jpeg|gif|ico|db|sqlite|tar|gz|zip|pdf|woff|woff2|ttf)$/i.test(entry.name)) {
                continue;
            }

            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

                // Check for patterns
                for (const pattern of SECRET_PATTERNS) {
                    const match = content.match(pattern.regex);
                    if (match) {
                        findings.push({
                            file: relPath,
                            pattern: pattern.name,
                            match: match[0].substring(0, 8) + '...'
                        });
                    }
                }
            } catch (err) {
                // Ignore unreadable files
            }
        }
    }

    return findings;
}

function runSecretsAudit() {
    console.log('============================================================');
    console.log('🔍 SWIFTTRACK SECURITY: SECRETS & CREDENTIALS AUDIT');
    console.log('============================================================\n');

    // 1. Verify .gitignore protects sensitive assets
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    
    const requiredIgnores = ['.env', 'backups/', '*.db', 'node_modules'];
    const missingIgnores = requiredIgnores.filter(rule => !gitignoreContent.includes(rule));

    if (missingIgnores.length > 0) {
        console.error(`❌ [FAIL] .gitignore is missing critical protection rules: ${missingIgnores.join(', ')}`);
        process.exit(1);
    } else {
        console.log('✔ [PASS] .gitignore strictly protects .env, backups, and database artifacts');
    }

    // 2. Scan workspace files for hardcoded private keys or production credentials
    const findings = scanDirectory(process.cwd());

    if (findings.length > 0) {
        console.error(`❌ [FAIL] Found ${findings.length} suspected credential / secret leak(s):`);
        console.table(findings);
        process.exit(1);
    } else {
        console.log('✔ [PASS] Codebase clean: 0 private keys or production credential tokens leaked');
    }

    // 3. Verify .env.example contains only dummy placeholder tokens
    const envExamplePath = path.join(process.cwd(), '.env.example');
    if (fs.existsSync(envExamplePath)) {
        const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
        if (exampleContent.includes('sk_live') || exampleContent.includes('AKIA')) {
            console.error('❌ [FAIL] .env.example contains live credential tokens!');
            process.exit(1);
        }
        console.log('✔ [PASS] .env.example contains only non-sensitive templates');
    }

    console.log('\n============================================================');
    console.log('🎉 SECRETS & CREDENTIAL AUDIT PASSED (100% COMPLIANT)');
    console.log('============================================================');
}

if (require.main === module) {
    runSecretsAudit();
}

module.exports = { runSecretsAudit };
