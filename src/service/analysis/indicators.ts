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
    static isAtSupport(candles: Candles, threshold: number, options: SupportResistanceOptions = {minTouches: 3, threshold: 5, lookback: 50}): boolean {
        if (candles.length === 0) return false;

        const {support} = this.findSupportResistance(candles, options);
        if (support === null) return false;

        const currentCandle = candles[candles.length - 1];
        return Math.abs(currentCandle.l - support) <= threshold;
    }

    // Check if current candle is at resistance
    static isAtResistance(candles: Candles, threshold: number, options: SupportResistanceOptions = {minTouches: 3, threshold: 5, lookback: 50}): boolean {
        if (candles.length === 0) return false;

        const {resistance} = this.findSupportResistance(candles, options);
        if (resistance === null) return false;

        const currentCandle = candles[candles.length - 1];
        return Math.abs(currentCandle.h - resistance) <= threshold;
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
    static async calculateADX(candles: Candles, period: number = 14): Promise<{ adx: number[], plusDI: number[], minusDI: number[] }> {
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

        try {
            const [adx, plusDI, minusDI] = await Promise.all([adxPromise, plusDIPromise, minusDIPromise]);
            return {adx, plusDI, minusDI};
        } catch (error) {
            throw error;
        }
    }

    // EMA (Exponential Moving Average)
    static async calculateEMA(candles: Candles, period: number, property: 'o' | 'h' | 'l' | 'c' = 'c'): Promise<number[]> {
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
}
