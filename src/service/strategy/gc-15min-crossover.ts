import {BarSizeSetting, SecType, WhatToShow} from '@stoqey/ib';
import {StrategyExitType, IStrategy} from './types';
import {AbstractStrategy} from './abstract-strategy';
import {Candles, ICandle} from '../data/types';
import {TradingIndicators} from '../analysis/indicators';

export class GC15minCrossover extends AbstractStrategy implements IStrategy {
    id = 'gc-15min-crossover';
    exitStrategy: StrategyExitType = 'bar-close';
    trailingLossStepSize: number = 100; // disable trailing stop loss

    asset = {
        symbol: 'GC',
        type: SecType.CONTFUT,
    };

    protected getHistoricalDataParams(): any[] {
        return [
            {symbol: this.asset.symbol, secType: this.asset.type, exchange: 'COMEX'},
            undefined,
            '1 W',
            BarSizeSetting.MINUTES_FIFTEEN,
            WhatToShow.TRADES,
            false,
        ];
    }

    async matchesLongEnter(curr: ICandle): Promise<boolean> {
        return (curr.data.ema9CrossingBullish || curr.data.ema20CrossingBullish || curr.data.ema50CrossingBullish);
    }

    async matchesShortEnter(curr: ICandle): Promise<boolean> {
        return (curr.data.ema9CrossingBearish || curr.data.ema20CrossingBearish || curr.data.ema50CrossingBearish);
    }

    async setData(curr: ICandle, candles: Candles): Promise<void> {
        const emas: Record<string, number> = {
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

    stopLossDiff(curr: ICandle): number {
        return 2;
    }

    takeProfDiff(curr: ICandle): number {
        return 6;
    }
}
