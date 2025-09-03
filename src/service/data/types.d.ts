export interface ICandle {
    h: number; // high
    l: number; // low
    o: number; // open
    c: number; // close
    d: Date; // date
    v?: number; // volume
    data: Record<string, any> & {
        testId?: string;
    }
}

export interface LiveTick {
    price: number;
    volume?: number;
    timestamp: Date;
}
export interface AggregatorOptions {
    symbol: string;
    timeframe: string; // '1min', '5min', '15min', '1hr', etc.
    onBarClose?: (candle: ICandle) => void;
    onBarOpen?: (candle: ICandle) => void;
    onBarUpdate?: (candle: ICandle) => void;
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
