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
            '5 Y',
            BarSizeSetting.HOURS_ONE,
            WhatToShow.BID_ASK,
            false,
        ];
    }

    async matchesLongEnter(curr: ICandle): Promise<boolean> {
        return curr.data.atSupport;
    }

    async matchesShortEnter(curr: ICandle): Promise<boolean> {
        return curr.data.atResistance;
    }

    stopLossDiff(curr: ICandle): number {
        return 3;
    }

    takeProfDiff(curr: ICandle): number {
        return 9;
    }
}
