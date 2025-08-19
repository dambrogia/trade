import {ICandle} from '../data/types';

// Candle Pattern Recognition Class
export class CandlePatterns {

    static isDoji(candle: ICandle, threshold: number = 0.1): boolean {
        const bodySize = Math.abs(candle.c - candle.o);
        const range = candle.h - candle.l;
        return range > 0 && (bodySize / range) <= threshold;
    }

    static isHammer(candle: ICandle): boolean {
        const bodySize = Math.abs(candle.c - candle.o);
        const upperShadow = candle.h - Math.max(candle.o, candle.c);
        const lowerShadow = Math.min(candle.o, candle.c) - candle.l;
        const range = candle.h - candle.l;

        return range > 0 &&
               lowerShadow >= 2 * bodySize &&
               upperShadow <= bodySize * 0.5;
    }

    static isShootingStar(candle: ICandle): boolean {
        const bodySize = Math.abs(candle.c - candle.o);
        const upperShadow = candle.h - Math.max(candle.o, candle.c);
        const lowerShadow = Math.min(candle.o, candle.c) - candle.l;
        const range = candle.h - candle.l;

        return range > 0 &&
               upperShadow >= 2 * bodySize &&
               lowerShadow <= bodySize * 0.5;
    }

    static isBullish(candle: ICandle): boolean {
        return candle.c > candle.o;
    }

    static isBearish(candle: ICandle): boolean {
        return candle.c < candle.o;
    }
}
