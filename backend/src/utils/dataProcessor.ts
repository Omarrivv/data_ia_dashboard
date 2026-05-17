/**
 * Advanced data processing utilities for handling large datasets efficiently
 * Senior-level patterns: streaming, chunking, memory optimization
 */

/**
 * Chunk configuration for batch processing
 */
export interface ChunkConfig {
  size: number; // records per chunk
  maxConcurrency: number;
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  size: 5000, // Process 5k records at a time
  maxConcurrency: 3 // Max parallel chunk processing
};

/**
 * Memory-efficient chunk processor for large datasets
 * Yields chunks instead of loading everything into memory
 */
export async function* chunkData(
  data: any[],
  chunkSize: number = DEFAULT_CHUNK_CONFIG.size
): AsyncGenerator<any[], void, unknown> {
  for (let i = 0; i < data.length; i += chunkSize) {
    yield data.slice(i, i + chunkSize);
  }
}

/**
 * Process chunks with concurrency control
 * Prevents memory overflow and manages CPU efficiently
 */
export async function processChunksParallel<T>(
  chunks: any[][],
  processor: (chunk: any[]) => Promise<T>,
  maxConcurrency: number = DEFAULT_CHUNK_CONFIG.maxConcurrency
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  const worker = async (): Promise<void> => {
    while (index < chunks.length) {
      const currentIndex = index++;
      try {
        const result = await processor(chunks[currentIndex]);
        results[currentIndex] = result;
      } catch (error) {
        console.error(`Chunk processing error at index ${currentIndex}:`, error);
        throw error;
      }
    }
  };

  const workers = Array(Math.min(maxConcurrency, chunks.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

/**
 * Stream processor for CSV/JSON data with memory-efficient parsing
 * Perfect for files > 100MB
 */
export class DataStreamProcessor {
  private chunk: any[] = [];
  private chunkSize: number;
  private totalProcessed = 0;

  constructor(chunkSize: number = DEFAULT_CHUNK_CONFIG.size) {
    this.chunkSize = chunkSize;
  }

  /**
   * Add record to current chunk, yield when full
   */
  public async *processRecord(record: any): AsyncGenerator<any[], void, unknown> {
    this.chunk.push(record);
    this.totalProcessed++;

    if (this.chunk.length >= this.chunkSize) {
      yield this.chunk;
      this.chunk = [];
    }
  }

  /**
   * Flush remaining records
   */
  public *flush(): Generator<any[], void, unknown> {
    if (this.chunk.length > 0) {
      yield this.chunk;
      this.chunk = [];
    }
  }

  public getTotalProcessed(): number {
    return this.totalProcessed;
  }
}

/**
 * Compute data statistics incrementally (avoid loading all into memory)
 */
export interface DataStats {
  rowCount: number;
  columnCount: number;
  columns: Map<string, ColumnStats>;
  estimatedSize: number;
}

export interface ColumnStats {
  name: string;
  type: string;
  nullable: number;
  unique: number;
  examples: any[];
}

export function computeStats(data: any[]): DataStats {
  const stats: DataStats = {
    rowCount: data.length,
    columnCount: 0,
    columns: new Map(),
    estimatedSize: JSON.stringify(data).length
  };

  if (data.length === 0) return stats;

  const firstRow = data[0];
  const columnNames = Object.keys(firstRow);
  stats.columnCount = columnNames.length;

  // Compute column statistics
  for (const col of columnNames) {
    const values = data.map((row) => row[col]);
    const nonNull = values.filter((v) => v != null);
    const uniqueValues = new Set(nonNull);

    stats.columns.set(col, {
      name: col,
      type: inferType(values),
      nullable: values.length - nonNull.length,
      unique: uniqueValues.size,
      examples: [...new Set(values)].slice(0, 3)
    });
  }

  return stats;
}

function inferType(values: any[]): string {
  const nonNull = values.filter((v) => v != null);
  if (nonNull.length === 0) return 'unknown';

  const sample = nonNull[0];
  if (typeof sample === 'number') return 'number';
  if (typeof sample === 'boolean') return 'boolean';
  if (sample instanceof Date) return 'date';
  if (typeof sample === 'string') {
    // Try to detect date strings
    if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'date';
    // Try to detect numbers stored as strings
    if (!isNaN(parseFloat(sample))) return 'number';
    return 'string';
  }
  return 'object';
}

/**
 * Batch insert helper for MongoDB (uses bulk operations)
 */
export async function batchInsert(
  collection: any,
  data: any[],
  batchSize: number = 1000
): Promise<{ insertedCount: number; errors: Error[] }> {
  const errors: Error[] = [];
  let insertedCount = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    try {
      const result = await collection.insertMany(batch, { ordered: false });
      insertedCount += result.insertedIds.length;
    } catch (error) {
      // insertMany with ordered: false returns error with insertedCount
      if ((error as any).insertedCount) {
        insertedCount += (error as any).insertedCount;
      }
      errors.push(error as Error);
    }
  }

  return { insertedCount, errors };
}

/**
 * Memory-efficient summary statistics (for UI previews)
 */
export function summarizeDataset(data: any[], maxSamples: number = 5): any {
  return {
    totalRows: data.length,
    columns: Object.keys(data[0] || {}),
    samples: data.slice(0, maxSamples),
    sizeEstimate: `${Math.round(JSON.stringify(data).length / 1024)}KB`
  };
}

/**
 * Deduplication for large datasets (memory-efficient)
 */
export function* deduplicateStream(
  data: any[],
  keyFn?: (item: any) => string
): Generator<any[], void, unknown> {
  const seen = new Set<string>();
  let chunk: any[] = [];
  const CHUNK_SIZE = 1000;

  for (const item of data) {
    const key = keyFn ? keyFn(item) : JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      chunk.push(item);

      if (chunk.length >= CHUNK_SIZE) {
        yield chunk;
        chunk = [];
      }
    }
  }

  if (chunk.length > 0) {
    yield chunk;
  }
}
