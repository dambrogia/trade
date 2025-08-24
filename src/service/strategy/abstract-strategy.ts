import {logger} from '#src/logger';
import {Order, OrderSide, OrderStatus, OrderType} from '#src/model/order';
import {createHash} from 'crypto';
import {TradingIndicators} from '../analysis/indicators';
import {FileCache} from '../data/cache';
import {Candles, ICandle} from '../data/types';
import {IStrategy, StrategyContext, StrategyExitType} from './types';
import ibkr, {IBKRConnection, MarketDataManager} from '@stoqey/ibkr';

export abstract class AbstractStrategy implements IStrategy {
    /**
     * kebab-case unique identifier for strategy
     */
    abstract id: string;

    /**
     * Whether to set exit price as candle close or stop loss (to mock real time).
     */
    exitStrategy: StrategyExitType = 'bar-close';

    /**
     * This is the step-size for how trailing losses will be moved forward as
     * position sizes move towards profit target. For example, if a step size of
     * 3 is chosen with a take profit of 12 and the current trade is at a profit
     * of 10, the stop loss will be moved up to 9 (the largest number divisible
     * by the step size under the current profit).
     */
    trailingLossStepSize: number = 3;

    abstract asset: {
        symbol: string,
        type: string,
    };

    maxActiveTrades: number = 1;

    context: StrategyContext = {
        windowSize: 50,
        activeTrades: 0,
    };

    /**
     * Get historical data to test against.
     */
    async getHistoricalData (): Promise<Candles> {
        const cache = new FileCache();
        const beforeRequest = Math.floor((new Date().getTime()) / 1000);
        const params = this.getHistoricalDataParams();

        /**
         * TTL logic for cache key. Will be valid for 7 days.
         */
        const ttlMs = (1000 * 60 * 60 * 24 * 7);
        const now = Date.now();
        const validFrom = new Date(Math.floor(now / ttlMs) * ttlMs).toISOString();
        const validTo = new Date(Math.ceil(now / ttlMs) * ttlMs).toISOString();

        params.push([validFrom, validTo]);
        const cacheKey = createHash('sha256').update(JSON.stringify(params)).digest('hex');
        params.pop();

        logger.info('Cache key range', {strategy: this.id, cacheKey, validFrom, validTo});

        if (await cache.has(cacheKey)) {
            return (await cache.get(cacheKey) as Candles).map((c) => ({...c, d: new Date(c.d)}));
        }

        await ibkr();
        // @ts-expect-error -- doesn't like ...params being so dynamic - we can ignore it.
        const data = await MarketDataManager.Instance.getHistoricalData(...params);
        const afterRequest = Math.floor(new Date().getTime() / 1000);
        logger.info(`Completed request for ${this.id} in ${afterRequest - beforeRequest} seconds`, {
            ...this.getHistoricalDataParams(),
        });

        if (IBKRConnection.Instance.connected) {
            IBKRConnection.Instance.disconnect();
        }

        if (IBKRConnection.Instance.ib.isConnected) {
            IBKRConnection.Instance.ib.disconnect();
        }

        const candles: Candles = data.map((x: Record<string, any>) => ({
            o: x.open,
            c: x.close,
            h: x.high,
            l: x.low,
            d: x.date,
            v: x.volume,
            data: {testId: ''},
        }));

        cache.set(cacheKey, candles);
        return candles;
    }

    /**
     *
     */
    protected abstract getHistoricalDataParams(): any[];

    /**
     * Confirm or deny that the current candle matches a long entry scenario.
     * The curr.data will have a full context of analysis for decision making.
     */
    abstract matchesLongEnter (curr: ICandle): Promise<boolean>;

    /**
     * Confirm or deny that the current candle matches a long entry scenario.
     * The curr.data will have a full context of analysis for decision making.
     */
    abstract matchesShortEnter (curr: ICandle): Promise<boolean>;

    /**
     * The number returned will be subtracted from long and added to short
     * strike prices.
     */
    abstract stopLossDiff(curr: ICandle): number;

    /**
     * The number returned will be added to long and subtracted from short
     * strike prices.
     */
    abstract takeProfDiff(curr: ICandle): number;

