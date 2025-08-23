import {getStrategyById} from '#src/service/strategy/repository';
import {Command} from 'commander';

export const warmStrategyData = new Command('warm-strategy-data')
    .option('--strategyIds <strategyIds...>', 'Which strategies to warm data for.', '')
    .action(async function ({strategyIds}: {strategyIds: string[]}) {
        const promises = [];

        for (const id of strategyIds) {
            const strategy = getStrategyById(id);

            if (strategy) {
                promises.push(strategy.getHistoricalData());
            } else {
                console.error('Strategy id not found ' + id);
            }
        }

        if (promises.length > 0) {
            await Promise.allSettled(promises);
        }
    });
