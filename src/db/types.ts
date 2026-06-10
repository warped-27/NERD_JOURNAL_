/** Minimal subset of expo-sqlite's SQLiteDatabase that NotesRepository needs. */
export interface Database {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: (string | number | null)[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(source: string, params?: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: (string | number | null)[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
