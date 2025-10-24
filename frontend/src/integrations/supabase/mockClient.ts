import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

type TableRow = Record<string, unknown>;
type TableStore = Record<string, TableRow[]>;
type StorageBucketStore = Record<string, Map<string, { file: File | Blob; uploadedAt: string }>>;
type PostgrestQueryBuilderLike = ReturnType<SupabaseClient<Database>['from']>;
type StorageBucketApiLike = ReturnType<SupabaseClient<Database>['storage']['from']>;

const generateId = (): string => {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  return cryptoObj?.randomUUID?.() ?? `mock-${Math.random().toString(36).slice(2, 10)}`;
};

const nowIso = () => new Date().toISOString();

class MockInsertResponse {
  constructor(private readonly rows: TableRow[]) {}

  select(_columns?: string, _options?: SelectOptions) {
    const rows = this.rows;
    return {
      single: async () => ({ data: (rows[0] ?? null) as TableRow | null, error: null }),
      maybeSingle: async () => ({ data: (rows[0] ?? null) as TableRow | null, error: null }),
      then<TResult1 = { data: TableRow[]; error: null }, TResult2 = never>(
        onfulfilled?: ((value: { data: TableRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        const result = { data: rows, error: null as null };
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
      },
    };
  }

  then<TResult1 = { data: TableRow[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: TableRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
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
  ): Promise<{ data: TableRow[]; error: null } | TResult> {
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

type FilterFn = (row: TableRow) => boolean;

interface SelectOptions {
  head?: boolean;
  count?: 'exact' | 'planned' | 'estimated';
}

interface OrderOptions {
  ascending?: boolean;
  nullsFirst?: boolean;
}

class MockSelectBuilder {
  private filters: FilterFn[] = [];
  private orderings: Array<{ column: string; options: OrderOptions }> = [];
  private limitCount: number | undefined;
  private rangeFrom: number | undefined;
  private rangeTo: number | undefined;

  constructor(
    private readonly table: string,
    private readonly store: TableStore,
    private readonly options: SelectOptions = {},
  ) {}

  private get rows(): TableRow[] {
    return this.store[this.table] ?? [];
  }

  private addFilter(fn: FilterFn) {
    this.filters.push(fn);
    return this;
  }

  private resolveValue(value: unknown) {
    return typeof value === 'function' ? (value as () => unknown)() : value;
  }

  eq(column: string, value: unknown) {
    return this.addFilter((row) => row[column] === this.resolveValue(value));
  }

  neq(column: string, value: unknown) {
    return this.addFilter((row) => row[column] !== this.resolveValue(value));
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values as unknown[]);
    return this.addFilter((row) => set.has(row[column]));
  }

  ilike(column: string, pattern: string) {
    const regex = this.buildLikeRegex(pattern);
    return this.addFilter((row) => {
      const value = row[column];
      if (value === null || value === undefined) {
        return false;
      }
      return regex.test(String(value));
    });
  }

  or(expression: string) {
    const parts = expression.split(',').map((part) => part.trim()).filter(Boolean);
    const predicates = parts.map((part) => this.parseCondition(part)).filter(Boolean) as FilterFn[];
    if (predicates.length === 0) {
      return this;
    }
    return this.addFilter((row) => predicates.some((predicate) => predicate(row)));
  }

  order(column: string, options: OrderOptions = {}) {
    this.orderings.push({ column, options });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  private parseCondition(condition: string): FilterFn | null {
    const match = condition.match(/^([^\.]+)\.([^\.]+)\.(.*)$/);
    if (!match) {
      return null;
    }
    const [, column, operator, rawValue] = match;
    const value = rawValue.replace(/^"|"$/g, '');

    switch (operator) {
      case 'eq':
        return (row) => row[column] === value;
      case 'neq':
        return (row) => row[column] !== value;
      case 'ilike': {
        const regex = this.buildLikeRegex(value);
        return (row) => {
          const candidate = row[column];
          if (candidate === null || candidate === undefined) {
            return false;
          }
          return regex.test(String(candidate));
        };
      }
      default:
        return null;
    }
  }

  private buildLikeRegex(pattern: string) {
    const escaped = pattern.replace(/[-/\^$*+?.()|[\]{}]/g, '\$&');
    const regexPattern = `^${escaped.replace(/%/g, '.*')}$`;
    return new RegExp(regexPattern, 'i');
  }

  private applyFilters(rows: TableRow[]) {
    return this.filters.reduce((current, predicate) => current.filter(predicate), rows);
  }

  private applyOrder(rows: TableRow[]) {
    if (this.orderings.length === 0) {
      return rows;
    }

    const sorted = rows.slice();
    sorted.sort((a, b) => {
      for (const { column, options } of this.orderings) {
        const ascending = options.ascending !== false;
        const nullsFirst = options.nullsFirst ?? !ascending;
        const aValue = a[column];
        const bValue = b[column];

        if (aValue === bValue) {
          continue;
        }

        if (aValue === null || aValue === undefined) {
          return nullsFirst ? -1 : 1;
        }
        if (bValue === null || bValue === undefined) {
          return nullsFirst ? 1 : -1;
        }

        const comparison = this.compareValues(aValue, bValue);
        if (comparison < 0) {
          return ascending ? -1 : 1;
        }
        if (comparison > 0) {
          return ascending ? 1 : -1;
        }
      }
      return 0;
    });

    return sorted;
  }

  private compareValues(a: unknown, b: unknown) {
    if (typeof a === 'number' && typeof b === 'number') {
      if (a === b) {
        return 0;
      }
      return a < b ? -1 : 1;
    }

    const aComparable = String(a);
    const bComparable = String(b);
    if (aComparable === bComparable) {
      return 0;
    }
    return aComparable < bComparable ? -1 : 1;
  }

  private applyPagination(rows: TableRow[]) {
    let result = rows;

    if (this.rangeFrom !== undefined || this.rangeTo !== undefined) {
      const from = this.rangeFrom ?? 0;
      const to = this.rangeTo !== undefined ? this.rangeTo + 1 : undefined;
      result = result.slice(from, to);
    }

    if (this.limitCount !== undefined) {
      result = result.slice(0, this.limitCount);
    }

    return result;
  }

  private compute() {
    const filtered = this.applyFilters(this.rows.slice());
    const count = this.options.count ? filtered.length : null;
    const ordered = this.applyOrder(filtered);
    const paginated = this.applyPagination(ordered);
    const data = this.options.head ? [] : paginated;

    return { data, count } as { data: TableRow[]; count: number | null };
  }

  async single() {
    const { data } = this.compute();
    if (!data || data.length === 0) {
      return { data: null, error: { message: 'No rows', code: 'PGRST116' } };
    }
    if (data.length > 1) {
      return { data: null, error: { message: 'Multiple rows', code: 'PGRST118' } };
    }
    return { data: data[0], error: null };
  }

  async maybeSingle() {
    const { data } = this.compute();
    return { data: data[0] ?? null, error: null };
  }

  then<TResult1 = { data: TableRow[]; error: null; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: TableRow[]; error: null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = { ...this.compute(), error: null as null };
      if (!onfulfilled) {
        return Promise.resolve(result as unknown as TResult1);
      }
      return Promise.resolve(onfulfilled(result));
    } catch (error) {
      if (!onrejected) {
        return Promise.reject(error);
      }
      try {
        return Promise.resolve(onrejected(error));
      } catch (err) {
        return Promise.reject(err);
      }
    }
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<{ data: TableRow[]; error: null; count: number | null } | TResult> {
    if (!onrejected) {
      return Promise.resolve({ ...this.compute(), error: null });
    }
    try {
      return Promise.resolve(onrejected(null));
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

class MockMutationBuilder {
  private filters: FilterFn[] = [];

  constructor(
    private readonly table: string,
    private readonly store: TableStore,
    private readonly type: 'update' | 'delete',
    private readonly values?: TableRow,
  ) {}

  private get rows(): TableRow[] {
    return this.store[this.table] ?? [];
  }

  private addFilter(fn: FilterFn) {
    this.filters.push(fn);
    return this;
  }

  eq(column: string, value: unknown) {
    return this.addFilter((row) => row[column] === value);
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values as unknown[]);
    return this.addFilter((row) => set.has(row[column]));
  }

  private applyFilters() {
    return this.filters.reduce((current, predicate) => current.filter(predicate), this.rows.slice());
  }

  private applyMutation() {
    const matching = this.applyFilters();
    if (this.type === 'update') {
      for (const row of matching) {
        Object.assign(row, this.values ?? {});
        if ('updated_at' in row) {
          row.updated_at = nowIso();
        }
      }
    } else if (this.type === 'delete') {
      const remaining = this.rows.filter((row) => !matching.includes(row));
      this.store[this.table] = remaining;
    }
    return matching;
  }

  then<TResult1 = { data: TableRow[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: TableRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = { data: this.applyMutation(), error: null as null };
      if (!onfulfilled) {
        return Promise.resolve(result as unknown as TResult1);
      }
      return Promise.resolve(onfulfilled(result));
    } catch (error) {
      if (!onrejected) {
        return Promise.reject(error);
      }
      try {
        return Promise.resolve(onrejected(error));
      } catch (err) {
        return Promise.reject(err);
      }
    }
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<{ data: TableRow[]; error: null } | TResult> {
    if (!onrejected) {
      return Promise.resolve({ data: this.applyMutation(), error: null });
    }
    try {
      return Promise.resolve(onrejected(null));
    } catch (error) {
      return Promise.reject(error);
    }
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

  private ensureTimestamps(payload: TableRow) {
    if ('created_at' in payload && !payload.created_at) {
      payload.created_at = nowIso();
    }
    if ('updated_at' in payload && !payload.updated_at) {
      payload.updated_at = nowIso();
    }
  }

  insert(values: TableRow | TableRow[]) {
    const rows = Array.isArray(values) ? values : [values];
    const inserted = rows.map((row) => {
      const payload = { ...row };
      if (!payload.id) {
        payload.id = generateId();
      }
      this.ensureTimestamps(payload);
      this.store[this.table].push(payload);
      return payload;
    });

    return new MockInsertResponse(inserted);
  }

  upsert(values: TableRow | TableRow[], options?: { onConflict?: string }) {
    const rows = Array.isArray(values) ? values : [values];
    const conflictKeys = options?.onConflict?.split(',').map((k) => k.trim()).filter(Boolean) ?? ['id'];
    const results = rows.map((row) => {
      const payload = { ...row };
      if (!payload.id) {
        payload.id = generateId();
      }
      this.ensureTimestamps(payload);
      const existingIndex = this.store[this.table].findIndex((candidate) =>
        conflictKeys.every((key) => candidate[key] === payload[key])
      );
      if (existingIndex >= 0) {
        this.store[this.table][existingIndex] = {
          ...this.store[this.table][existingIndex],
          ...payload,
          updated_at: nowIso(),
        };
        return this.store[this.table][existingIndex];
      }
      this.store[this.table].push(payload);
      return payload;
    });

    return new MockInsertResponse(results);
  }

  update(values: TableRow) {
    return new MockMutationBuilder(this.table, this.store, 'update', values);
  }

  delete() {
    return new MockMutationBuilder(this.table, this.store, 'delete');
  }

  select(_columns?: string, options?: SelectOptions) {
    return new MockSelectBuilder(this.table, this.store, options ?? {});
  }
}

interface MockUser {
  id: string;
  email: string;
  aud: string;
  user_metadata: Record<string, unknown>;
  [key: string]: unknown;
}

type MockSession = { user: MockUser | null };
type AuthListener = (event: string, session: MockSession) => void;

class MockAuth {
  storageKey = 'mock-auth-storage';
  private listeners = new Set<AuthListener>();

  constructor(private user: MockUser | null) {}

  private notify(event: string) {
    const session: MockSession = this.user ? { user: this.user } : { user: null };
    for (const listener of this.listeners) {
      listener(event, session);
    }
  }

  async getSession() {
    if (!this.user) {
      return { data: { session: null }, error: null };
    }
    return {
      data: { session: { user: this.user } },
      error: null,
    };
  }

  async getUser() {
    return { data: { user: this.user ?? null }, error: null };
  }

  async signInWithPassword(credentials: { email: string; password: string }) {
    const email = credentials.email;
    this.user = this.user ?? {
      id: 'mock-user',
      aud: 'authenticated',
      user_metadata: {},
    };
    this.user.email = email;
    this.notify('SIGNED_IN');
    return { data: { session: { user: this.user }, user: this.user }, error: null };
  }

  async signUp(credentials: { email: string; password: string }) {
    const result = await this.signInWithPassword(credentials);
    return { data: { user: this.user, session: result.data.session }, error: null };
  }

  async signOut() {
    this.user = null;
    this.notify('SIGNED_OUT');
    return { error: null };
  }

  async refreshSession() {
    return this.getSession();
  }

  onAuthStateChange(callback: AuthListener) {
    this.listeners.add(callback);
    const subscription = {
      unsubscribe: () => {
        this.listeners.delete(callback);
      },
    };
    callback('INITIAL_SESSION', { user: this.user ?? null });
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
      return new MockTable(table, tables) as unknown as PostgrestQueryBuilderLike;
    },
    rpc(_fn: string, _args?: Record<string, unknown>) {
      return Promise.resolve({
        data: null,
        error: { message: 'RPC calls are not implemented in the mock client.' },
      });
    },
    storage: {
      from(bucket: string) {
        return new MockStorageBucket(bucket, storage) as unknown as StorageBucketApiLike;
      },
    },
    __getStore: () => ({ tables, storage }),
  } as unknown as MockSupabaseClient;

  return client;
};
