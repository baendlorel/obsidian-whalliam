import { spawn } from 'node:child_process';
import { AUTH_TOKEN } from './.env.js';

function post(url: string, data?: any) {
  return fetch(`http://127.0.0.1:20000/${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: data ? JSON.stringify(data) : '{}',
  })
    .then((v) => v.json())
    .catch((e) => {
      console.error('post后端出错', e);
      return null;
    });
}

function get(url: string) {
  return fetch(`http://127.0.0.1:20000/${url}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  })
    .then((v) => v.json())
    .catch((e) => {
      console.error('get后端出错', e);
      return null;
    });
}
// '--auth-token', AUTH_TOKEN
const codew = spawn('codewhale', ['app-server', '--http', '--port', '20000', '--auth-token', AUTH_TOKEN], {
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
  get('v1/skills').then(console.log);
}

main();
