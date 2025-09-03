import {AggregatorOptions, Candles, ICandle, LiveTick} from './types';

export enum AggregationTimeFrame {
    '1min' = 60 * 1000,
    '5min' = 5 * 60 * 1000,
    '15min' = 15 * 60 * 1000,
    '30min' = 30 * 60 * 1000,
    '1hr' = 60 * 60 * 1000,
    '2hr' = 2 * 60 * 60 * 1000,
    '4hr' = 4 * 60 * 60 * 1000,
    '1d' = 24 * 60 * 60 * 1000,
}

export class MarketDataAggregator {
    private symbol: string;
    private timeframeMs: number;
    private currentBar: ICandle | null = null;
    private closedBars: Candles = [];

    private onBarClose?: (candle: ICandle) => void;
    private onBarOpen?: (candle: ICandle) => void;
    private onBarUpdate?: (candle: ICandle) => void;

    constructor(options: AggregatorOptions) {
        this.symbol = options.symbol;
        this.timeframeMs = this.parseTimeframe(options.timeframe);
        this.onBarClose = options.onBarClose;
        this.onBarOpen = options.onBarOpen;
        this.onBarUpdate = options.onBarUpdate;
    }

    // Parse timeframe string to milliseconds
    private parseTimeframe(timeframe: string): number {
        const timeframeMap: Record<string, number> = {
            '1min': 60 * 1000,
            '5min': 5 * 60 * 1000,
            '15min': 15 * 60 * 1000,
            '30min': 30 * 60 * 1000,
            '1hr': 60 * 60 * 1000,
            '2hr': 2 * 60 * 60 * 1000,
            '4hr': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
        };

        const ms = timeframeMap[timeframe.toLowerCase()];
        if (!ms) {
            throw new Error(`Unsupported timeframe: ${timeframe}`);
        }
        return ms;
    }

    // Get the start time for a bar based on timestamp
    private getBarStartTime(timestamp: Date): Date {
        const ms = timestamp.getTime();
        const barStart = Math.floor(ms / this.timeframeMs) * this.timeframeMs;
        return new Date(barStart);
    }

    // Initialize with existing bars (from historical data or database)
    seedBars(historicalBars: Candles): void {
        this.closedBars = [...historicalBars];

        if (historicalBars.length > 0) {
            const lastBar = historicalBars[historicalBars.length - 1];
            const lastBarEnd = new Date(lastBar.d.getTime() + this.timeframeMs);

            // Check if the last bar should still be open
            if (lastBarEnd > new Date()) {
                this.currentBar = {...lastBar};
            }
        }
    }

    // Process incoming tick data
    processTick(tick: LiveTick): void {
        const tickTime = tick.timestamp;
        const barStartTime = this.getBarStartTime(tickTime);

        // Check if we need to close current bar and open a new one
        if (this.currentBar && this.currentBar.d.getTime() !== barStartTime.getTime()) {
            this.closeCurrentBar();
        }

        // Open new bar if needed
        if (!this.currentBar) {
            this.openNewBar(tick, barStartTime);
        } else {
            this.updateCurrentBar(tick);
        }
    }

    // Process incoming bar data (for aggregating smaller timeframes into larger ones)
    processBar(inputBar: ICandle): void {
        const barStartTime = this.getBarStartTime(inputBar.d);

        // Check if we need to close current bar and open a new one
        if (this.currentBar && this.currentBar.d.getTime() !== barStartTime.getTime()) {
            this.closeCurrentBar();
        }

        // Open new bar if needed
        if (!this.currentBar) {
            this.openNewBarFromCandle(inputBar, barStartTime);
        } else {
            this.updateCurrentBarFromCandle(inputBar);
        }
    }

    // Open a new bar from tick
    private openNewBar(tick: LiveTick, barStartTime: Date): void {
        this.currentBar = {
            o: tick.price,
            h: tick.price,
            l: tick.price,
            c: tick.price,
            d: barStartTime,
            v: tick.volume || 0,
            data: {},
        };

        if (this.onBarOpen) {
            this.onBarOpen({...this.currentBar});
        }
    }

    // Open a new bar from candle
    private openNewBarFromCandle(inputBar: ICandle, barStartTime: Date): void {
        this.currentBar = {
            o: inputBar.o,
            h: inputBar.h,
            l: inputBar.l,
            c: inputBar.c,
            d: barStartTime,
            v: inputBar.v || 0,
            data: {},
        };

        if (this.onBarOpen) {
            this.onBarOpen({...this.currentBar});
        }
    }

    // Update current bar with new tick
    private updateCurrentBar(tick: LiveTick): void {
        if (!this.currentBar) return;

        // Update OHLC
        this.currentBar.h = Math.max(this.currentBar.h, tick.price);
        this.currentBar.l = Math.min(this.currentBar.l, tick.price);
        this.currentBar.c = tick.price;

        // Update volume if provided
        if (tick.volume && this.currentBar.v !== undefined) {
            this.currentBar.v += tick.volume;
        }

        if (this.onBarUpdate) {
            this.onBarUpdate({...this.currentBar});
        }
    }

    // Update current bar with new candle
    private updateCurrentBarFromCandle(inputBar: ICandle): void {
        if (!this.currentBar) return;

        // Update high/low from input bar
        this.currentBar.h = Math.max(this.currentBar.h, inputBar.h);
        this.currentBar.l = Math.min(this.currentBar.l, inputBar.l);

        // Use input bar's close as current close
        this.currentBar.c = inputBar.c;

        // Add volume
        if (inputBar.v && this.currentBar.v !== undefined) {
            this.currentBar.v += inputBar.v;
        }

        if (this.onBarUpdate) {
            this.onBarUpdate({...this.currentBar});
        }
    }

    // Close current bar and add to closed bars
    private closeCurrentBar(): void {
        if (!this.currentBar) return;

        const closedBar = {...this.currentBar};
        this.closedBars.push(closedBar);

        if (this.onBarClose) {
            this.onBarClose(closedBar);
        }

        this.currentBar = null;
    }

    // Force close current bar (useful for testing or manual triggers)
    forceCloseBar(): ICandle | null {
        if (this.currentBar) {
            this.closeCurrentBar();
            return this.closedBars[this.closedBars.length - 1];
        }
        return null;
    }

    // Get current incomplete bar
    getCurrentBar(): ICandle | null {
        return this.currentBar ? {...this.currentBar} : null;
    }

    // Get all closed bars
    getClosedBars(): Candles {
        return [...this.closedBars];
    }

    // Get last N closed bars
    getLastBars(count: number): Candles {
        return this.closedBars.slice(-count);
    }

    // Get all bars (closed + current)
    getAllBars(): Candles {
        const bars = [...this.closedBars];
        if (this.currentBar) {
            bars.push({...this.currentBar});
        }
        return bars;
    }

    // Get aggregator stats
    getStats(): {
        symbol: string;
        timeframe: string;
        closedBars: number;
        hasCurrentBar: boolean;
        currentBarAge?: number;
    } {
        return {
            symbol: this.symbol,
            timeframe: `${this.timeframeMs / 1000}s`,
            closedBars: this.closedBars.length,
            hasCurrentBar: this.currentBar !== null,
            currentBarAge: this.currentBar
                ? Date.now() - this.currentBar.d.getTime()
                : undefined,
        };
    }

    // Clear all data
    reset(): void {
        this.currentBar = null;
        this.closedBars = [];
    }
}
