import {ICandle} from '../data/types';
import * as tf from '@tensorflow/tfjs-node';
import {promises as fs} from 'fs';
import {ModelExport} from './types';

export class ReturnRegressor {
    private model: tf.Sequential | null = null;
    private scaler: { mean: number[]; std: number[] } | null = null;
    private featureExtractor: (candle: ICandle) => number[];

    constructor(featureExtractor: (candle: ICandle) => number[]) {
        this.featureExtractor = featureExtractor;
    }

    prepareSequences(candles: ICandle[], sequenceLength: number = 50): { sequences: number[][][]; targets: number[] } {
        const sequences: number[][][] = [];
        const targets: number[] = [];
        const lookForward = 1;

        for (let i = sequenceLength; i < candles.length - lookForward; i++) {
            if (candles[i].data.trainable !== true) {
                continue;
            }

            const sequence: number[][] = [];

            // Build sequence of features
            for (let j = i - sequenceLength; j < i; j++) {
                sequence.push(this.featureExtractor(candles[j]));
            }

            // Calculate 1-candle return target
            const currentClose = candles[i].c;
            const futureClose = candles[i + lookForward].c;
            let returnPct = (futureClose - currentClose) / currentClose;

            // Clamp to ±2.5%
            returnPct = Math.max(-0.025, Math.min(0.025, returnPct));

            sequences.push(sequence);
            targets.push(returnPct);
        }

        return {sequences, targets};
    }

    async train(candles: ICandle[], sequenceLength: number = 50): Promise<void> {
        const {sequences, targets} = this.prepareSequences(candles, sequenceLength);

        // Convert to tensors
        const xs = tf.tensor3d(sequences);
        const ys = tf.tensor2d(targets.map(t => [t]));

        // Create LSTM model
        this.model = tf.sequential({
            layers: [
                tf.layers.lstm({
                    units: 64,
                    returnSequences: true,
                    inputShape: [sequenceLength, sequences[0][0].length],
                }),
                tf.layers.dropout({rate: 0.3}),
                tf.layers.lstm({units: 32, returnSequences: false}),
                tf.layers.dropout({rate: 0.2}),
                tf.layers.dense({units: 16, activation: 'relu'}),
                tf.layers.dense({units: 1, activation: 'tanh'}), // tanh for bounded output
            ],
        });

        this.model.compile({
            optimizer: 'adam',
            loss: 'meanSquaredError',
            metrics: ['mae'],
        });

        await this.model.fit(xs, ys, {
            epochs: 50,
            batchSize: 16,
            validationSplit: 0.2,
            verbose: 0,
        });

        xs.dispose();
        ys.dispose();
    }

    async predict(candles: ICandle[], sequenceLength: number = 50): Promise<number[]> {
        if (!this.model) throw new Error('Model not trained');

        const {sequences} = this.prepareSequences(candles, sequenceLength);
        const xs = tf.tensor3d(sequences);
        const predictions = await this.model.predict(xs) as tf.Tensor;
        const results = await predictions.data();

        xs.dispose();
        predictions.dispose();

        return Array.from(results);
    }

    async exportModel(filepath: string): Promise<void> {
        if (!this.model) throw new Error('Model not trained');

        await this.model.save('file://' + filepath + '_lstm_model');
        const exportData: ModelExport = {
            modelData: filepath + '_lstm_model',
            metadata: {
                trainedAt: new Date(),
                sampleCount: 0,
                features: ['ema9_rel', 'rsi', 'atr_rel', 'adx', 'linRegAng', 'rocp', 'relVol1'],
            },
        };

        await fs.writeFile(filepath + '_lstm_meta.json', JSON.stringify(exportData, null, 2));
    }

    async importModel(filepath: string): Promise<void> {
        const metaData = JSON.parse(await fs.readFile(filepath + '_lstm_meta.json', 'utf8')) as ModelExport;
        const file = metaData.modelData + '/model.json';
        this.model = (await tf.loadLayersModel('file://' + file)) as any;
    }
}
