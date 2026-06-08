type QueryResult<T = any> = {
  data: T | null;
  error: Error | null;
};

type FilterOperator = 'eq' | 'neq' | 'gte' | 'lte';

type Filter = {
  field: string;
  operator: FilterOperator;
  value: unknown;
};

const API_BASE = '/api/collection';

class MongoQueryBuilder {
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: Filter[] = [];
  private orFilter = '';
  private sortField = '';
  private sortAscending = true;
  private maxRows?: number;
  private expectSingle = false;
  private allowNullSingle = false;
  private payload: unknown;
  private includeRelations = false;

  private collection: string;

  constructor(collection: string) {
    this.collection = collection;
  }

  select(columns = '*') {
    this.action = 'select';
    this.includeRelations = columns.includes('(');
    return this;
  }

  insert(payload: unknown) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, operator: 'eq', value });
    return this;
  }

  neq(field: string, value: unknown) {
    this.filters.push({ field, operator: 'neq', value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ field, operator: 'gte', value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ field, operator: 'lte', value });
    return this;
  }

  or(filter: string) {
    this.orFilter = filter;
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.sortField = field;
    this.sortAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  single() {
    this.expectSingle = true;
    this.allowNullSingle = false;
    return this.execute();
  }

  maybeSingle() {
    this.expectSingle = true;
    this.allowNullSingle = true;
    return this.execute();
  }

  then<TResult1 = QueryResult<any>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private buildUrl() {
    const params = new URLSearchParams();

    for (const filter of this.filters) {
      params.append(`${filter.operator}_${filter.field}`, String(filter.value));
    }

    if (this.orFilter) params.set('or', this.orFilter);
    if (this.sortField) params.set('sort', this.sortField);
    if (this.sortField) params.set('order', this.sortAscending ? 'asc' : 'desc');
    if (this.maxRows) params.set('limit', String(this.maxRows));
    if (this.includeRelations) params.set('include', 'relations');

    params.set('collection', this.collection);

    const query = params.toString();
    return `${API_BASE}?${query}`;
  }

  private async execute(): Promise<QueryResult<any>> {
    try {
      const init: RequestInit = {};

      if (this.action === 'insert') {
        init.method = 'POST';
        init.headers = { 'content-type': 'application/json' };
        init.body = JSON.stringify(this.payload);
      }

      if (this.action === 'update') {
        init.method = 'PATCH';
        init.headers = { 'content-type': 'application/json' };
        init.body = JSON.stringify(this.payload);
      }

      if (this.action === 'delete') {
        init.method = 'DELETE';
      }

      const response = await fetch(this.buildUrl(), init);
      const json = await response.json();

      if (!response.ok) {
        return { data: null, error: new Error(json.error || 'Mongo API request failed') };
      }

      let data = json.data;
      if (this.expectSingle && Array.isArray(data)) {
        data = data[0] ?? null;
      }

      if (this.expectSingle && !this.allowNullSingle && !data) {
        return { data: null, error: new Error('No rows found') };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}

export const supabase = {
  from(collection: string) {
    return new MongoQueryBuilder(collection);
  },
  channel(..._args: any[]) {
    return {
      on(..._args: any[]) {
        return this;
      },
      subscribe(..._args: any[]) {
        return this;
      },
    };
  },
  removeChannel(..._args: any[]) {},
};
