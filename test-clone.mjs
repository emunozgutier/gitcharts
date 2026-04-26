import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.js';
import fs from 'fs';

// Node 22 ESM polyfill for isomorphic git
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const gitCommonJS = require('isomorphic-git');
const httpCommonJS = require('isomorphic-git/http/node');

const dir = '/tmp/pcb-test';
if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);

gitCommonJS.clone({
  fs,
  http: httpCommonJS,
  dir,
  url: 'https://github.com/emunozgutier/PCBReworkTracker',
  depth: 100,
  singleBranch: true
}).then(() => {
  console.log('success');
  return gitCommonJS.log({ fs, dir });
}).then((logs) => {
  console.log('log count', logs.length);
}).catch(e => console.error('error', e));
