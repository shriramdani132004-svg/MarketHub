import {
  assertSafeHttpUrl,
  hashToken,
  randomToken,
  safeImageUrl,
  slugify,
} from '../../src/common/utils/crypto.util';

describe('crypto utilities', () => {
  describe('hashToken', () => {
    it('is a deterministic sha256 hex digest', () => {
      const digest = hashToken('refresh-token');
      expect(digest).toHaveLength(64);
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
      expect(hashToken('refresh-token')).toBe(digest);
      expect(hashToken('refresh-token-2')).not.toBe(digest);
    });
  });

  describe('randomToken', () => {
    it('returns the requested number of random bytes as hex', () => {
      expect(randomToken()).toHaveLength(64);
      expect(randomToken(16)).toHaveLength(32);
      expect(randomToken(8)).toMatch(/^[a-f0-9]{16}$/);
    });

    it('never repeats across calls', () => {
      const tokens = new Set(Array.from({ length: 50 }, () => randomToken(16)));
      expect(tokens.size).toBe(50);
    });
  });

  describe('slugify', () => {
    it('normalises spaces, case and punctuation', () => {
      expect(slugify('  Nimbus Audio & Co. ')).toBe('nimbus-audio-co');
      expect(slugify('Café Décor')).toBe('cafe-decor');
    });

    it('collapses repeated separators and trims dashes', () => {
      expect(slugify('---a---b---')).toBe('a-b');
    });

    it('truncates to 60 characters without a trailing dash', () => {
      const result = slugify('a'.repeat(80));
      expect(result).toHaveLength(60);
      expect(result.endsWith('-')).toBe(false);
    });

    it('falls back to "store" when nothing usable remains', () => {
      expect(slugify('!!!')).toBe('store');
      expect(slugify('')).toBe('store');
    });
  });

  describe('safeImageUrl', () => {
    it('accepts http and https URLs', () => {
      expect(safeImageUrl('https://cdn.example.com/a.png')).toBe(
        'https://cdn.example.com/a.png',
      );
      expect(safeImageUrl('http://example.com/a.png')).toBe('http://example.com/a.png');
    });

    it('rejects dangerous or malformed schemes', () => {
      expect(safeImageUrl('javascript:alert(1)')).toBeNull();
      expect(safeImageUrl('data:image/png;base64,AAAA')).toBeNull();
      expect(safeImageUrl('file:///etc/passwd')).toBeNull();
      expect(safeImageUrl('ftp://example.com/a.png')).toBeNull();
    });

    it('rejects credentials embedded in the URL', () => {
      expect(safeImageUrl('https://user:pass@example.com/a.png')).toBeNull();
      expect(safeImageUrl('https://user@example.com/a.png')).toBeNull();
    });

    it('rejects empty, missing and oversized values', () => {
      expect(safeImageUrl(null)).toBeNull();
      expect(safeImageUrl(undefined)).toBeNull();
      expect(safeImageUrl('   ')).toBeNull();
      expect(safeImageUrl(`https://example.com/${'a'.repeat(500)}`)).toBeNull();
    });

    it('rejects strings that are not URLs', () => {
      expect(safeImageUrl('not a url')).toBeNull();
      expect(safeImageUrl('/relative/path.png')).toBeNull();
    });
  });

  describe('assertSafeHttpUrl', () => {
    it('returns the normalised URL for safe input', () => {
      expect(assertSafeHttpUrl('https://example.com/logo.png')).toBe(
        'https://example.com/logo.png',
      );
    });

    it('returns null for empty input', () => {
      expect(assertSafeHttpUrl(null, 'logoUrl')).toBeNull();
      expect(assertSafeHttpUrl('', 'logoUrl')).toBeNull();
    });

    it('includes the field name in the validation error', () => {
      expect(() => assertSafeHttpUrl('javascript:alert(1)', 'logoUrl')).toThrow(
        'logoUrl must be a valid http(s) URL',
      );
    });
  });
});
