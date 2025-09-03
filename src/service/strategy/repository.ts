import {ES1HRBreakout} from './es-1hr-breakout';
import {GC15minCrossover} from './gc-15min-crossover';
import {GC1HRReversal} from './gc-1hr-reversal';
import {IStrategy} from './types';

export const strategies = [
    ES1HRBreakout,
    GC1HRReversal,
    GC15minCrossover,
];

export const getStrategyById = (id: string): IStrategy | null => {
    for (let i = 0; i < strategies.length; i++) {
        const s = new strategies[i]();
        if (s.id === id) {
            return s;
        }
    }

    return null;
};
