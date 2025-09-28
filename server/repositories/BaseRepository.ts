import { db } from '../db';
import { AnyPgTable, AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  asc,
  desc,
  count,
  eq,
  sql,
  type SQL,
  type InferInsertModel,
  type InferSelectModel,
} from 'drizzle-orm';

/**
 * Options for generic find operations
 */
export interface FindAllOptions<TTable extends AnyPgTable> {
  limit?: number;
  offset?: number;
  orderBy?: keyof TTable['_']['columns'] | string;
  direction?: 'asc' | 'desc';
  where?: SQL<unknown>;
}

/**
 * Common filter interface
 */
export interface BaseFilter {
  limit?: number;
  offset?: number;
  orderBy?: string;
  direction?: 'asc' | 'desc';
}

/**
 * Repository result interface
 */
export interface RepositoryResult<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

/**
 * Create paginated result
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number = 1,
  pageSize: number = 10
): RepositoryResult<T> {
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    total,
    page,
    pageSize,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * Base repository providing common CRUD operations for Drizzle tables
 */
export abstract class BaseRepository<
  TTable extends AnyPgTable,
  TSelect extends InferSelectModel<TTable> = InferSelectModel<TTable>,
  TInsert extends InferInsertModel<TTable> = InferInsertModel<TTable>,
> {
  protected constructor(
    protected table: TTable,
    protected primaryKey: AnyPgColumn = (table as Record<string, AnyPgColumn>)
      .id
  ) {}

  /**
   * Find entity by ID
   */
  async findById(id: string | number): Promise<TSelect | undefined> {
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq(this.primaryKey, id))
      .limit(1);
    return result || undefined;
  }

  /**
   * Find all entities with optional pagination, ordering, and filters
   */
  async findAll(options?: FindAllOptions<TTable>): Promise<TSelect[]> {
    let query = db.select().from(this.table);

    if (options?.where) {
      query = query.where(options.where);
    }

    if (options?.orderBy) {
      const tableColumns = this.table as Record<
        string,
        AnyPgColumn | undefined
      >;
      const column = tableColumns[options.orderBy as string];
      if (column) {
        query = query.orderBy(
          options.direction === 'desc' ? desc(column) : asc(column)
        );
      }
    }

    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    if (options?.offset !== undefined) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  /**
   * Find entities with count for pagination metadata
   */
  async findWithCount(
    options?: FindAllOptions<TTable>
  ): Promise<{ data: TSelect[]; total: number }> {
    const [data, total] = await Promise.all([
      this.findAll(options),
      this.count(options?.where),
    ]);

    return { data, total };
  }

  /**
   * Create new entity
   */
  async create(data: TInsert): Promise<TSelect> {
    const [result] = await db.insert(this.table).values(data).returning();
    return result;
  }

  /**
   * Create multiple entities
   */
  async createMany(data: TInsert[]): Promise<TSelect[]> {
    return await db.insert(this.table).values(data).returning();
  }

  /**
   * Update entity by ID
   */
  async update(
    id: string | number,
    updates: Partial<TInsert>
  ): Promise<TSelect | undefined> {
    const [result] = await db
      .update(this.table)
      .set(updates)
      .where(eq(this.primaryKey, id))
      .returning();
    return result || undefined;
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string | number): Promise<boolean> {
    const result = await db.delete(this.table).where(eq(this.primaryKey, id));
    return result.rowCount > 0;
  }

  /**
   * Soft delete entity by ID (if table has deletedAt column)
   */
  async softDelete(id: string | number): Promise<TSelect | undefined> {
    const tableColumns = this.table as Record<string, AnyPgColumn | undefined>;
    const deletedAtColumn = tableColumns.deletedAt;
    if (!deletedAtColumn) {
      throw new Error(
        'Table does not support soft delete (missing deletedAt column)'
      );
    }

    const updatePayload = {
      [deletedAtColumn.name]: new Date(),
    } as Record<string, Date>;

    const [result] = await db
      .update(this.table)
      .set(updatePayload as unknown as Partial<TInsert>)
      .where(eq(this.primaryKey, id))
      .returning();
    return result || undefined;
  }

  /**
   * Check if entity exists
   */
  async exists(id: string | number): Promise<boolean> {
    const [result] = await db
      .select({ id: this.primaryKey })
      .from(this.table)
      .where(eq(this.primaryKey, id))
      .limit(1);
    return !!result;
  }

  /**
   * Count total entities, optionally with conditions
   */
  async count(where?: SQL<unknown>): Promise<number> {
    let query = db.select({ count: count() }).from(this.table);

    if (where) {
      query = query.where(where);
    }

    const [{ count: total }] = await query;
    return Number(total);
  }

  /**
   * Find entities by column value
   */
  async findBy(column: keyof TTable, value: unknown): Promise<TSelect[]> {
    const tableColumn = (this.table as Record<string, AnyPgColumn | undefined>)[
      column as string
    ];
    return await db.select().from(this.table).where(eq(tableColumn, value));
  }

  /**
   * Find single entity by column value
   */
  async findOneBy(
    column: keyof TTable,
    value: unknown
  ): Promise<TSelect | undefined> {
    const tableColumn = (this.table as Record<string, AnyPgColumn | undefined>)[
      column as string
    ];
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq(tableColumn, value))
      .limit(1);
    return result || undefined;
  }

  /**
   * Execute raw SQL query
   */
  protected async executeRaw<T = unknown>(
    query: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await db.execute(sql.raw(query, params));
    if (Array.isArray(result)) {
      return result as T[];
    }
    if (
      result &&
      typeof result === 'object' &&
      Array.isArray((result as { rows?: unknown[] }).rows)
    ) {
      return ((result as { rows: unknown[] }).rows as T[]) ?? [];
    }
    return [];
  }

  /**
   * Begin transaction
   */
  async transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T> {
    return await db.transaction(callback);
  }
}
