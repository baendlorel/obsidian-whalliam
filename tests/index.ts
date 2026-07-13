import { execSync } from 'node:child_process';
import { AUTH_TOKEN } from './.env.js';
import { createBackend } from './backend.js';

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

interface Skill {
  name: string;
  description: string;
  path: string;
  enabled: boolean;
  is_bundled: boolean;
}

interface SkillsResponse {
  directory: string;
  directories: string[];
  warnings: string[];
  skills: Skill[];
}

async function main() {
  const codew = await createBackend(AUTH_TOKEN);
  console.log('等待后端启动...');
  console.log('后端启动完成');
  console.log('访问skills');
  const a = (await get('v1/skills')) as SkillsResponse;
  console.log(a.skills.map((v) => v.name));
  if (codew.pid) {
    process.kill(-codew.pid, 'SIGKILL');
  }
}

main();
