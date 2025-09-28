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

const DRIZZLE_COLUMNS = Symbol.for('drizzle:Columns');
const DRIZZLE_NAME = Symbol.for('drizzle:Name');

type TableColumns<TTable extends AnyPgTable> = TTable['_']['columns'];
type ColumnName<TTable extends AnyPgTable> = Extract<
  keyof TableColumns<TTable>,
  string
>;
type PrimaryKeyColumn<TTable extends AnyPgTable> =
  TableColumns<TTable>[ColumnName<TTable>];
type TableWithColumns<TTable extends AnyPgTable> = TTable & {
  [DRIZZLE_COLUMNS]: TableColumns<TTable>;
};
type TableWithName<TTable extends AnyPgTable> = TTable & {
  [DRIZZLE_NAME]?: string;
  _: { name?: string };
};

/**
 * Options for generic find operations
 */

export interface FindAllOptions<TTable extends AnyPgTable> {
  limit?: number;
  offset?: number;
  orderBy?: ColumnName<TTable> | string;
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
  protected readonly primaryKey: PrimaryKeyColumn<TTable>;

  protected constructor(
    protected table: TTable,
    primaryKey?: PrimaryKeyColumn<TTable>
  ) {
    const columns = this.getTableColumns();
    const inferredPrimaryKey = columns.id as PrimaryKeyColumn<TTable> | undefined;

    const resolvedPrimaryKey = primaryKey ?? inferredPrimaryKey;

    if (!resolvedPrimaryKey) {
      throw new Error(
        'BaseRepository requires a primary key column. Provide one explicitly when the table does not expose an "id" column.'
      );
    }

    this.primaryKey = resolvedPrimaryKey;
  }

  private getTableColumns(): TableColumns<TTable> {
    return (this.table as TableWithColumns<TTable>)[DRIZZLE_COLUMNS];
  }

  private getTableName(): string {
    const tableWithName = this.table as TableWithName<TTable>;
    return tableWithName[DRIZZLE_NAME] ?? tableWithName._?.name ?? 'unknown';
  }

  private getColumnByName(column: string): AnyPgColumn | undefined {
    const columns = this.getTableColumns() as Record<string, AnyPgColumn | undefined>;
    return columns[column];
  }

  protected resolveColumn(column: string): AnyPgColumn {
    const resolved = this.getColumnByName(column);
    if (!resolved) {
      const tableName = this.getTableName();
      throw new Error(
        `Column "${column}" does not exist on table "${tableName ?? 'unknown'}"`
      );
    }
    return resolved;
  }

  /**
   * Find entity by ID
   */
  async findById(id: string | number): Promise<TSelect | undefined> {
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq(this.primaryKey, id))
      .limit(1);
    return (result as TSelect | undefined) ?? undefined;
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
      const column = this.getColumnByName(options.orderBy as string);
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

    const results = await query;
    return results as TSelect[];
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
    return result as TSelect;
  }

  /**
   * Create multiple entities
   */
  async createMany(data: TInsert[]): Promise<TSelect[]> {
    const created = await db.insert(this.table).values(data).returning();
    return created as TSelect[];
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
    return (result as TSelect | undefined) ?? undefined;
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string | number): Promise<boolean> {
    const result = await db.delete(this.table).where(eq(this.primaryKey, id));
    return Number(result.rowCount ?? 0) > 0;
  }

  /**
   * Soft delete entity by ID (if table has deletedAt column)
   */
  async softDelete(id: string | number): Promise<TSelect | undefined> {
    const deletedAtColumn = this.getColumnByName('deletedAt');
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
    return (result as TSelect | undefined) ?? undefined;
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
  async findBy(
    column: ColumnName<TTable> | string,
    value: unknown
  ): Promise<TSelect[]> {
    const tableColumn = this.resolveColumn(column as string);
    const results = await db
      .select()
      .from(this.table)
      .where(eq(tableColumn, value));
    return results as TSelect[];
  }

  /**
   * Find single entity by column value
   */
  async findOneBy(
    column: ColumnName<TTable> | string,
    value: unknown
  ): Promise<TSelect | undefined> {
    const tableColumn = this.resolveColumn(column as string);
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq(tableColumn, value))
      .limit(1);
    return (result as TSelect | undefined) || undefined;
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
