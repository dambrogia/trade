import {BarSizeSetting, SecType, WhatToShow} from '@stoqey/ib';
import {StrategyExitType, IStrategy} from './types';
import {AbstractStrategy} from './abstract-strategy';
import {ICandle} from '../data/types';

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
            '4 Y',
            BarSizeSetting.HOURS_ONE,
            WhatToShow.TRADES,
            false,
        ];
    }

    normalize(curr: ICandle): number[] {
        // return a number between zer
        const clamp = (x: number, min: number = -0.99, max: number = 0.99) => {
            return Math.max(Math.min(x, max), min);
        };

        // the goal is to normalize all these values with a scale from -1 <=> 1
        const data = { // kept in object for visual debugging
            emaAng: clamp((curr.data.ema9Angle1 / 100)),
            emaAng20: clamp((curr.data.ema20Angle1 / 100)),
            emaDiff: clamp((curr.data.ema9Diff / 100)),
            emaDiff20: clamp((curr.data.ema20Diff / 100)),
            rocp: clamp(curr.data.rocp * 10),
            relVol: clamp(curr.data.relVol1 - 1),
            adx: clamp(curr.data.adx / 1000),
            bullish: curr.data.cdl.isBullish ? 0.1 : -0.1,
        };

        return Object.values(data);
    }

    async matchesLongEnter(curr: ICandle): Promise<boolean> {
        return curr.data.ema9CrossingBullish;
    }

    async matchesShortEnter(curr: ICandle): Promise<boolean> {
        return curr.data.ema9CrossingBearish;
    }

    stopLossDiff(curr: ICandle): number {
        return 4;
    }

    takeProfDiff(curr: ICandle): number {
        return 16;
    }
}
