import {Command} from 'commander';
import commands from '#src/command/index';
import mongoose from 'mongoose';

(async function () {
    const program = (new Command())
    .description('Node trading framework.')
    .version('0.0.1');


    commands.forEach((cmd: Command) => program.addCommand(cmd));

    try {
        const conn = process.env['MONGO_CONN'] || [
            'mongodb://admin:password@localhost:27017/trading_db?directConnection=true',
            'serverSelectionTimeoutMS=2000',
            'appName=trade',
            'tls=false',
            'authSource=admin',
        ].join('&');

        await mongoose.connect(conn);
        await program.parseAsync();
    } catch (e) {
        console.error(`src/bin/console.ts error`, e);
    }

    await mongoose.disconnect()
})();
