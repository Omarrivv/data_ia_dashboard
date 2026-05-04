import sanitizeHtml from 'sanitize-html';

export const sanitizeHtmlContent = (content: string): string => {
  // Use a well-maintained sanitization library to avoid XSS bypasses
  return sanitizeHtml(content || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'pre', 'code']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
    },
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
      img: ['http', 'https', 'data'],
    },
    transformTags: {
      'a': (tagName, attribs) => {
        // Neutralize javascript: hrefs
        if (attribs && attribs.href && attribs.href.trim().toLowerCase().startsWith('javascript:')) {
          attribs.href = '#';
        }
        attribs.rel = 'noopener noreferrer';
        return { tagName, attribs };
      }
    }
  });
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');