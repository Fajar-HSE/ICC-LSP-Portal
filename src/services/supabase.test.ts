import { describe, expect, it } from 'vitest';
import { getSupabaseConfig } from './supabase.js';

describe('getSupabaseConfig', () => {
  it('returns usable key even without env (fallback publik)', () => {
    const { url, key } = getSupabaseConfig();
    expect(url).toContain('supabase.co');
    // Publishable key baru (sb_publishable_...) lebih pendek dari JWT lama,
    // jadi cukup pastikan tidak kosong — key kosong = 401 (regresi).
    expect(key.length).toBeGreaterThan(0);
  });
});
