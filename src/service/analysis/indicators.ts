// eslint-disable-next-line @typescript-eslint/no-require-imports
const talib = require('talib');
import {Candles, SupportResistanceLevel, SupportResistanceOptions} from '../data/types';

export class TradingIndicators {

    // Horizontal Support and Resistance
    static findSupportResistance(
        candles: Candles,
        options: SupportResistanceOptions = {minTouches: 3, threshold: 5, lookback: 50},
    ): SupportResistanceLevel {
        const lookbackCandles = candles.slice(-options.lookback);

        if (lookbackCandles.length < options.minTouches) {
            return {support: null, resistance: null};
        }

        // Find support levels based on lows
        const supportLevels: Map<number, number> = new Map();
        lookbackCandles.forEach(candle => {
            const roundedLevel = Math.round(candle.l / options.threshold) * options.threshold;
            supportLevels.set(roundedLevel, (supportLevels.get(roundedLevel) || 0) + 1);
        });

        // Find resistance levels based on highs
        const resistanceLevels: Map<number, number> = new Map();
        lookbackCandles.forEach(candle => {
            const roundedLevel = Math.round(candle.h / options.threshold) * options.threshold;
            resistanceLevels.set(roundedLevel, (resistanceLevels.get(roundedLevel) || 0) + 1);
        });

        // Get strongest support level
        let support: number | null = null;
        let maxSupportTouches = 0;
        for (const [level, touches] of supportLevels) {
            if (touches >= options.minTouches && touches > maxSupportTouches) {
                support = level;
                maxSupportTouches = touches;
            }
        }

        // Get strongest resistance level
        let resistance: number | null = null;
        let maxResistanceTouches = 0;
        for (const [level, touches] of resistanceLevels) {
            if (touches >= options.minTouches && touches > maxResistanceTouches) {
                resistance = level;
                maxResistanceTouches = touches;
            }
        }

        return {support, resistance};
    }

    // Check if current candle is at support
    static isAtSupport(
        candles: Candles,
        threshold: number,
        options: SupportResistanceOptions = {minTouches: 3, threshold: 5, lookback: 50},
    ): boolean {
        if (candles.length === 0) return false;

        const {support, resistance} = this.findSupportResistance(candles, options);
        if (support === null) return false;

        const currentCandle = candles[candles.length - 1];
        const distToResistance = Math.abs(currentCandle.c - (resistance || currentCandle.c));
        const distToSupport  = Math.abs(currentCandle.c - support);

        return Math.abs(currentCandle.c - support) <= threshold
            && (resistance === null || distToSupport < distToResistance * 0.75);
    }

    // Check if current candle is at resistance
    static isAtResistance(
        candles: Candles,
        threshold: number,
        options: SupportResistanceOptions = {minTouches: 3, threshold: 5, lookback: 50},
    ): boolean {
        if (candles.length === 0) return false;

        const {support, resistance} = this.findSupportResistance(candles, options);
        if (resistance === null) return false;

        const currentCandle = candles[candles.length - 1];
        const distToResistance = Math.abs(currentCandle.c - resistance);
        const distToSupport  = Math.abs(currentCandle.c - (support || currentCandle.c));

        return Math.abs(currentCandle.h - resistance) <= threshold
            && (support === null || distToResistance < distToSupport * 0.75);
    }

