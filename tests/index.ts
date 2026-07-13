import { spawn } from 'node:child_process';

function post(url: string, data?: any) {
  return fetch(`http://127.0.0.1:20000/${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : '',
  })
    .then((v) => v.json())
    .catch((e) => {
      console.error(e);
      return null;
    });
}

const codew = spawn('codewhale', ['app-server', '--http', '--port', '20000'], {
  stdio: 'pipe',
});

const { promise: runtimeAPIPromise, resolve: resolveRuntimeAPI } = Promise.withResolvers<void>();

codew.stdout.on('data', (data: Buffer) => {
  const s = data.toString();

  console.log('来信了');
  console.log(s);

  if (s.includes('Runtime API listening')) {
    resolveRuntimeAPI();
  }
});

async function main() {
  await runtimeAPIPromise;
  post('v1/skills').then(console.log);
}

main();
