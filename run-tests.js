// Run vitest and capture output to file
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname);
const vitestBin = path.join(root, 'node_modules', '.bin', 'vitest');

try {
  const result = execSync(`node "${vitestBin}" run --reporter=verbose`, {
    cwd: root,
    encoding: 'utf-8',
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  fs.writeFileSync(path.join(root, 'test-output.txt'), result);
  console.log('TESTS_DONE');
} catch (e) {
  fs.writeFileSync(path.join(root, 'test-output.txt'), e.stdout?.toString() ?? '' + '\n---ERROR---\n' + (e.stderr?.toString() ?? e.message));
  console.log('TESTS_FAILED');
}
