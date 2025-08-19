import {Command} from 'commander';
import ibkr, {MarketDataManager} from '@stoqey/ibkr';
import {BarSizeSetting, Contract, SecType, WhatToShow} from '@stoqey/ib';
import {Candles} from '#src/service/data/types';
import {TradingIndicators} from '#src/service/analysis/indicators';
import {CandlePatterns} from '#src/service/analysis/candle-patterns';
import {Order, OrderSide, OrderStatus, OrderType} from '#src/model/order';

export const walkForwardTestCommand = new Command('walk-forward-test')
    //   .option('-, --port <number>', 'port number')
    .action(async function () {
        const contract: Contract = {
            symbol: 'GC',
            secType: SecType.CONTFUT,
            exchange: 'COMEX',
        };

        await ibkr();
        const data = await MarketDataManager.Instance.getHistoricalData(
            contract,
            undefined,
            '3 M',
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

        const last = <T>(arr: T[]): T | null => arr.length === 0 ? null : arr[arr.length - 1];
        let left = 0;
        let buys = 0;
        let sells = 0;
        let idle = 0;

        for (let right = 20; right < candles.length; right++) {
            const p = (n: number) => n.toString().padStart(3, '');
            console.log(`Candles ${p(left)} through ${p(right)}`);
            const arr = candles.slice(left++, right + 1);

            const curr = last(arr);

            if (curr === null) {
                throw Error('Invalid candle');
            }

            curr.data = curr.data || {};

            const adx = await TradingIndicators.calculateADX(arr, 14);
            curr.data.adx = last(adx.adx);
            curr.data.positiveDirectionalIndicator = last(adx.plusDI);
            curr.data.negativeDirectionalIndicator = last(adx.minusDI);
            curr.data.atr = last(await TradingIndicators.calculateATR(arr, 14));

            curr.data.ema9 = last(await TradingIndicators.calculateEMA(arr, 9));
            curr.data.overEma9 = curr.c > curr.data.ema9;
            curr.data.ema20 = last(await TradingIndicators.calculateEMA(arr, 20));
            curr.data.overEma20 = curr.c > curr.data.ema20;
            curr.data.ema50 = last(await TradingIndicators.calculateEMA(arr, 50));
            curr.data.overEma50 = curr.c > curr.data.ema50;

            curr.data.atResistance = TradingIndicators.isAtResistance(arr, 0.5, {
                lookback: 20,
                threshold: 1,
                minTouches: 3,
            });

            curr.data.atSupport = TradingIndicators.isAtSupport(arr, 0.5, {
                lookback: 20,
                threshold: 1,
                minTouches: 3,
            });

            curr.data.patterns = {
                bullish: CandlePatterns.isBullish(curr),
                bearish: CandlePatterns.isBearish(curr),
                doji: CandlePatterns.isDoji(curr),
                hammer: CandlePatterns.isHammer(curr),
                shootingStar: CandlePatterns.isShootingStar(curr),
            };

            curr.data.hasBullishCandle = curr.data.patterns.bullish && (curr.data.patterns.doji || curr.data.patterns.hammer);
            curr.data.hasBearishCandle = curr.data.patterns.bearish && (curr.data.patterns.doji || curr.data.patterns.shootingStar);

            if (curr.data.hasBullishCandle && curr.data.atSupport) {
                console.log(`buy: (${++buys}) [${curr.d.toISOString()}]`);
                // Market buy order
                await new Order({
                    symbol: 'GC',
                    assetClass: SecType.CONTFUT,
                    side: OrderSide.BUY,
                    type: OrderType.MARKET,
                    status: OrderStatus.FILLED,
                    quantity: 1,
                    strike: curr.c,
                    stopLoss: curr.c - 3.5,
                    takeProfit: curr.c + 20,
                    strategy: 'sr_gc_1hr',
                    enteredAt: curr.d,
                    exitedAt: undefined,
                }).save();
            } else if (curr.data.hasBearishCandle && curr.data.atResistance) {
                // Market buy order
                console.log(`sell: (${++sells}) [${curr.d.toISOString()}]`);
                await new Order({
                    symbol: 'GC',
                    assetClass: SecType.CONTFUT,
                    side: OrderSide.SELL,
                    type: OrderType.MARKET,
                    status: OrderStatus.FILLED,
                    quantity: 1,
                    strike: curr.c,
                    stopLoss: curr.c + 3.5,
                    takeProfit: curr.c - 20,
                    strategy: 'sr_gc_1hr',
                    enteredAt: curr.d,
                    exitedAt: undefined,
                }).save();
            } else {
                idle++;
            }
        }
        console.log({buys, sells, idle, active: (buys + sells) / (buys + sells + idle)});
    });
