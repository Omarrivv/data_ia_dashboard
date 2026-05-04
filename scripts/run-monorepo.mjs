import { spawn } from 'node:child_process';

const mode = process.argv[2] === 'start' ? 'start' : 'dev';

const commands = mode === 'start'
  ? [
      { name: 'frontend', cwd: 'frontend', command: 'npm', args: ['start'] },
      { name: 'backend', cwd: 'backend', command: 'npm', args: ['start'] },
    ]
  : [
      { name: 'frontend', cwd: 'frontend', command: 'npm', args: ['run', 'dev'] },
      { name: 'backend', cwd: 'backend', command: 'npm', args: ['run', 'dev'] },
    ];

const children = [];
let exiting = false;

const shutdown = (code = 0) => {
  if (exiting) {
    return;
  }

  exiting = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  process.exit(code);
};

for (const entry of commands) {
  const child = spawn(entry.command, entry.args, {
    cwd: new URL(`../${entry.cwd}/`, import.meta.url),
    stdio: 'inherit',
    shell: true,
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (exiting) {
      return;
    }

    if (signal || code !== 0) {
      console.error(`\n${entry.name} exited with ${signal ? `signal ${signal}` : `code ${code}`}`);
      shutdown(code ?? 1);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
