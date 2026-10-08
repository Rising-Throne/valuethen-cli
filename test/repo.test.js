import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the skill is identical in skills/ and .claude/skills/', () => {
  // skills/ is the Agent Plugin copy; .claude/skills/ is what Claude Code loads in this repo.
  // Edit skills/valuethen/SKILL.md, then copy it over.
  assert.equal(read('.claude/skills/valuethen/SKILL.md'), read('skills/valuethen/SKILL.md'));
});

test('CLAUDE.md imports AGENTS.md instead of copying it', () => {
  assert.equal(read('CLAUDE.md').trim(), '@AGENTS.md');
});

test('one version everywhere', async () => {
  const pkg = JSON.parse(read('package.json'));
  const plugin = JSON.parse(read('plugin.json'));
  const { VERSION } = await import('../src/index.js');
  assert.equal(VERSION, pkg.version, 'src/index.js VERSION');
  assert.equal(plugin.version, pkg.version, 'plugin.json version');
  assert.match(read('CHANGELOG.md'), new RegExp(`^## ${pkg.version.replace(/\./g, '\\.')}\\b`, 'm'), 'CHANGELOG entry');
});
