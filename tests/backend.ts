import { spawn } from 'node:child_process';

export function createBackend(AUTH_TOKEN: string) {
  const proc = spawn('codewhale', ['app-server', '--http', '--port', '20000', '--auth-token', AUTH_TOKEN], {
    stdio: 'pipe',
    detached: true, // ! This is necessary to allow killing the process and its children later
  });

  const { promise, resolve: resolveRuntimeAPI } = Promise.withResolvers<void>();

  proc.stdout.on('data', (data: Buffer) => {
    const s = data.toString();

    console.log('来信了');
    console.log(s);

    if (s.includes('Runtime API listening')) {
      resolveRuntimeAPI();
    }
  });

  proc.stderr.on('data', (data: Buffer) => {
    console.error('后端报错了');
    console.error(data.toString());
  });

  proc.on('close', (code) => console.log(`close，退出码 ${code}`));

  return promise.then(() => proc);
}
