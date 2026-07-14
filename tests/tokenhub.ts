import { AUTH_TOKEN } from './.env.js';

function post(url: string, data?: any) {
  return fetch(`https://aigw.telecomjs.com/${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: data ? JSON.stringify(data) : '{}',
  }).catch((e) => {
    console.error('post后端出错', e);
    return null;
  });
}

function get(url: string) {
  return fetch(`https://aigw.telecomjs.com/${url}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  }).catch((e) => {
    console.error('get后端出错', e);
    return null;
  });
}

async function main() {
  const v = await get('v1/models').then((v) => v?.text());
  console.log(v);
}

main();
