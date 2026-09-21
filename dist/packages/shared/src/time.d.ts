export declare const MINUTE_MS = 60000;
export declare function minutesBetween(start: Date, end: Date): number;
export declare function addMinutes(date: Date, minutes: number): Date;
export declare function maxDate(...dates: Date[]): Date;
export declare function minDate(...dates: Date[]): Date;
export declare function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean;
export declare function roundUpToQuantum(minutes: number, quantum?: number): number;
export declare function sortByStart<T extends {
    startAt: Date;
}>(items: T[]): T[];
