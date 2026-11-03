// `npm run setup`: creates .env from .env.example and fills in the generated secrets.
// Safe to run again: it never overwrites a value you've already set.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const GENERATED = ['KEY_ENCRYPTION_SECRET', 'AUTH_SECRET'];

const created = !existsSync('.env');
let text = created ? readFileSync('.env.example', 'utf8') : readFileSync('.env', 'utf8');

const filled = [];
for (const name of GENERATED) {
  const re = new RegExp(`^${name}=\\s*$`, 'm');
  if (re.test(text)) {
    text = text.replace(re, `${name}=${randomBytes(32).toString('base64')}`);
    filled.push(name);
  } else if (!new RegExp(`^${name}=`, 'm').test(text)) {
    text += `\n${name}=${randomBytes(32).toString('base64')}\n`;
    filled.push(name);
  }
}
writeFileSync('.env', text);

const value = (name) => text.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const todo = [];
const serviceKey = value('SUPABASE_SERVICE_ROLE_KEY');
if (value('API_DATA_MODE') !== 'memory' && (!serviceKey || serviceKey.startsWith('PASTE') || serviceKey === 'server-only-service-role-key')) {
  todo.push('SUPABASE_SERVICE_ROLE_KEY: Supabase dashboard > motion-mind > Project Settings > API > service_role');
}
if (!value('SMTP_HOST')) {
  todo.push('SMTP_HOST / SMTP_USER / SMTP_PASS: to email sign-in codes (Gmail: smtp.gmail.com + an app password). Until then codes print in the terminal.');
}

console.log(created ? 'Created .env from .env.example.' : 'Checked your existing .env.');
if (filled.length) console.log(`Generated: ${filled.join(', ')}. Back these up; don't change them later.`);
if (todo.length) {
  console.log('\nStill to fill in .env:');
  for (const t of todo) console.log(`  - ${t}`);
}
console.log('\nThen run: npm run dev');
