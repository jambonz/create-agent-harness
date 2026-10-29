#!/usr/bin/env node
// npm create @jambonz/agent-harness@latest <directory>
'use strict';
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target || target.startsWith('-')) {
  console.error('Usage: npm create @jambonz/agent-harness@latest <directory>');
  process.exit(1);
}
const dest = path.resolve(process.cwd(), target);
if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0) {
  console.error(`${target} already exists and is not empty.`);
  process.exit(1);
}

fs.cpSync(path.join(__dirname, '..', 'template'), dest, { recursive: true });
// npm leaves .gitignore out of published packages, so the template carries it as "gitignore"
fs.renameSync(path.join(dest, 'gitignore'), path.join(dest, '.gitignore'));

const pkgFile = path.join(dest, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.name = path.basename(dest).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`
Created ${target}: a custom agent harness for jambonz.

  cd ${target}
  npm install
  cp .env.example .env      # add your OPENAI_API_KEY
  npm run dev               # listens on ws://localhost:8080

Your logic goes in src/agent.ts. The README explains how to reach it from
jambonz and how to set it up as a Custom harness agent in Agent Studio.
`);
