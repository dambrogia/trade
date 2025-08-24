import {BarSizeSetting, SecType, WhatToShow} from '@stoqey/ib';
import {StrategyExitType, IStrategy} from './types';
import {AbstractStrategy} from './abstract-strategy';
import {Candles, ICandle} from '../data/types';
import {TradingIndicators} from '../analysis/indicators';

export class ES1HRBreakout extends AbstractStrategy implements IStrategy {
    id = 'es-1hr-breakout';
    exitStrategy: StrategyExitType = 'bar-close';
    trailingLossStepSize: number = 5;

    asset = {
        symbol: 'ES',
        type: SecType.CONTFUT,
    };

    protected getHistoricalDataParams(): any[] {
        return [
            {symbol: this.asset.symbol, secType: this.asset.type, exchange: 'CME'},
            undefined,
            '5 Y',
            BarSizeSetting.HOURS_ONE,
            WhatToShow.BID_ASK,
            false,
        ];
    }

    async matchesLongEnter(curr: ICandle): Promise<boolean> {
        return (curr.data.ema9CrossingBullish || curr.data.ema20CrossingBullish || curr.data.ema50CrossingBullish)
            && curr.data.atr <= 50
            && (curr.data.adx >= 5 && curr.data.adx <= 30)
            && (curr.data.ema9Diff >= -15 && curr.data.ema9Diff <= 3)
            && (curr.data.ema20Diff >= -10 && curr.data.ema20Diff <= 3)
            && curr.data.ema20Angle1 <= 25
            && (curr.data.rsi >= 45 && curr.data.rsi <= 60)
            // This is a weird seemingly institutional outlier where around 10 it was very negative.
            && !(curr.data.stdDev >= 9 && curr.data.stdDev <= 11)
            && curr.data.positiveDirectionalIndicator >= 15;
    }

    async matchesShortEnter(curr: ICandle): Promise<boolean> {
        return (curr.data.ema9CrossingBearish || curr.data.ema20CrossingBearish || curr.data.ema50CrossingBearish)
            && curr.data.atr < 60
            && curr.data.negativeDirectionalIndicator >= 15
            && curr.data.positiveDirectionalIndicator >= 10
            && (curr.data.ema9Diff >= -2 && curr.data.ema9Diff <= 20)
            && (curr.data.ema20Diff >= -1.5 && curr.data.ema9Diff <= 15)
            && (curr.data.macd.signal >= -4 && curr.data.macd.signal <= 6)
            && curr.data.stdDev < 15;
    }

    stopLossDiff(curr: ICandle): number {
        return 4;
    }

    takeProfDiff(curr: ICandle): number {
        return 16;
    }

    async setData(curr: ICandle, candles: Candles): Promise<void> {
        await super.setData(curr, candles);

        const emas: Record<string, number>= {
            'ema9': 9,
            'ema20': 20,
            'ema50': 50,
        };

        for (const ema in emas) {
            const n = emas[ema];

            const emaN = await TradingIndicators.calculateEMA(candles, n);
            curr.data[`${ema}Angle1`] = TradingIndicators.getAngle(emaN, 1);
            curr.data[`${ema}Angle3`] = TradingIndicators.getAngle(emaN, 3);
            curr.data[`${ema}Angle5`] = TradingIndicators.getAngle(emaN, 5);

            curr.data[`${ema}CrossingBullish`] = emaN[emaN.length - 1] > emaN[emaN.length - 2]
                && emaN[emaN.length - 2] < emaN[emaN.length - 3];

            curr.data[`${ema}CrossingBearish`] = emaN[emaN.length - 1] < emaN[emaN.length - 2]
                && emaN[emaN.length - 2] > emaN[emaN.length - 3];
        }
    }
}
