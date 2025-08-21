import {Command} from 'commander';
import ibkr, {MarketDataManager} from '@stoqey/ibkr';
import {BarSizeSetting, Contract, SecType, WhatToShow} from '@stoqey/ib';
import {Candles, ICandle} from '#src/service/data/types';
import {TradingIndicators} from '#src/service/analysis/indicators';
import {CandlePatterns} from '#src/service/analysis/candle-patterns';
import {Order, OrderSide, OrderStatus, OrderType} from '#src/model/order';
import {randomBytes} from 'node:crypto';
import {logger} from '#src/logger';

export const walkForwardTestCommand = new Command('walk-forward-test')
    //   .option('-, --port <number>', 'port number')
    .action(async function () {
        const testId = randomBytes(12).toString('hex');
        const contract: Contract = {
            symbol: 'GC',
            secType: SecType.CONTFUT,
            exchange: 'COMEX',
        };

        await ibkr();

        const data = await MarketDataManager.Instance.getHistoricalData(
            contract,
            undefined,
            '10 Y',
            BarSizeSetting.HOURS_ONE,
            WhatToShow.BID_ASK,
            false,
        );

        const candles: Candles = data.map((x: Record<string, any>) => ({
            o: x.open,
            c: x.close,
            h: x.high,
            l: x.low,
            d: x.date,
            v: x.volume,
            data: {},
        }));

        let left = 0;
        let buys = 0;
        let sells = 0;
        let idle = 0;

        for (let right = 20; right < candles.length; right++) {
            const arr = candles.slice(left++, right + 1);
            const curr = last(arr);

            if (curr === null) {
                throw Error('Invalid candle');
            }

            /**
             * Exit trades
             */
            await exit(testId, curr);

            /**
             * Adjust exits of open trades (trailing stop losses/take profits)
             */
            await trailStops(testId, curr);

            /**
             * Enter trades
             */

            curr.data = curr.data || {};
            curr.data.testId = testId;

            const adx = await TradingIndicators.calculateADX(arr, 14);
            curr.data.adx = last(adx.adx);
            curr.data.positiveDirectionalIndicator = last(adx.plusDI);
            curr.data.negativeDirectionalIndicator = last(adx.minusDI);
            curr.data.atr = last(await TradingIndicators.calculateATR(arr, 14));

            curr.data.ema9 = last(await TradingIndicators.calculateEMA(arr, 9));
            curr.data.ema9Diff = curr.data.ema9 - curr.c;
            curr.data.ema20 = last(await TradingIndicators.calculateEMA(arr, 20));
            curr.data.ema20Diff = curr.data.ema20 - curr.c;

            curr.data.atResistance = TradingIndicators.isAtResistance(arr, 5, {
                lookback: 20,
                threshold: 5,
                minTouches: 4,
            });

            curr.data.atSupport = TradingIndicators.isAtSupport(arr, 5, {
                lookback: 20,
                threshold: 5,
                minTouches: 4,
            });

            curr.data.macd = await TradingIndicators.calculateMACD(arr, 12, 19, 9);
            curr.data.stdDev = last(await TradingIndicators.calculateSTDDEV(arr, arr.length));
            curr.data.linReg = last(await TradingIndicators.calculateLINEARREG(arr));
            curr.data.linRegAng = last(await TradingIndicators.calculateLINEARREGANGLE(arr));
            curr.data.rocp = last(await TradingIndicators.calculateROCP(arr));
            curr.data.rsi = last(await TradingIndicators.calculateRSI(arr));

            curr.data.patterns = {
                bullish: CandlePatterns.isBullish(curr),
                bearish: CandlePatterns.isBearish(curr),
                doji: CandlePatterns.isDoji(curr),
                hammer: CandlePatterns.isHammer(curr),
                shootingStar: CandlePatterns.isShootingStar(curr),
            };

            curr.data.cdl = {
                cdlhammer: last(CandlePatterns.cdlhammer(arr)),
                cdlshootingstar: last(CandlePatterns.cdlshootingstar(arr)),
                cdlmorningstar: last(CandlePatterns.cdlmorningstar(arr)),
                cdlmorningdojistar: last(CandlePatterns.cdlmorningdojistar(arr)),
                cdleveningstar: last(CandlePatterns.cdleveningstar(arr)),
                cdleveningdojistar: last(CandlePatterns.cdleveningdojistar(arr)),
                cdlpiercing: last(CandlePatterns.cdlpiercing(arr)),
                cdldarkcloudcover: last(CandlePatterns.cdldarkcloudcover(arr)),
                cdlengulfing: last(CandlePatterns.cdlengulfing(arr)),
                cdldoji: last(CandlePatterns.cdldoji(arr)),
            };

            curr.data.hasBullishCandle = curr.data.patterns.bullish
                && (curr.data.patterns.doji || curr.data.patterns.hammer);
            curr.data.hasBearishCandle = curr.data.patterns.bearish
                && (curr.data.patterns.doji || curr.data.patterns.shootingStar);

            curr.data.utcHour = curr.d.getUTCHours();

            if (curr.data.atSupport) {
                logger.info(`buy: (${++buys}) [${curr.d.toISOString()}]`);
                // Market buy order
                await new Order({
                    symbol: 'GC',
                    assetClass: SecType.CONTFUT,
                    side: OrderSide.BUY,
                    type: OrderType.MARKET,
                    status: OrderStatus.FILLED,
                    quantity: 1,
                    strike: curr.c,
                    stopLoss: curr.c - 3,
                    takeProfit: curr.c + 12,
                    strategy: 'sr_gc_1hr',
                    enteredAt: curr.d,
                    exitedAt: undefined,
                    data: curr.data,
                }).save();
            } else if (curr.data.atResistance) {
                // Market buy order
                logger.info(`sell: (${++sells}) [${curr.d.toISOString()}]`);
                await new Order({
                    symbol: 'GC',
                    assetClass: SecType.CONTFUT,
                    side: OrderSide.SELL,
                    type: OrderType.MARKET,
                    status: OrderStatus.FILLED,
                    quantity: 1,
                    strike: curr.c,
                    stopLoss: curr.c + 3,
                    takeProfit: curr.c - 12,
                    strategy: 'sr_gc_1hr',
                    enteredAt: curr.d,
                    exitedAt: undefined,
                    data: curr.data,
                }).save();
            } else {
                idle++;
            }
        }

        const result = await Order.aggregate([
            {
                $match: {'data.testId': testId},
            },
            {
                $group: {
                    _id: '$data.testId',
                    totalPnl: {$sum: '$pnl'},
                    count: {$sum: 1},
                    avgPnl: {$avg: '$pnl'},
                    winners: {$sum: {$cond: [{$gt: ['$pnl', 0]}, 1, 0]}},
                },
            },
        ]);

        logger.info({
            avgContractValue: result[0].avgPnl * 100,
            totalPnl: result[0].totalPnl * 100,
            winPct: result[0].winners / result[0].count,
            totalTrades: result[0].count,
            totalOpportunities: (buys + sells + idle),
        });
    });

