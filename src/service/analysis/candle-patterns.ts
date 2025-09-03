import {ICandle} from '../data/types';

export type Candles = ICandle[];
export class CandlePatterns {

    // Helper methods
    private static bodySize(candle: ICandle): number {
        return Math.abs(candle.c - candle.o);
    }

    private static range(candle: ICandle): number {
        return candle.h - candle.l;
    }

    private static upperShadow(candle: ICandle): number {
        return candle.h - Math.max(candle.o, candle.c);
    }

    private static lowerShadow(candle: ICandle): number {
        return Math.min(candle.o, candle.c) - candle.l;
    }

    static isBullish(candle: ICandle): boolean {
        return candle.c > candle.o;
    }

    static isBearish(candle: ICandle): boolean {
        return candle.c < candle.o;
    }

    static hasLargeBody(candle: ICandle, bodySize: number = 0.75): boolean {
        return this.bodySize(candle) / this.range(candle) >= bodySize;
    }

    static hasSmallBody(candle: ICandle, bodySize: number = 0.25): boolean {
        return this.bodySize(candle) / this.range(candle) <= bodySize;
    }

    // Original methods
    static isDoji(candle: ICandle, threshold: number = 1): boolean {
        return this.bodySize(candle) <= this.range(candle) * (0.15 * threshold)
            && this.upperShadow(candle) <= this.range(candle) * 0.65
            && this.lowerShadow(candle) <= this.range(candle) * 0.65;
    }

    static isHammer(candle: ICandle): boolean {
        return this.upperShadow(candle) <= this.range(candle) * 0.15
            && this.lowerShadow(candle) >= this.range(candle) * 0.65;
    }

    static isShootingStar(candle: ICandle): boolean {
        return this.lowerShadow(candle) <= this.range(candle) * 0.15
            && this.upperShadow(candle) >= this.range(candle) * 0.65;
    }

    // Custom implementations of the 10 key patterns

    // 1. Hammer - Bullish reversal (single candle)
    static cdlhammer(candles: Candles): number[] {
        return candles.map(candle => {
            const body = this.bodySize(candle);
            const range = this.range(candle);
            const upperShadow = this.upperShadow(candle);
            const lowerShadow = this.lowerShadow(candle);

            if (range === 0) return 0;

            // Hammer criteria: small body, long lower shadow, small upper shadow
            const isHammer =
                body / range <= 0.3 &&                    // Small body
                lowerShadow >= 2 * body &&                // Long lower shadow
                upperShadow <= body * 0.5 &&              // Small upper shadow
                lowerShadow >= range * 0.6;               // Lower shadow dominates

            return isHammer ? 100 : 0;
        });
    }

    // 2. Shooting Star - Bearish reversal (single candle)
    static cdlshootingstar(candles: Candles): number[] {
        return candles.map(candle => {
            const body = this.bodySize(candle);
            const range = this.range(candle);
            const upperShadow = this.upperShadow(candle);
            const lowerShadow = this.lowerShadow(candle);

            if (range === 0) return 0;

            // Shooting star criteria: small body, long upper shadow, small lower shadow
            const isShootingStar =
                body / range <= 0.3 &&                    // Small body
                upperShadow >= 2 * body &&                // Long upper shadow
                lowerShadow <= body * 0.5 &&              // Small lower shadow
                upperShadow >= range * 0.6;               // Upper shadow dominates

            return isShootingStar ? -100 : 0;
        });
    }

    // 3. Morning Star - Bullish reversal (3 candles)
    static cdlmorningstar(candles: Candles, penetration: number = 0.3): number[] {
        const results = new Array(candles.length).fill(0);

        for (let i = 2; i < candles.length; i++) {
            const first = candles[i - 2];   // Bearish candle
            const second = candles[i - 1];  // Small body (star)
            const third = candles[i];       // Bullish candle

            const firstBody = this.bodySize(first);
            const secondBody = this.bodySize(second);
            const thirdBody = this.bodySize(third);

            // Morning star criteria
            const isMorningStar =
                this.isBearish(first) &&                           // First candle bearish
                firstBody > this.range(first) * 0.5 &&             // First candle has large body
                secondBody < this.range(second) * 0.3 &&           // Second candle small body (star)
                second.h < first.c &&                              // Gap down
                this.isBullish(third) &&                           // Third candle bullish
                thirdBody > this.range(third) * 0.5 &&             // Third candle has large body
                third.c > first.c + (first.o - first.c) * penetration; // Penetration into first candle

            results[i] = isMorningStar ? 100 : 0;
        }

        return results;
    }

    // 4. Morning Doji Star - Bullish reversal with doji
    static cdlmorningdojistar(candles: Candles, penetration: number = 0.3): number[] {
        const results = new Array(candles.length).fill(0);

        for (let i = 2; i < candles.length; i++) {
            const first = candles[i - 2];
            const second = candles[i - 1];  // Doji
            const third = candles[i];

            const firstBody = this.bodySize(first);
            const thirdBody = this.bodySize(third);

            const isMorningDojiStar =
                this.isBearish(first) &&
                firstBody > this.range(first) * 0.5 &&
                this.isDoji(second, 0.1) &&                        // Middle candle is doji
                second.h < first.c &&                              // Gap down
                this.isBullish(third) &&
                thirdBody > this.range(third) * 0.5 &&
                third.c > first.c + (first.o - first.c) * penetration;

            results[i] = isMorningDojiStar ? 100 : 0;
        }

        return results;
    }

