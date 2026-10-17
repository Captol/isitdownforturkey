// Test runner script — runs vitest and writes results to test-results.txt
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const outPath = path.join(root, 'test-results.txt');

try {
  const result = execSync('npx vitest run --reporter=verbose', {
    cwd: root,
    encoding: 'utf-8',
    timeout: 120000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  fs.writeFileSync(outPath, 'EXIT_CODE:0\n' + result);
  console.log(result);
  process.exit(0);
} catch (e) {
  const output = `EXIT_CODE:${e.status ?? 'error'}\n${e.stdout?.toString() ?? ''}\n---STDERR---\n${e.stderr?.toString() ?? e.message}`;
  fs.writeFileSync(outPath, output);
  console.error(output);
  process.exit(1);
}
