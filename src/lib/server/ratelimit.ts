interface Bucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Simple fixed-window limiter kept in memory.
 * Returns true when the attempt is allowed.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}
	bucket.count += 1;
	return bucket.count <= limit;
}

export function resetRateLimit(key: string): void {
	buckets.delete(key);
}

// Drop expired buckets now and then so the map does not grow forever.
setInterval(() => {
	const now = Date.now();
	for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 10 * 60 * 1000).unref();