async function exit(testId: string, curr: ICandle): Promise<void> {
    const orders = await Order.find({
        active: true,
        'data.testId': testId,
    }).exec();

    for (const o of orders) {
        let exitPrice = 0;
        let shouldExit = false;
        const isEow = curr.d.getUTCDay() === 6 && curr.d.getUTCHours() == 3;
        const msElapsed = (curr.d.getTime() - (o.enteredAt?.getTime() || curr.d.getTime() - 100));
        const hoursElapsed = msElapsed / (1000 * 60) / 60;

        if ((o.side === OrderSide.BUY && (curr.c >= o.takeProfit || curr.c <= o.stopLoss))
            || (o.side === OrderSide.SELL && (curr.c <= o.takeProfit || curr.c >= o.stopLoss))
            || (hoursElapsed >= 10 || isEow)
        ) {
            shouldExit = true;
            exitPrice = curr.c; // exit on candle close, not sl/tp
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
            }

            await o.save();
            logger.info(`closed order ${o._id} from ${o.enteredAt?.toISOString()}`);
        }
    }
}

async function trailStops(testId: string, curr: ICandle): Promise<void> {
    const orders = await Order.find({
        active: true,
        'data.testId': testId,
    }).exec();

    const checkpointLimit = 3;

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
                    console.log(`Trailing stop updated for ${o.symbol}: ${newStopLoss}`);
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
                    console.log(`Trailing stop updated for ${o.symbol}: ${newStopLoss}`);
                }
            }
        }
    }
}

/**
 * Return the last index of an array, else null
 */
function last<T>(arr: T[]): T | null {
    return arr.length === 0 ? null : arr[arr.length - 1];
}
