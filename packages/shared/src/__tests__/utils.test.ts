import {
  generateId,
  slugify,
  truncate,
  debounce,
  throttle,
  retry,
  sleep,
  chunk,
  omit,
  pick,
} from '../utils';

describe('Shared Utils', () => {
  describe('generateId', () => {
    it('should generate ID with prefix', () => {
      const id = generateId('user');
      expect(id).toMatch(/^user_[a-z0-9]+$/);
    });

    it('should generate ID without prefix', () => {
      const id = generateId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('slugify', () => {
    it('should convert string to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Test & Example')).toBe('test-example');
      expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
      expect(slugify('Special!@#$%Characters')).toBe('special-characters');
    });

    it('should handle empty string', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle already slugified string', () => {
      expect(slugify('already-slugified')).toBe('already-slugified');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const text = 'This is a very long string that needs to be truncated';
      expect(truncate(text, 20)).toBe('This is a very lo...');
    });

    it('should not truncate short strings', () => {
      const text = 'Short text';
      expect(truncate(text, 20)).toBe('Short text');
    });

    it('should use custom suffix', () => {
      const text = 'This is a long string';
      expect(truncate(text, 10, '…')).toBe('This is a…');
    });

    it('should handle edge cases', () => {
      expect(truncate('', 10)).toBe('');
      expect(truncate('test', 0)).toBe('...');
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass latest arguments', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('third');
    });

    it('should reset timer on each call', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);

      debouncedFn();
      jest.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle function calls', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should maintain this context', () => {
      const obj = {
        value: 42,
        getValue: function () {
          return this.value;
        },
      };

      const throttled = throttle(obj.getValue, 100);
      const bound = throttled.bind(obj);

      expect(bound()).toBe(42);
    });
  });

  describe('retry', () => {
    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Failed');
        }
        return 'Success';
      });

      const result = await retry(fn, 3, 10);

      expect(result).toBe('Success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(retry(fn, 3, 10)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on success', async () => {
      const fn = jest.fn().mockResolvedValue('Success');

      const result = await retry(fn, 3, 10);

      expect(result).toBe('Success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should wait between retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Fail'));
      const startTime = Date.now();

      try {
        await retry(fn, 3, 100);
      } catch (e) {
        // Expected to fail
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(200); // 2 delays of 100ms
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const startTime = Date.now();
      await sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
      expect(endTime - startTime).toBeLessThan(150);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const chunks = chunk(array, 3);

      expect(chunks).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);
    });

    it('should handle non-divisible arrays', () => {
      const array = [1, 2, 3, 4, 5];
      const chunks = chunk(array, 2);

      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle empty array', () => {
      expect(chunk([], 3)).toEqual([]);
    });

    it('should handle chunk size larger than array', () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });

    it('should throw for invalid chunk size', () => {
      expect(() => chunk([1, 2, 3], 0)).toThrow();
      expect(() => chunk([1, 2, 3], -1)).toThrow();
    });
  });

  describe('omit', () => {
    it('should omit specified keys', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = omit(obj, ['b', 'd']);

      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should handle non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, ['c' as keyof typeof obj, 'd' as keyof typeof obj]);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should handle empty keys array', () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, []);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should not mutate original object', () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, ['a']);

      expect(obj).toEqual({ a: 1, b: 2 });
      expect(result).toEqual({ b: 2 });
    });
  });

  describe('pick', () => {
    it('should pick specified keys', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = pick(obj, ['a', 'c']);

      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should ignore non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, ['a', 'c' as keyof typeof obj]);

      expect(result).toEqual({ a: 1 });
    });

    it('should handle empty keys array', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, []);

      expect(result).toEqual({});
    });

    it('should not mutate original object', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, ['a']);

      expect(obj).toEqual({ a: 1, b: 2 });
      expect(result).toEqual({ a: 1 });
    });
  });
});
