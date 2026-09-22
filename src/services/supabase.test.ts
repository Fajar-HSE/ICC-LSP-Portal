import { describe, expect, it } from 'vitest';
import { getSupabaseConfig } from './supabase.js';

describe('getSupabaseConfig', () => {
  it('returns usable anon key even without env (fallback publik)', () => {
    const { url, key } = getSupabaseConfig();
    expect(url).toContain('supabase.co');
    expect(key.length).toBeGreaterThan(100);
  });
});
