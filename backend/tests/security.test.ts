import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHtmlContent, escapeHtml } from '../src/utils/security';

test('sanitizeHtmlContent removes active content', () => {
  const unsafe = '<html><body><h1 onclick="alert(1)">Hello</h1><script>alert(2)</script><a href="javascript:alert(3)">x</a></body></html>';
  const safe = sanitizeHtmlContent(unsafe);

  assert.ok(!safe.includes('<script>'));
  assert.ok(!safe.includes('onclick='));
  assert.ok(!safe.includes('javascript:'));
  assert.ok(safe.includes('<h1>Hello</h1>'));
});

test('escapeHtml encodes special characters', () => {
  const escaped = escapeHtml('<div class="x">O\'Reilly & Co</div>');

  assert.equal(escaped, '&lt;div class=&quot;x&quot;&gt;O&#39;Reilly &amp; Co&lt;/div&gt;');
});