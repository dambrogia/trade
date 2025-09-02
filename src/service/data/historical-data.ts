import fs from 'node:fs';
import readline from 'node:readline';
import {Candles, ICandle} from './types';
import path from 'node:path';

type Criteria = {
    startDate?: Date,
    endDate?: Date,
};

export async function getHistoricalBars(fileName: string, criteria: Criteria): Promise<Candles> {
    const file = path.join(__dirname, '..', '..', '..', '.cache', fileName);
    const bars: Candles = [];

    const fileStream = fs.createReadStream(file);
    const rl = readline.createInterface({input: fileStream, crlfDelay: Infinity});

    const startTime = criteria.startDate?.getTime();
    const endTime = criteria.endDate?.getTime();

    for await (const line of rl) {
        if (line.trim().length === 0) {
            continue;
        }

        try {
            const row = JSON.parse(line);
            const rowDate = new Date(row.d);
            const rowTime = rowDate.getTime();

            // Since data is ordered by date ASC, we can optimize:
            if (startTime !== undefined && rowTime < startTime) {
                continue; // Skip rows before start date
            } else if (endTime && rowTime > endTime) {
                break; // Stop processing once we exceed end date
            }

            // Convert row to ICandle format
            const candle: ICandle = {
                o: row.o,
                h: row.h,
                l: row.l,
                c: row.c,
                d: rowDate,
                v: row.v,
                data: {},
            };

            bars.push(candle);

        } catch (error) {
            console.warn(`Error parsing line: ${line.substring(0, 50)}...`, error);
        }
    }

    return bars;
}
