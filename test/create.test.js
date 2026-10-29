'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const bin = path.join(__dirname, '..', 'bin', 'index.js');
const run = (cwd, ...args) => execFileSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });

test('creates the project, with .gitignore and the package named for the directory', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cah-'));
  const out = run(cwd, 'My Agent');
  const dest = path.join(cwd, 'My Agent');
  for (const f of ['package.json', 'tsconfig.json', '.gitignore', '.env.example', 'Dockerfile', 'README.md',
    'src/index.ts', 'src/agent.ts', 'test/agent.test.ts']) {
    assert.ok(fs.existsSync(path.join(dest, f)), `${f} is created`);
  }
  assert.ok(!fs.existsSync(path.join(dest, 'gitignore')), 'gitignore is renamed to .gitignore');
  const pkg = JSON.parse(fs.readFileSync(path.join(dest, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.name, 'my-agent');
  assert.match(pkg.dependencies['@jambonz/sdk'], /^\^0\.\d+\.\d+/);
  assert.match(out, /cd My Agent/);
});

test('refuses a directory that is not empty, and no directory at all', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cah-'));
  fs.mkdirSync(path.join(cwd, 'taken'));
  fs.writeFileSync(path.join(cwd, 'taken', 'x'), '');
  assert.throws(() => run(cwd, 'taken'), /not empty/);
  assert.throws(() => run(cwd), /Usage/);
});
