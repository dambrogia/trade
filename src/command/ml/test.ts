
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
    start: string;
    end: string;
    modelVersion: string;
}

type EvaluationResults = {
    direction: number;
    returns: number;
    stacked: number;
    actualDirection: number; // 1 if up, 0 if down
    actualReturn: number;
    timestamp: Date;
};

export const mlTest = new Command('ml:test')
    .option('--strategy-id <strategyId>', 'The id of the strategy to run', '')
    .option('--kibot-file <kibotFile>', 'When using Kibot data, pass file of historical data')
    .option('--start [start]', 'Date to start testing', '2024-07-01T00:00:00.000Z')
    .option('--end [end]', 'Date to stop testing', '2024-12-31T23:00:00.000Z')
    .option('--model-version <modelVersion>', 'Version used to load model', 'default')
    .action(async function ({strategyId, kibotFile, start, end, modelVersion}: Args) {
        Context.getInstance().set(Context.keys.ctx_train, true);
        const strategy = getStrategyById(strategyId) as AbstractStrategy | null;

        if (strategy === null) {
            throw Error('Invalid strategy id provided: ' + strategyId);
        } else {
            strategy.context.testId = randomBytes(12).toString('hex');
        }

        const candles: Candles = await getHistoricalBars(kibotFile, {
            startDate: new Date(start),
            endDate: new Date(end),
        });

        const pipeline = new Pipeline(strategy.normalize);
        await pipeline.importModels(`${strategy.id}-${modelVersion}`);

        const evaluationResults: EvaluationResults[] = [];

        for (let i = 0; i < Math.min(strategy.context.windowSize, candles.length); i++) {
            const arr = candles.slice(0, i + 1);
            await strategy.setData(candles[i], arr);
        }

        for (let left = 0, right = strategy.context.windowSize; right < candles.length - 1; left++, right++) {
            const arr = candles.slice(left, right);
            const curr = candles[right - 1];
            const next = candles[right];

            if (curr === null || next === null) {
                throw Error('Invalid candle');
            } else if (curr.d !== arr[arr.length - 1].d && next.d != candles[right].d) {
                // sanity check for our iterators. curr should be right most point,
                // next should be just after that. validating matching across last in
                // local in-scope array (curr), and full out-of-scope candle set (next)
                throw Error('Mismatch with curr + next candles');
            }

            await strategy.setData(curr, arr);

            if (curr.data.trainable !== true) {
                continue;
            }

            const result = await pipeline.predict(arr);

            if (! isNaN(result.stacked[result.stacked.length - 1])) {
                evaluationResults.push({
                    direction: result.direction[result.direction.length - 1],
                    returns: result.returns[result.returns.length - 1],
                    stacked: result.stacked[result.stacked.length - 1],
                    actualDirection: next.c > curr.c ? 1 : 0,
                    actualReturn: (next.c - curr.c) / curr.c,
                    timestamp: curr.d,
                });
            }

            process.stdout.write(`${right} / ${candles.length - 1}\r`);
        }

        console.log(evaluateModel(evaluationResults));

        const sumMoves = candles.reduce((acc, curr, idx) => {
            if ((idx - 1) in candles) {
                acc += Math.abs(curr.c - candles[idx-1].c);
            }

            return acc;
        }, 0);

        console.log(sumMoves / (candles.length - 1));
    });

function evaluateModel(results: EvaluationResults[]) {
    // Direction accuracy
    const directionAccuracy = results.reduce((acc, r) =>
        acc + (Math.round(r.direction) === r.actualDirection ? 1 : 0), 0) / results.length;

    // Return prediction accuracy (MAE, correlation)
    const returnMAE = results.reduce((acc, r) =>
            acc + Math.abs(r.returns - r.actualReturn), 0) / results.length;

    // Confidence calibration
    const highConfUp = results.filter(r => r.direction >= 0.85);
    const highConfUpAccuracy =  highConfUp.length > 0
        ? highConfUp.filter(r => r.actualDirection === 1).length / highConfUp.length
        : 0;

    const highConfDown = results.filter(r => r.direction <= 0.15);
    const highConfDownAccuracy = highConfDown.length > 0 ?
        highConfDown.filter(r => r.actualDirection === 0).length / highConfDown.length : 0;

    return {
        directionAccuracy: `${(directionAccuracy * 100).toFixed(1)}%`,
        returnMAE: `${(returnMAE * 100).toFixed(3)}%`,
        highConfUpCount: highConfUp.length,
        highConfidenceUpAccuracy: `${(highConfUpAccuracy * 100).toFixed(1)}%`,
        highConfidenceDownAccuracy: `${(highConfDownAccuracy * 100).toFixed(1)}%`,
        highConfDownCount: highConfDown.length,
        totalSamples: results.length,
    };
}
