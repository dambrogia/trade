import {esClient} from '#src/service/es-client';
import {Command} from 'commander';
import mongoose from 'mongoose';

export const dropData = new Command('drop-data')
    .option('--collection [collection]', 'which mongo collection to drop', '')
    .option('--index [index]', 'which es index to drop', '')
    .action(async function ({collection, index}: {collection: string; index: string;}) {
        try {
            if (collection.length != 0) {
                await mongoose.connection.db?.dropCollection(collection);
                console.log(`Dropped mongo collection: ${collection}`);
            }
        } catch (e) {
            console.error(`Error during collection drop: ${collection}`, e);
        }

        try {
            await esClient.indices.delete({index: index});
            console.log(`Index deleted successfully: ${index}`);
        } catch (error: any) {
            if (error.statusCode === 404) {
                console.log(`Index "${index}" does not exist`);
            } else {
                console.error('Error deleting index:', error);
            }
        }
    });
