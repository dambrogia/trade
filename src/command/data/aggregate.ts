import {AggregationTimeFrame, MarketDataAggregator} from '#src/service/data/market-data-aggregator';
import {ICandle} from '#src/service/data/types';
import {Command} from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import moment from 'moment-timezone';

type Args = {
    csv: string;
    timeframe: keyof typeof AggregationTimeFrame;
    id: string;
    symbol: string;
}

const tfKeys = Object.keys(AggregationTimeFrame).filter((k) => {
    return ! isNaN(AggregationTimeFrame[k as keyof typeof AggregationTimeFrame]);
}).join(', ');

let written = 0;

export const dataAggregate = new Command('data:aggregate')
    .option('--csv <csv>', 'Which CSV file to use as the input', '')
    .option('--timeframe <timeframe>', `Timeframe to use: ${tfKeys}`, '')
    .option('--symbol <symbol>', 'The symbol used in the data', '')
    .action(async function (args: Args) {
        const {csv, timeframe, symbol} = args;
        const filename = `historical-${symbol}-${timeframe}.jsonl`;
        const output = path.join(__dirname, '..', '..', '..', '.cache', filename);

        let buffer: ICandle[] = [];

        console.log('Context:', {readFrom: csv, appendTo: output});

        if (fs.existsSync(output)) {
            fs.truncateSync(output);
        }

        const agg = new MarketDataAggregator({
            symbol: symbol,
            timeframe: timeframe,
            onBarClose: (c: ICandle) => {
                buffer.push(c);

                if (buffer.length === 25000) {
                    write(buffer, output);
                    buffer = [];
                }
            },
        });

        const fileStream = fs.createReadStream(csv);
        const rl = readline.createInterface({input: fileStream, crlfDelay: Infinity});
        let barNumber = 0;


        for await (const line of rl) {
            const [date, time, open, high, low, close, volume] = line.split(',');
            const x = moment.tz(`${date} ${time}`, 'MM/DD/YYYY HH:mm', 'America/New_York').toDate();
            const candle: ICandle = {
                o: parseFloat(open),
                h: parseFloat(high),
                l: parseFloat(low),
                c: parseFloat(close),
                d: x,
                v: parseInt(volume),
                data: {barNumber: ++barNumber},
            };

            agg.processBar(candle);
        }

        if (buffer.length > 0) {
            write(buffer, output);
        }
    });

function write(buffer: ICandle[], file: string): void {
    let str = '';

    for (let i = 0; i < buffer.length; i++) {
        str += JSON.stringify(buffer[i]) + '\n';
    }
    fs.appendFileSync(file, str);

    written = written + buffer.length;
    console.log(`${String(written).padEnd(7, ' ')} total bars written`);
}