    async enter (curr: ICandle): Promise<void> {
        const matchesLong = await this.matchesLongEnter(curr);
        const matchesShort = await this.matchesShortEnter(curr);
        const canTakeTrade = this.context.activeTrades < this.maxActiveTrades;

        if (matchesLong && canTakeTrade) {
            curr.data.testTradeId = `${this.id}-${curr.d.toISOString()}-${this.asset.symbol}-buy`;
            this.context.activeTrades = this.context.activeTrades + 1;
            curr.data.activeTradeCount = this.context.activeTrades;

            if (curr.data.activeTradeCount > this.maxActiveTrades) {
                console.log('issue');
            }

            await new Order({
                symbol: this.asset.symbol,
                assetClass: this.asset.type,
                side: OrderSide.BUY,
                type: OrderType.MARKET,
                status: OrderStatus.FILLED,
                quantity: 1,
                strike: curr.c,
                stopLoss: curr.c - this.stopLossDiff(curr),
                takeProfit: curr.c + this.takeProfDiff(curr),
                strategy: this.id,
                enteredAt: curr.d,
                exitedAt: undefined,
                data: curr.data,
            }).save();
        } else if (matchesShort && canTakeTrade) {
            curr.data.testTradeId = `${this.id}-${curr.d.toISOString()}-${this.asset.symbol}-sell`;
            this.context.activeTrades = this.context.activeTrades + 1;
            curr.data.activeTradeCount = this.context.activeTrades;

            if (curr.data.activeTradeCount > this.maxActiveTrades) {
                console.log('issue');
            }

            await new Order({
                symbol: this.asset.symbol,
                assetClass: this.asset.type,
                side: OrderSide.SELL,
                type: OrderType.MARKET,
                status: OrderStatus.FILLED,
                quantity: 1,
                strike: curr.c,
                stopLoss: curr.c + this.stopLossDiff(curr),
                takeProfit: curr.c - this.takeProfDiff(curr),
                strategy: this.id,
                enteredAt: curr.d,
                exitedAt: undefined,
                data: curr.data,
            }).save();
        }
    }

    isExpired(curr: ICandle, enteredAt: Date) {
        const isEow = curr.d.getUTCDay() === 6 && curr.d.getUTCHours() == 3;
        const msElapsed = curr.d.getTime() - enteredAt.getTime();
        const hoursElapsed = Math.floor((msElapsed / 1000) / 60 / 60);
        return isEow || hoursElapsed > 24;
    }

    async exit(curr: ICandle) {
        const testId = curr.data.testId;
        const orders = await Order.find({active: true, 'data.testId': testId}).exec();
        const useClose = this.exitStrategy === 'bar-close';

        for (const o of orders) {
            let exitPrice = 0;
            let shouldExit = false;

            /**
             * Handle loss before wins, provides worst case possible results rather
             * than blind optimism
             */

            if (o.side === OrderSide.BUY && (useClose ? curr.c : curr.l) <= o.stopLoss) {
                shouldExit = true;
                exitPrice = useClose ? curr.c : o.stopLoss;
            } else if (o.side === OrderSide.BUY && (useClose ? curr.c : curr.h) >= o.takeProfit) {
                shouldExit = true;
                exitPrice = useClose ? curr.c : o.takeProfit;
            } else if (o.side === OrderSide.SELL && (useClose ? curr.c : curr.h) >= o.stopLoss) {
                shouldExit = true;
                exitPrice = useClose ? curr.c : o.stopLoss;
            } else if (o.side === OrderSide.SELL && (useClose ? curr.c : curr.l) <= o.takeProfit) {
                shouldExit = true;
                exitPrice = useClose ? curr.c : o.takeProfit;
            }

            if (!shouldExit && this.isExpired(curr, (o.enteredAt || curr.d))) {
                shouldExit = true;
                exitPrice = curr.c;
            }

            if (shouldExit) {
                let pnl = 0;
                let pnlPercent = 0;

                if (o.side === OrderSide.BUY) {
                    pnl = (exitPrice - o.strike) * o.quantity;
                    pnlPercent = ((exitPrice - o.strike) / o.strike) * 100;
                } else {
                    pnl = (o.strike - exitPrice) * o.quantity;
                    pnlPercent = ((o.strike - exitPrice) / o.strike) * 100;
                }

                // Update order
                o.status = OrderStatus.FILLED;
                o.exitedAt = curr.d;
                o.exit = exitPrice;
                o.pnl = pnl;
                o.pnlPercentage = pnlPercent;
                o.active = false;

                if (o.data && o.enteredAt && o.exitedAt) {
                    // get minutes the trade was active for
                    o.data.durationActive = Math.ceil((o.exitedAt.getTime() - o.enteredAt.getTime()) / (1000 * 60));
                    o.data.winner = pnl > 0;
                }

                this.context.activeTrades = this.context.activeTrades - 1;
                await o.save();
            }
        }
    }

