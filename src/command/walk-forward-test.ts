import { Command } from "commander";

export const walkForwardTestCommand = new Command('walk-forward-test')
//   .option('-, --port <number>', 'port number')
  .action(async function() {
    console.log("hello world")
  });
