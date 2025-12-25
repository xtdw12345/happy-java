/**
 * Memory manager - manages index memory with LRU cache strategy
 */

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  indexSize: number;
  percentage: number;
}

export class MemoryManager {
  private accessTimes: Map<string, number>;
  private maxCacheSize: number;

  constructor(maxCacheSizeMB: number = 20) {
    this.accessTimes = new Map();
    this.maxCacheSize = maxCacheSizeMB * 1024 * 1024; // Convert to bytes
  }

  recordAccess(filePath: string): void {
    this.accessTimes.set(filePath, Date.now());
  }

  evictLRU(): void {
    if (this.accessTimes.size === 0) {
      return;
    }

    // Sort by access time
    const sorted = Array.from(this.accessTimes.entries())
      .sort((a, b) => a[1] - b[1]);

    // Evict oldest 20%
    const toEvict = Math.floor(sorted.length * 0.2);
    for (let i = 0; i < toEvict; i++) {
      this.accessTimes.delete(sorted[i][0]);
    }

    console.log(`[MemoryManager] Evicted ${toEvict} LRU entries`);
  }

  invalidateCache(filePath: string, changeType: 'create' | 'change' | 'delete'): void {
    if (changeType === 'delete') {
      this.accessTimes.delete(filePath);
    } else {
      this.recordAccess(filePath);
    }
  }

  getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    const indexSize = this.estimateIndexSize();

    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      indexSize,
      percentage: (indexSize / usage.heapTotal) * 100
    };
  }

  suggestGC(): void {
    if (global.gc) {
      global.gc();
      console.log('[MemoryManager] Garbage collection suggested');
    }
  }

  startPeriodicCleanup(intervalMs: number): NodeJS.Timeout {
    return setInterval(() => {
      const usage = this.getMemoryUsage();
      if (usage.indexSize > this.maxCacheSize) {
        this.evictLRU();
      }
    }, intervalMs);
  }

  private estimateIndexSize(): number {
    // Rough estimate: 500 bytes per entry
    return this.accessTimes.size * 500;
  }
}
