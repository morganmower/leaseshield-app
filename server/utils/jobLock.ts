/**
 * Job Lock Utility
 * 
 * Prevents overlapping runs of legislative monitoring jobs.
 * Single-instance in-process lock. For multi-instance, switch to Redis.
 */

let locked = false;
let currentJob: string | null = null;
let lockStartTime: Date | null = null;

export interface JobLockError extends Error {
  status: number;
  currentJob: string | null;
  lockedSince: Date | null;
}

export async function withJobLock<T>(
  jobName: string, 
  fn: () => Promise<T>
): Promise<T> {
  if (locked) {
    const err = new Error(`Job "${jobName}" cannot start: "${currentJob}" is already running`) as JobLockError;
    err.status = 409;
    err.currentJob = currentJob;
    err.lockedSince = lockStartTime;
    throw err;
  }
  
  locked = true;
  currentJob = jobName;
  lockStartTime = new Date();
  
  console.log(`🔒 [JobLock] Acquired lock for: ${jobName}`);
  
  try {
    const result = await fn();
    return result;
  } finally {
    console.log(`🔓 [JobLock] Released lock for: ${jobName} (duration: ${Date.now() - lockStartTime.getTime()}ms)`);
    locked = false;
    currentJob = null;
    lockStartTime = null;
  }
}

export function isLocked(): boolean {
  return locked;
}

export function getLockStatus(): { locked: boolean; job: string | null; since: Date | null } {
  return {
    locked,
    job: currentJob,
    since: lockStartTime,
  };
}
