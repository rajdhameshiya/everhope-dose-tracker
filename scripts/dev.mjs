import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const processes = [
  spawn(npm, ['run', 'dev', '--prefix', 'server'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: process.env.PORT || '3002' },
  }),
  spawn(npm, ['run', 'dev', '--prefix', 'client'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_API_URL: process.env.VITE_API_URL || 'http://localhost:3002',
    },
  }),
];

const stopAll = () => {
  for (const child of processes) {
    if (!child.killed) child.kill('SIGTERM');
  }
};

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});
