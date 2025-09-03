import {BarSizeSetting, SecType, WhatToShow} from '@stoqey/ib';
import {StrategyExitType, IStrategy} from './types';
import {AbstractStrategy} from './abstract-strategy';
import {ICandle} from '../data/types';

export class GC15minCrossover extends AbstractStrategy implements IStrategy {
    id = 'gc-15min-crossover';
    exitStrategy: StrategyExitType = 'bar-close';
    trailingLossStepSize: number = 3; // disable trailing stop loss

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
        return (curr.data.ema9CrossingBullish);
        // && curr.data.atr <= 50
        // && (curr.data.adx >= 5 && curr.data.adx <= 30)
        // && (curr.data.ema9Diff >= -15 && curr.data.ema9Diff <= 3)
        // && (curr.data.ema20Diff >= -10 && curr.data.ema20Diff <= 3)
        // && curr.data.ema20Angle1 <= 25
        // && (curr.data.rsi >= 45 && curr.data.rsi <= 60)
        // // This is a weird seemingly institutional outlier where around 10 it was very negative.
        // && !(curr.data.stdDev >= 9 && curr.data.stdDev <= 11)
        // && curr.data.positiveDirectionalIndicator >= 15;
    }

    async matchesShortEnter(curr: ICandle): Promise<boolean> {
        return (curr.data.ema9CrossingBearish);
        // && curr.data.atr < 60
        // && curr.data.negativeDirectionalIndicator >= 15
        // && curr.data.positiveDirectionalIndicator >= 10
        // && (curr.data.ema9Diff >= -2 && curr.data.ema9Diff <= 20)
        // && (curr.data.ema20Diff >= -1.5 && curr.data.ema9Diff <= 15)
        // && (curr.data.macd.signal >= -4 && curr.data.macd.signal <= 6)
        // && curr.data.stdDev < 15;
    }

    stopLossDiff(curr: ICandle): number {
        return 3;
    }

    takeProfDiff(curr: ICandle): number {
        return 6;
    }

    isExpired(curr: ICandle, enteredAt: Date): boolean {
        const isEow = curr.d.getUTCDay() === 6 && curr.d.getUTCHours() == 3;
        const msElapsed = curr.d.getTime() - enteredAt.getTime();
        const hoursElapsed = Math.floor((msElapsed / 1000) / 60 / 60);
        return isEow || hoursElapsed > 3;
    }
}
