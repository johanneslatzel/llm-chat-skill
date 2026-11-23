import {
    createEnvReader,
    EmptyStringPolicy,
    NumberParsing,
    RangePolicy
} from '@johannes.latzel/env';

function makeEnv() {
    return createEnvReader({
        numberParsing: NumberParsing.Lenient,
        rangePolicy: RangePolicy.Clamp,
        emptyString: EmptyStringPolicy.Value
    });
}

/** Read an integer clamped to the inclusive bounds, or the clamped fallback. */
export function envInt(key: string, fallback: number, min = 1, max?: number): number {
    const safeFallback = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, fallback));
    return makeEnv().int(key, safeFallback, min, max);
}

/** Read a string, preserving an explicitly empty value. */
export function envString(key: string, fallback: string): string {
    return makeEnv().string(key, fallback);
}
