/**
 * Plain console logging with a time stamp and an area, so `docker logs -f` shows what
 * happens. LOG_LEVEL=debug|info|warn|error (default info). Never log secrets or passwords.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const minimum = LEVELS[(process.env.LOG_LEVEL ?? 'info').toLowerCase() as Level] ?? LEVELS.info;

function format(value: unknown): string {
	if (value instanceof Error) return value.stack ?? value.message;
	if (typeof value === 'string') return value;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function write(level: Level, area: string, message: string, details?: unknown) {
	if (LEVELS[level] < minimum) return;
	const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${area}] ${message}${details === undefined ? '' : ` ${format(details)}`}`;
	if (level === 'error') console.error(line);
	else if (level === 'warn') console.warn(line);
	else console.log(line);
}

export function logger(area: string) {
	return {
		debug: (message: string, details?: unknown) => write('debug', area, message, details),
		info: (message: string, details?: unknown) => write('info', area, message, details),
		warn: (message: string, details?: unknown) => write('warn', area, message, details),
		error: (message: string, details?: unknown) => write('error', area, message, details)
	};
}
