import fs from 'node:fs';
import path from 'node:path';

const source = 'node_modules/@simplewebauthn/browser/esm';
const target = 'vendor/simplewebauthn';
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });
