import {Command} from 'commander';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const talib = require('talib');

export const talibExplain = new Command('talib:explain')
    .option('--fn [fn]', 'which function to explain', '')
    .action(async function ({fn}: {fn: string}) {
        if (fn === '') {
            for (const i in talib.functions) {
                console.log(talib.functions[i]);
            }
        } else {
            console.log(talib.explain(fn));
        }
    });
