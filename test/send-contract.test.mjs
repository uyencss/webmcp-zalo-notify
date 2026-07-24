import assert from 'node:assert/strict';
import test from 'node:test';

import { runSend } from '../src/send.js';

function sink() {
  let value = '';
  return { write: (chunk) => { value += chunk; }, value: () => value };
}

test('send JSON contract is versioned and redacts token and chat ID', async () => {
  const stdout = sink();
  const stderr = sink();
  const code = await runSend(
    ['--recipient', 'ops', '--text', 'alert', '--json'],
    {
      env: { ZALO_BOT_TOKEN: '123:top-secret', ZALO_CONTACTS_PATH: '/unused' },
      stdout,
      stderr,
      contactsLoader: () => ({ ops: { chat_id: 'private-chat-id' } }),
      clientFactory: () => ({
        sendMessage: async () => ({ result: { message_id: 'm-1', date: 123 } }),
      }),
    },
  );
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout.value()), {
    ok: true,
    schema: 'webmcp-zalo-notify-send/1',
    sent: true,
    recipient: { kind: 'alias', alias: 'ops' },
    message_id: 'm-1',
    date: 123,
  });
  assert.doesNotMatch(stdout.value() + stderr.value(), /top-secret|private-chat-id/);
});

test('exit codes and failure envelope are stable and redact sensitive values', async () => {
  const usage = sink();
  assert.equal(await runSend(['--json'], { env: {}, stdout: usage, stderr: sink() }), 2);
  assert.equal(JSON.parse(usage.value()).schema, 'webmcp-zalo-notify-send/1');

  const failed = sink();
  const code = await runSend(
    ['--recipient', 'private-chat-id', '--text', 'alert', '--json'],
    {
      env: { ZALO_BOT_TOKEN: '123:top-secret' },
      stdout: failed,
      stderr: sink(),
      clientFactory: () => ({
        sendMessage: async () => { throw new Error('failed 123:top-secret for private-chat-id'); },
      }),
    },
  );
  assert.equal(code, 1);
  assert.equal(JSON.parse(failed.value()).error.code, 'SEND_FAILED');
  assert.doesNotMatch(failed.value(), /top-secret|private-chat-id/);
});
