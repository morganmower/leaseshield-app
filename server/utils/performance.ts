/**
 * Simple performance monitoring utilities
 * For production, consider using APM tools like New Relic, DataDog, etc.
 */

import { PERFORMANCE } from '../constants';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = PERFORMANCE.MAX_METRICS_STORED;

  /**
   * Record a performance metric
   */
  record(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      operation,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations
    if (duration > PERFORMANCE.SLOW_OPERATION_THRESHOLD_MS) {
      console.warn(`⚠️  Slow operation detected: ${operation} took ${duration}ms`, metadata);
    }
  }

  /**
   * Get metrics for a specific operation
   */
  getMetrics(operation?: string): PerformanceMetric[] {
    if (operation) {
      return this.metrics.filter(m => m.operation === operation);
    }
    return [...this.metrics];
  }

  /**
   * Get average duration for an operation
   */
  getAverageDuration(operation: string): number | null {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return null;

    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / operationMetrics.length;
  }

  /**
   * Get statistics for an operation
   */
  getStats(operation: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return null;

    const durations = operationMetrics.map(m => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = count > 0 ? sum / count : 0;
    const min = durations[0] || 0;
    const max = durations[count - 1] || 0;
    const p95Index = Math.floor(count * 0.95);
    const p95 = durations[p95Index] || 0;

    return { count, avg, min, max, p95 };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get summary of all operations
   */
  getSummary(): Record<string, { count: number; avgDuration: number }> {
    const summary: Record<string, { count: number; totalDuration: number }> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.operation]) {
        summary[metric.operation] = { count: 0, totalDuration: 0 };
      }
      summary[metric.operation].count++;
      summary[metric.operation].totalDuration += metric.duration;
    }

    const result: Record<string, { count: number; avgDuration: number }> = {};
    for (const [operation, data] of Object.entries(summary)) {
      result[operation] = {
        count: data.count,
        avgDuration: Math.round(data.totalDuration / data.count),
      };
    }

    return result;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Measure execution time of a function
 */
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    performanceMonitor.record(operation, duration, metadata);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    performanceMonitor.record(operation, duration, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Measure execution time of a synchronous function
 */
export function measure<T>(
  operation: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const start = Date.now();
  try {
    const result = fn();
    const duration = Date.now() - start;
    performanceMonitor.record(operation, duration, metadata);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    performanceMonitor.record(operation, duration, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Create a timer that can be stopped manually
 */
export function createTimer(operation: string, metadata?: Record<string, any>) {
  const start = Date.now();
  return {
    stop: () => {
      const duration = Date.now() - start;
      performanceMonitor.record(operation, duration, metadata);
      return duration;
    },
  };
}

