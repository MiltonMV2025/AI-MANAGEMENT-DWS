import sql from "mssql";
import { env } from "../config/env.js";

export type QueryResult<T> = {
  rows: T[];
};

type QueryTarget = sql.ConnectionPool | sql.Transaction;

const poolPromise = new sql.ConnectionPool(env.sqlServerConnectionString).connect();

function normalizeSqlText(text: string): string {
  return text.replace(/\$(\d+)/g, (_match, index) => `@p${index}`);
}

async function executeQuery<T>(
  target: QueryTarget,
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const request =
    target instanceof sql.Transaction
      ? new sql.Request(target)
      : new sql.Request(target as sql.ConnectionPool);
  params.forEach((param, idx) => {
    request.input(`p${idx + 1}`, param === undefined ? null : param);
  });

  const result = await request.query<T>(normalizeSqlText(text));
  return { rows: result.recordset ?? [] };
}

export async function query<T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const pool = await poolPromise;
  return executeQuery<T>(pool, text, params);
}

export async function runInTransaction<T>(
  callback: (txQuery: <R>(text: string, params?: unknown[]) => Promise<QueryResult<R>>) => Promise<T>
): Promise<T> {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const txQuery = <R>(text: string, params: unknown[] = []): Promise<QueryResult<R>> =>
      executeQuery<R>(transaction, text, params);
    const result = await callback(txQuery);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function closePool(): Promise<void> {
  const pool = await poolPromise;
  await pool.close();
}
