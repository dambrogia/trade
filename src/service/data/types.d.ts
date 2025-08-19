export interface ICandle {
    h: number; // high
    l: number; // low
    o: number; // open
    c: number; // close
    d: Date; // date
    v?: number; // volume
    data?: Record<string, any>; // metadata holder
}

export type Candles = ICandle[];

export interface SupportResistanceLevel {
    support: number | null;
    resistance: number | null;
}

export interface SupportResistanceOptions {
    minTouches: number;
    threshold: number;
    lookback: number;
}