    // ATR (Average True Range)
    static async calculateATR(candles: Candles, period: number = 14): Promise<number[]> {
        if (candles.length < period) return [];

        const marketData = {
            high: candles.map(c => c.h),
            low: candles.map(c => c.l),
            close: candles.map(c => c.c),
        };

        return new Promise((resolve, reject) => {
            talib.execute({
                name: 'ATR',
                startIdx: 0,
                endIdx: candles.length - 1,
                high: marketData.high,
                low: marketData.low,
                close: marketData.close,
                optInTimePeriod: period,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });
    }

    // ADX (Average Directional Movement Index)
    static async calculateADX(
        candles: Candles,
        period: number = 14,
    ): Promise<{ adx: number[], plusDI: number[], minusDI: number[] }> {
        if (candles.length < period) return {adx: [], plusDI: [], minusDI: []};

        const marketData = {
            high: candles.map(c => c.h),
            low: candles.map(c => c.l),
            close: candles.map(c => c.c),
        };

        const adxPromise = new Promise<number[]>((resolve, reject) => {
            talib.execute({
                name: 'ADX',
                startIdx: 0,
                endIdx: candles.length - 1,
                high: marketData.high,
                low: marketData.low,
                close: marketData.close,
                optInTimePeriod: period,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });

        const plusDIPromise = new Promise<number[]>((resolve, reject) => {
            talib.execute({
                name: 'PLUS_DI',
                startIdx: 0,
                endIdx: candles.length - 1,
                high: marketData.high,
                low: marketData.low,
                close: marketData.close,
                optInTimePeriod: period,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });

        const minusDIPromise = new Promise<number[]>((resolve, reject) => {
            talib.execute({
                name: 'MINUS_DI',
                startIdx: 0,
                endIdx: candles.length - 1,
                high: marketData.high,
                low: marketData.low,
                close: marketData.close,
                optInTimePeriod: period,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });

        const promises = [adxPromise, plusDIPromise, minusDIPromise];
        const [adx, plusDI, minusDI] = await Promise.all(promises);
        return {adx, plusDI, minusDI};
    }

    // EMA (Exponential Moving Average)
    static async calculateEMA(
        candles: Candles,
        period: number,
        property: 'o' | 'h' | 'l' | 'c' = 'c',
    ): Promise<number[]> {
        if (candles.length < period) return [];

        const values = candles.map(c => c[property]);

        return new Promise((resolve, reject) => {
            talib.execute({
                name: 'EMA',
                startIdx: 0,
                endIdx: candles.length - 1,
                inReal: values,
                optInTimePeriod: period,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });
    }

    // 1. Rate of Change Percentage
    static async calculateROCP(
        candles: Candles,
        period: number = 10,
        property: 'o' | 'h' | 'l' | 'c' = 'c',
    ): Promise<number[]> {
        if (candles.length < period) return [];

        const values = candles.map(c => c[property]);

        return new Promise((resolve, reject) => {
            talib.execute({
                name: 'ROCP',
                startIdx: 0,
                endIdx: candles.length - 1,
                inReal: values,
                optInTimePeriod: period,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });
    }

    // 2. Standard Deviation
    static async calculateSTDDEV(
        candles: Candles,
        period: number = 20,
        property: 'o' | 'h' | 'l' | 'c' = 'c',
        nbDev: number = 1,
    ): Promise<number[]> {
        if (candles.length < period) return [];

        const values = candles.map(c => c[property]);

        return new Promise((resolve, reject) => {
            talib.execute({
                name: 'STDDEV',
                startIdx: 0,
                endIdx: candles.length - 1,
                inReal: values,
                optInTimePeriod: period,
                optInNbDev: nbDev,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });
    }

    // 3. MACD (Moving Average Convergence Divergence)
    static async calculateMACD(
        candles: Candles,
        fastPeriod: number = 12,
        slowPeriod: number = 26,
        signalPeriod: number = 9,
        property: 'o' | 'h' | 'l' | 'c' = 'c',
    ): Promise<{ macd: number[], signal: number[], histogram: number[] }> {
        if (candles.length < slowPeriod) return {macd: [], signal: [], histogram: []};

        const values = candles.map(c => c[property]);

        const macdPromise = new Promise<number[]>((resolve, reject) => {
            talib.execute({
                name: 'MACD',
                startIdx: 0,
                endIdx: candles.length - 1,
                inReal: values,
                optInFastPeriod: fastPeriod,
                optInSlowPeriod: slowPeriod,
                optInSignalPeriod: signalPeriod,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outMACD || []);
                }
            });
        });

        const signalPromise = new Promise<number[]>((resolve, reject) => {
            talib.execute({
                name: 'MACD',
                startIdx: 0,
                endIdx: candles.length - 1,
                inReal: values,
                optInFastPeriod: fastPeriod,
                optInSlowPeriod: slowPeriod,
                optInSignalPeriod: signalPeriod,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outMACDSignal || []);
                }
            });
        });

        const histogramPromise = new Promise<number[]>((resolve, reject) => {
            talib.execute({
                name: 'MACD',
                startIdx: 0,
                endIdx: candles.length - 1,
                inReal: values,
                optInFastPeriod: fastPeriod,
                optInSlowPeriod: slowPeriod,
                optInSignalPeriod: signalPeriod,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outMACDHist || []);
                }
            });
        });

        const [macd, signal, histogram] = await Promise.all([macdPromise, signalPromise, histogramPromise]);
        return {macd, signal, histogram};
    }

    // 4. RSI (Relative Strength Index)
    static async calculateRSI(
        candles: Candles,
        period: number = 14,
        property: 'o' | 'h' | 'l' | 'c' = 'c',
    ): Promise<number[]> {
        if (candles.length < period) return [];

        const values = candles.map(c => c[property]);

        return new Promise((resolve, reject) => {
            talib.execute({
                name: 'RSI',
                startIdx: 0,
                endIdx: candles.length - 1,
                inReal: values,
                optInTimePeriod: period,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });
    }

    // 5. Linear Regression
    static async calculateLINEARREG(
        candles: Candles,
        period: number = 14,
        property: 'o' | 'h' | 'l' | 'c' = 'c',
    ): Promise<number[]> {
        if (candles.length < period) return [];

        const values = candles.map(c => c[property]);

        return new Promise((resolve, reject) => {
            talib.execute({
                name: 'LINEARREG',
                startIdx: 0,
                endIdx: candles.length - 1,
                inReal: values,
                optInTimePeriod: period,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });
    }

    // 6. Linear Regression Angle
    static async calculateLINEARREGANGLE(
        candles: Candles,
        period: number = 14,
        property: 'o' | 'h' | 'l' | 'c' = 'c',
    ): Promise<number[]> {
        if (candles.length < period) return [];

        const values = candles.map(c => c[property]);

        return new Promise((resolve, reject) => {
            talib.execute({
                name: 'LINEARREG_ANGLE',
                startIdx: 0,
                endIdx: candles.length - 1,
                inReal: values,
                optInTimePeriod: period,
            }, (err: any, result: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.result.outReal || []);
                }
            });
        });
    }
}
