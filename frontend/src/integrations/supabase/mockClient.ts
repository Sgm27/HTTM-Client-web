import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

type TableStore = Record<string, any[]>;
type StorageBucketStore = Record<string, Map<string, { file: File | Blob; uploadedAt: string }>>;

const generateId = (): string => {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  return cryptoObj?.randomUUID?.() ?? `mock-${Math.random().toString(36).slice(2, 10)}`;
};

const nowIso = () => new Date().toISOString();

class MockInsertResponse {
  constructor(private readonly rows: any[]) {}

  select() {
    const rows = this.rows;
    return {
      single: async () => ({ data: rows[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    };
  }

  then<TResult1 = { data: any[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = { data: this.rows, error: null as null };
    if (!onfulfilled) {
      return Promise.resolve(result as unknown as TResult1);
    }

    try {
      return Promise.resolve(onfulfilled(result));
    } catch (error) {
      if (!onrejected) {
        return Promise.reject(error);
      }
      return Promise.resolve(onrejected(error));
    }
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<{ data: any[]; error: null } | TResult> {
    if (!onrejected) {
      return Promise.resolve({ data: this.rows, error: null });
    }
    try {
      return Promise.resolve(onrejected(null));
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

class MockSelectBuilder {
  private filters: Array<(row: Record<string, any>) => boolean> = [];

  constructor(private readonly rows: Record<string, any>[]) {}

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  async single() {
    const filtered = this.applyFilters();
    if (filtered.length === 0) {
      return { data: null, error: { message: 'No rows', code: 'PGRST116' } };
    }
    return { data: filtered[0], error: null };
  }

  async maybeSingle() {
    const filtered = this.applyFilters();
    return { data: filtered[0] ?? null, error: null };
  }

  private applyFilters() {
    return this.filters.reduce((rows, predicate) => rows.filter(predicate), this.rows.slice());
  }
}

class MockStorageBucket {
  constructor(private readonly bucket: string, private readonly storage: StorageBucketStore) {
    if (!this.storage[this.bucket]) {
      this.storage[this.bucket] = new Map();
    }
  }

  async upload(path: string, file: File | Blob) {
    const bucketStore = this.storage[this.bucket]!;
    bucketStore.set(path, { file, uploadedAt: nowIso() });
    return { data: { path }, error: null };
  }

  getPublicUrl(path: string) {
    return {
      data: { publicUrl: `mock://storage/${this.bucket}/${path}` },
      error: null,
    };
  }
}

class MockTable {
  constructor(private readonly table: string, private readonly store: TableStore) {
    if (!this.store[this.table]) {
      this.store[this.table] = [];
    }
  }

  insert(values: any) {
    const rows = Array.isArray(values) ? values : [values];
    const inserted = rows.map((row) => {
      const payload = { ...row };
      if (!payload.id) {
        payload.id = generateId();
      }
      if ('created_at' in payload && !payload.created_at) {
        payload.created_at = nowIso();
      }
      if ('updated_at' in payload && !payload.updated_at) {
        payload.updated_at = nowIso();
      }
      this.store[this.table].push(payload);
      return payload;
    });

    return new MockInsertResponse(inserted);
  }

  select() {
    return new MockSelectBuilder(this.store[this.table]);
  }
}

class MockAuth {
  constructor(private readonly user: any) {}

  async getSession() {
    if (!this.user) {
      return { data: { session: null }, error: null };
    }
    return {
      data: { session: { user: this.user } },
      error: null,
    };
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    const subscription = {
      unsubscribe: () => undefined,
    };
    if (this.user) {
      callback('SIGNED_IN', { user: this.user });
    }
    return { data: { subscription }, error: null };
  }
}

export interface MockSupabaseDebugStore {
  tables: TableStore;
  storage: StorageBucketStore;
}

export interface MockSupabaseClient extends SupabaseClient<Database> {
  __getStore: () => MockSupabaseDebugStore;
}

export const createMockSupabaseClient = (): MockSupabaseClient => {
  const tables: TableStore = {
    stories: [],
    files: [],
    extracted_texts: [],
    uploads: [],
    user_roles: [
      {
        id: generateId(),
        user_id: 'mock-user',
        role: 'user',
        created_at: nowIso(),
      },
    ],
    profiles: [
      {
        id: 'mock-user',
        full_name: 'Mock User',
        avatar_url: null,
        created_at: nowIso(),
        updated_at: nowIso(),
        email: 'mock@example.com',
      },
    ],
  };

  const storage: StorageBucketStore = {};

  const client = {
    auth: new MockAuth({
      id: 'mock-user',
      email: 'mock@example.com',
      aud: 'authenticated',
      user_metadata: {},
    }),
    from(table: string) {
      return new MockTable(table, tables) as any;
    },
    storage: {
      from(bucket: string) {
        return new MockStorageBucket(bucket, storage) as any;
      },
    },
    __getStore: () => ({ tables, storage }),
  } as unknown as MockSupabaseClient;

  return client;
};
