import {Command} from 'commander';
import {randomBytes} from 'node:crypto';
import {getStrategyById} from '#src/service/strategy/repository';
import {AbstractStrategy} from '#src/service/strategy/abstract-strategy';
import {Candles} from '#src/service/data/types';
import {getHistoricalBars} from '#src/service/data/historical-data';
import {Context} from '#src/context';
import {Pipeline} from '#src/service/ml/pipeline';

type Args = {
    strategyId: string;
    kibotFile: string;
    modelVersion: string;
    start: string;
    end: string;
}

export const mlTrain = new Command('ml:train')
    .option('--strategy-id <strategyId>', 'The id of the strategy to run', '')
    .option('--kibot-file <kibotFile>', 'When using Kibot data, pass file of historical data')
    .option('--start [start]', 'Date to start training', '2024-01-01T00:00:00.000Z')
    .option('--end [end]', 'Date to stop training', '2024-06-30T23:00:00.000Z')
    .option('--model-version <modelVersion>', 'Version used to save model', 'default')
    .action(async function ({strategyId, kibotFile, start, end, modelVersion}: Args) {
        Context.getInstance().set(Context.keys.ctx_train, true);
        const strategy = getStrategyById(strategyId) as AbstractStrategy | null;

        if (strategy === null) {
            throw Error('Invalid strategy id provided: ' + strategyId);
        } else {
            strategy.context.testId = randomBytes(12).toString('hex');
        }

        let candles: Candles = await getHistoricalBars(kibotFile, {
            startDate: new Date(start),
            endDate: new Date(end),
        });

        for (let i = 0; i < Math.min(strategy.context.windowSize, candles.length); i++) {
            const arr = candles.slice(0, i + 1);
            await strategy.setData(candles[i], arr);
        }

        for (let left = 0, right = strategy.context.windowSize; right < candles.length; left++, right++) {
            const arr = candles.slice(left, right);
            const curr = candles[right - 1]; // need to reference candle in original array, not slice.

            if (curr !== arr[arr.length - 1]) {
                // ensures that curr candle is read from parent array correctly
                // and time-leak is not occuring
                throw Error('Possible look forward leak detected');
            }

            await strategy.setData(curr, arr); // to allow the data to be set here and reference back og array
        }
        // filters the initial "windowSize" of candles that don't have data to use.
        candles = candles.filter((c) => {
            return Object.keys(c.data).length > 0;
        });

        const pipeline = new Pipeline(strategy.normalize);
        await pipeline.trainAll(candles);
        await pipeline.exportModels(`${strategy.id}-${modelVersion}`);
    });
