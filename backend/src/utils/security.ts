export const sanitizeHtmlContent = (content: string): string => {
  let sanitized = content;

  sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed[\s\S]*?>/gi, '');
  sanitized = sanitized.replace(/<link[\s\S]*?>/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  sanitized = sanitized.replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"');
  sanitized = sanitized.replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, '$1="#"');

  return sanitized;
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');