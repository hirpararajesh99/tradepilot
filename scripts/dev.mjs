import { spawn } from 'node:child_process';
import path from 'node:path';

const children = [
  spawn(
    process.execPath,
    [
      path.resolve('node_modules/tsx/dist/cli.mjs'),
      'watch',
      'src/backend/server.ts',
    ],
    { stdio: 'inherit' },
  ),
  spawn(
    process.execPath,
    [path.resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'],
    { stdio: 'inherit' },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => stop(code ?? 1));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