    // 5. Evening Star - Bearish reversal (3 candles)
    static cdleveningstar(candles: Candles, penetration: number = 0.3): number[] {
        const results = new Array(candles.length).fill(0);

        for (let i = 2; i < candles.length; i++) {
            const first = candles[i - 2];   // Bullish candle
            const second = candles[i - 1];  // Small body (star)
            const third = candles[i];       // Bearish candle

            const firstBody = this.bodySize(first);
            const secondBody = this.bodySize(second);
            const thirdBody = this.bodySize(third);

            const isEveningStar =
                this.isBullish(first) &&
                firstBody > this.range(first) * 0.5 &&
                secondBody < this.range(second) * 0.3 &&
                second.l > first.c &&                              // Gap up
                this.isBearish(third) &&
                thirdBody > this.range(third) * 0.5 &&
                third.c < first.c - (first.c - first.o) * penetration;

            results[i] = isEveningStar ? -100 : 0;
        }

        return results;
    }

    // 6. Evening Doji Star - Bearish reversal with doji
    static cdleveningdojistar(candles: Candles, penetration: number = 0.3): number[] {
        const results = new Array(candles.length).fill(0);

        for (let i = 2; i < candles.length; i++) {
            const first = candles[i - 2];
            const second = candles[i - 1];  // Doji
            const third = candles[i];

            const firstBody = this.bodySize(first);
            const thirdBody = this.bodySize(third);

            const isEveningDojiStar =
                this.isBullish(first) &&
                firstBody > this.range(first) * 0.5 &&
                this.isDoji(second, 0.1) &&
                second.l > first.c &&                              // Gap up
                this.isBearish(third) &&
                thirdBody > this.range(third) * 0.5 &&
                third.c < first.c - (first.c - first.o) * penetration;

            results[i] = isEveningDojiStar ? -100 : 0;
        }

        return results;
    }

    // 7. Piercing Pattern - Bullish reversal (2 candles)
    static cdlpiercing(candles: Candles): number[] {
        const results = new Array(candles.length).fill(0);

        for (let i = 1; i < candles.length; i++) {
            const first = candles[i - 1];   // Bearish candle
            const second = candles[i];      // Bullish candle

            const firstBody = this.bodySize(first);
            const secondBody = this.bodySize(second);

            const isPiercing =
                this.isBearish(first) &&
                firstBody > this.range(first) * 0.6 &&             // First candle has large bearish body
                this.isBullish(second) &&
                secondBody > this.range(second) * 0.6 &&           // Second candle has large bullish body
                second.o < first.l &&                              // Second opens below first's low
                second.c > first.c + (first.o - first.c) * 0.5 &&  // Closes above midpoint of first
                second.c < first.o;                                // But below first's open

            results[i] = isPiercing ? 100 : 0;
        }

        return results;
    }

    // 8. Dark Cloud Cover - Bearish reversal (2 candles)
    static cdldarkcloudcover(candles: Candles, penetration: number = 0.5): number[] {
        const results = new Array(candles.length).fill(0);

        for (let i = 1; i < candles.length; i++) {
            const first = candles[i - 1];   // Bullish candle
            const second = candles[i];      // Bearish candle

            const firstBody = this.bodySize(first);
            const secondBody = this.bodySize(second);

            const isDarkCloud =
                this.isBullish(first) &&
                firstBody > this.range(first) * 0.6 &&
                this.isBearish(second) &&
                secondBody > this.range(second) * 0.6 &&
                second.o > first.h &&                              // Second opens above first's high
                second.c < first.c - (first.c - first.o) * penetration && // Penetrates into first body
                second.c > first.o;                                // But above first's open

            results[i] = isDarkCloud ? -100 : 0;
        }

        return results;
    }

    // 9. Engulfing Pattern - Powerful reversal (2 candles)
    static cdlengulfing(candles: Candles): number[] {
        const results = new Array(candles.length).fill(0);

        for (let i = 1; i < candles.length; i++) {
            const first = candles[i - 1];
            const second = candles[i];

            const firstBody = this.bodySize(first);
            const secondBody = this.bodySize(second);

            // Bullish engulfing
            const isBullishEngulfing =
                this.isBearish(first) &&
                this.isBullish(second) &&
                second.o < first.c &&                              // Second opens below first's close
                second.c > first.o &&                              // Second closes above first's open
                secondBody > firstBody * 1.1;                      // Second body is larger

            // Bearish engulfing
            const isBearishEngulfing =
                this.isBullish(first) &&
                this.isBearish(second) &&
                second.o > first.c &&                              // Second opens above first's close
                second.c < first.o &&                              // Second closes below first's open
                secondBody > firstBody * 1.1;                      // Second body is larger

            if (isBullishEngulfing) results[i] = 100;
            else if (isBearishEngulfing) results[i] = -100;
        }

        return results;
    }

    // 10. Doji - Indecision pattern (single candle)
    static cdldoji(candles: Candles, threshold: number = 0.05): number[] {
        return candles.map(candle => {
            const body = this.bodySize(candle);
            const range = this.range(candle);

            if (range === 0) return 0;

            const isDoji = (body / range) <= threshold;
            return isDoji ? 100 : 0;
        });
    }

    // Helper method to get last value
    static last<T>(array: T[]): T | undefined {
        return array[array.length - 1];
    }
}
