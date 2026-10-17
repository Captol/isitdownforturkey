const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const outPath = path.join(root, 'typecheck-results.txt');

try {
  const result = execSync('npm run typecheck', {
    cwd: root,
    encoding: 'utf-8',
    timeout: 90000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  fs.writeFileSync(outPath, 'EXIT_CODE:0\n' + result);
  process.exit(0);
} catch (e) {
  fs.writeFileSync(outPath, `EXIT_CODE:${e.status ?? 'error'}\n${e.stdout?.toString() ?? ''}\n---STDERR---\n${e.stderr?.toString() ?? e.message}`);
  process.exit(1);
}
