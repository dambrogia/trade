import cliProgress from 'cli-progress';
import {Command} from 'commander';
import {Order} from '#src/model/order';
import {randomBytes} from 'node:crypto';
import {logger} from '#src/logger';
import {getStrategyById} from '#src/service/strategy/repository';
import {AbstractStrategy} from '#src/service/strategy/abstract-strategy';
import {Candles} from '#src/service/data/types';
import {getHistoricalBars} from '#src/service/data/historical-data';

type Args = {
    strategyId: string;
    source: 'ikbr' | 'kibot';
    kibotStart?: string;
    kibotFile?: string;
}

export const testWalkForward = new Command('test:walk-forward')
    .option('--strategy-id <strategyId>', 'The id of the strategy to run', '')
    .option('--source <source>', 'What data to use (ikbr, kibot)', '')
    .option('--kibot-file [kibotFile]', 'When using Kibot data, pass file of historical data')
    .option('--kibot-start [kibotStart]', 'When using Kibot data, pass date to start from')
    .action(async function ({strategyId, source, kibotStart, kibotFile}: Args) {
        const strategy = getStrategyById(strategyId) as AbstractStrategy | null;

        if (strategy === null) {
            throw Error('Invalid strategy id provided: ' + strategyId);
        } else {
            strategy.context.testId = randomBytes(12).toString('hex');
        }

        const candles: Candles | undefined = source === 'kibot' && kibotFile !== undefined
            ? (await getHistoricalBars(kibotFile, {startDate: kibotStart ? new Date(kibotStart) : undefined}))
            : (await strategy.getHistoricalData());

        logger.info('Starting test id ' + strategy.context.testId);

        const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_grey);
        progress.start(candles.length - strategy.context.windowSize, 0);

        for (let left = 0, right = strategy.context.windowSize; right < candles.length; left++, right++) {
            const arr = candles.slice(left, right);
            const curr = arr[arr.length - 1];

            if (curr === null) {
                throw Error('Invalid candle');
            }

            curr.data.testId = strategy.context.testId;

            await strategy.exit(curr);
            await strategy.trailStops(curr);

            await strategy.setData(curr, arr);
            await strategy.enter(curr);

            progress.increment();
        }

        progress.stop();

        await report(strategy.context.testId, candles.length - strategy.context.windowSize - 1);
        logger.info('Ended test id ' + strategy.context.testId);
    });


async function report(testId: string, totalBars: number): Promise<void> {
    const result = await Order.aggregate([
        {$match: {'data.testId': testId}},
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

    logger.info('Finished test', {
        avgContractValue: result[0].avgPnl * 100,
        totalPnl: result[0].totalPnl * 100,
        winPct: result[0].winners / result[0].count,
        totalTrades: result[0].count,
        totalOpportunities: totalBars,
    });
}
