// HTML sanitization utilities
const ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'code',
    'pre',
];
const ALLOWED_ATTRIBUTES = {
    a: ['href', 'title', 'target'],
    code: ['class'],
};
export function sanitizeHtml(html) {
    // Basic HTML sanitization - in production use DOMPurify
    return html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}
export function sanitizeMarkdown(markdown) {
    // Remove potentially dangerous markdown
    return markdown
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
}
export function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/\.{2,}/g, '.')
        .substring(0, 255);
}
export function sanitizeUrl(url) {
    try {
        const parsed = new URL(url);
        // Only allow http(s) protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Invalid protocol');
        }
        return parsed.toString();
    }
    catch {
        return '';
    }
}
export function redactSensitiveData(data, sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization']) {
    const result = { ...data };
    for (const key in result) {
        if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
            result[key] = '[REDACTED]';
        }
        else if (typeof result[key] === 'object' && result[key] !== null) {
            result[key] = redactSensitiveData(result[key], sensitiveKeys);
        }
    }
    return result;
}
//# sourceMappingURL=index.js.map