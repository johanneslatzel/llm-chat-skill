export function envInt(key: string, fallback: number, min = 1, max?: number): number {
    const raw = process.env[key];
    let value: number;
    if (raw === undefined || raw === '') {
        value = Math.max(min, fallback);
    } else {
        const parsed = parseInt(raw, 10);
        value = Number.isNaN(parsed) ? Math.max(min, fallback) : Math.max(min, parsed);
    }
    return max !== undefined ? Math.min(max, value) : value;
}

export function envString(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
}
