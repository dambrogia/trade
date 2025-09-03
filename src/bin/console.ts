import {Command} from 'commander';
import commands from '#src/command/index';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {join} from 'node:path';

(async function () {
    const program = (new Command())
    .description('Node trading framework.')
    .version('0.0.1');

    commands.forEach((cmd: Command) => program.addCommand(cmd));

    try {
        dotenv.config({path: join(__dirname, '..', '..', '.env')});
        await mongoose.connect(process.env['MONGO_CONN'] || 'UNDEFINED');
        await program.parseAsync();
    } catch (e) {
        console.error('src/bin/console.ts error', e);
    }

    await mongoose.disconnect();
})();
