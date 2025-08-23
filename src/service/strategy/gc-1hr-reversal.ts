import {BarSizeSetting, SecType, WhatToShow} from '@stoqey/ib';
import {StrategyExitType, IStrategy} from './types';
import {AbstractStrategy} from './abstract-strategy';
import {ICandle} from '../data/types';

export class GC1HRReversal extends AbstractStrategy implements IStrategy {
    id = 'gc-1hr-reversal';
    exitStrategy: StrategyExitType = 'bar-close';
    trailingLossStepSize: number = 8;

    asset = {
        symbol: 'GC',
        type: SecType.CONTFUT,
    };

    protected getHistoricalDataParams(): any[] {
        return [
            {symbol: this.asset.symbol, secType: this.asset.type, exchange: 'COMEX'},
            undefined,
            '5 Y',
            BarSizeSetting.HOURS_ONE,
            WhatToShow.BID_ASK,
            false,
        ];
    }

    async matchesLongEnter(c: ICandle): Promise<boolean> {
        return c.data.atSupport
            && (c.data.ema9Diff >= -5 && c.data.ema9Diff <= 1.5)
            && (c.data.ema20Diff >= -5 && c.data.ema20Diff < 0)
            && c.data.macd.signal < 2.5
            && ! (c.data.utcHour >= 12 && c.data.utcHour <= 15) // can be disabled when only trading days 2 - 4
            && (c.data.utcDow >= 2 && c.data.utcDow <= 4)
            && (c.data.stdDev >= 0 && c.data.stdDev <= 20);
    }

    async matchesShortEnter(curr: ICandle): Promise<boolean> {
        return curr.data.atResistance
            && curr.data.ema9Diff >= -2
            && curr.data.ema20Diff >= -1.5
            && (curr.data.rocp >= -0.003 && curr.data.rocp <= 0.003)
            && (curr.data.macd.signal >= -1.5 && curr.data.macd.signal <= 2)
            && ! (curr.data.utcHour >= 16 && curr.data.utcHour <= 18)
            && (curr.data.utcDow >= 2 && curr.data.utcDow <= 6)
            && (curr.data.linRegAng >= -20 && curr.data.linRegAng <= 0);
    }

    stopLossDiff(curr: ICandle): number {
        return 3;
    }

    takeProfDiff(curr: ICandle): number {
        return 21;
    }
}
