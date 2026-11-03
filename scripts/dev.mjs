// `npm run dev`: starts the API and the web app together, with labelled output.
// Ctrl+C stops both.
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync('.env')) {
  console.error('No .env file yet. Run `npm run setup` first.');
  process.exit(1);
}

const tasks = [
  { name: 'api', color: 36, script: 'dev:api' },
  { name: 'web', color: 35, script: 'dev:web' },
];

const children = tasks.map(({ name, color, script }) => {
  const child = spawn(`npm run ${script}`, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const label = `\x1b[${color}m[${name}]\x1b[0m `;
  const relay = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const line of lines) out.write(label + line + '\n');
    });
  };
  relay(child.stdout, process.stdout);
  relay(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${label}stopped${code ? ` (exit ${code})` : ''}`);
    stopAll();
  });
  return child;
});

console.log('Starting Motion Mind. Open http://localhost:5173 once the web app is ready. Ctrl+C stops everything.');

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode !== null || !c.pid) continue;
    // npm runs each task in a shell; on Windows the whole process tree must be killed.
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        /* already gone */
      }
    } else c.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
