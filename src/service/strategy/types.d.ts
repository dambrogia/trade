import {Candles, ICandle} from '../data/types';

export type StrategyExitType = 'bar-close' | 'real-time';

export type StrategyContext = Record<string, any> & {
    windowSize: number;
}

export interface IStrategy {
    id: string;
    context: StrategyContext;

    asset: {
        symbol: string;
        type: string;
    }

    /**
     * Entry configurations
     */
    matchesLongEnter: (curr: ICandle) => Promise<boolean>
    matchesShortEnter: (curr: ICandle) => Promise<boolean>
    // number returned will be subtracted from long and added to short strike prices
    stopLossDiff: (curr: ICandle) => number;
    // number returned will be added to long and subtracted from short strike prices
    takeProfDiff: (curr: ICandle) => number;

    // Whether to set exit price as candle close or stop loss (to mock real time).
    exitStrategy: ExitStrategy;
    isExpired: (curr: ICandle, enteredAt: Date) => boolean;
    trailingLossStepSize: number;

    /**
     * Grab historical data for a backtest.
     */
    getHistoricalData: () => Promise<Candles>;

    /**
     * Logic to exit position
     */
    exit: (curr: ICandle) => Promise<void>;

    /**
     * Set trailing stop loss and take profits
     */
    trailStops: (curr: ICandle) => Promise<void>;

    /**
     * Set data on the current candle to allow for entering a position.
     */
    setData: (curr: ICandle, candles: Candles) => Promise<void>;

    /**
     * Logic for entering a trade, including executing order.
     */
    enter: (curr: ICandle) => Promise<void>;
}