    async setData(curr: ICandle, candles: Candles) {
        const last = <T>(a: T[]): T | null  => a.length === 0 ? null : a[a.length - 1];

        const adx = await TradingIndicators.calculateADX(candles, 14);
        curr.data.adx = last(adx.adx);
        curr.data.positiveDirectionalIndicator = last(adx.plusDI);
        curr.data.negativeDirectionalIndicator = last(adx.minusDI);
        curr.data.atr = last(await TradingIndicators.calculateATR(candles, 14));

        curr.data.ema9 = last(await TradingIndicators.calculateEMA(candles, 9));
        curr.data.ema9Diff = curr.data.ema9 - curr.c;
        curr.data.ema20 = last(await TradingIndicators.calculateEMA(candles, 20));
        curr.data.ema20Diff = curr.data.ema20 - curr.c;

        curr.data.atResistance = TradingIndicators.isAtResistance(candles, 5, {
            lookback: 20,
            threshold: 5,
            minTouches: 4,
        });

        curr.data.atSupport = TradingIndicators.isAtSupport(candles, 5, {
            lookback: 20,
            threshold: 5,
            minTouches: 4,
        });

        const sr = TradingIndicators.findSupportResistance(candles, {
            lookback: 20,
            threshold: 5,
            minTouches: 4,
        });

        curr.data.distToSupport = curr.data.atSupport && sr.support ? curr.c - sr.support : undefined;
        curr.data.distToResistance = curr.data.atResistance && sr.resistance ? sr.resistance - curr.c : undefined;

        const macd = await TradingIndicators.calculateMACD(candles, 12, 19, 9);
        curr.data.macd = {
            histogram: last(macd.histogram || []),
            macd: last(macd.macd || []),
            signal: last(macd.signal || []),
        };

        curr.data.stdDev = last(await TradingIndicators.calculateSTDDEV(candles, candles.length));
        curr.data.linReg = last(await TradingIndicators.calculateLINEARREG(candles));
        curr.data.linRegAng = last(await TradingIndicators.calculateLINEARREGANGLE(candles));
        curr.data.rocp = last(await TradingIndicators.calculateROCP(candles));
        curr.data.rsi = last(await TradingIndicators.calculateRSI(candles));

        curr.data.utcHour = curr.d.getUTCHours();
        curr.data.utcDow = curr.d.getUTCDay();
    }

    async trailStops(curr: ICandle): Promise<void> {
        const testId = curr.data.testId;
        const orders = await Order.find({active: true, 'data.testId': testId}).exec();
        const checkpointLimit = this.trailingLossStepSize;

        for (const o of orders) {
            // Trailing stop loss logic (only for BUY orders for now)
            if (o.side === OrderSide.BUY) {
                const profitFromEntry = curr.c - o.strike;
                const profitCheckpoints = Math.floor(profitFromEntry / checkpointLimit); // Every checkpointLimit points

                if (profitCheckpoints > 0) {
                    const newStopLoss = o.strike + profitCheckpoints * checkpointLimit;

                    // Only move stop loss up, never down
                    if (newStopLoss > o.stopLoss) {
                        o.stopLoss = newStopLoss;
                        await o.save();
                    }
                }
            } else if (o.side === OrderSide.SELL) {
                const profitFromEntry = o.strike - curr.c;
                const profitCheckpoints = Math.floor(profitFromEntry / checkpointLimit);

                if (profitCheckpoints > 0) {
                    const newStopLoss = o.strike - profitCheckpoints * checkpointLimit;

                    // Only move stop loss down for shorts, never up
                    if (newStopLoss < o.stopLoss) {
                        o.stopLoss = newStopLoss;
                        await o.save();
                    }
                }
            }
        }
    }

}
