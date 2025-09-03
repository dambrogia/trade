import {ICandle} from '../data/types';
import * as tf from '@tensorflow/tfjs-node';
import {promises as fs} from 'fs';
import {ModelExport} from './types';

export class DirectionClassifier {
    private model: tf.Sequential | null = null;
    private scaler: { mean: number[]; std: number[] } | null = null;
    private featureExtractor: (candle: ICandle) => number[];

    constructor(featureExtractor: (candle: ICandle) => number[]) {
        this.featureExtractor = featureExtractor;
    }

    prepareFeatures(candles: ICandle[]): number[][] {
        return candles.filter((c) => c.data.trainable).map(this.featureExtractor);
    }

    prepareTargets(candles: ICandle[], lookAhead: number = 1): number[] {
        const targets: number[] = [];
        for (let i = 0; i < candles.length - lookAhead; i++) {
            if (candles[i].data.trainable) {
                const currentClose = candles[i].c;
                const futureClose = candles[i + lookAhead].c;
                targets.push(futureClose > currentClose ? 1 : 0); // 1 = up, 0 = down
            }
        }
        return targets;
    }

    private standardizeFeatures(features: number[][]): number[][] {
        const numFeatures = features[0].length;

        if (!this.scaler) {
            // Calculate mean and std for scaling
            const means = new Array(numFeatures).fill(0);
            const stds = new Array(numFeatures).fill(0);

            // Calculate means
            features.forEach(row => {
                row.forEach((val, idx) => means[idx] += val);
            });
            means.forEach((sum, idx) => means[idx] = sum / features.length);

            // Calculate standard deviations
            features.forEach(row => {
                row.forEach((val, idx) => stds[idx] += Math.pow(val - means[idx], 2));
            });
            stds.forEach((sum, idx) => stds[idx] = Math.sqrt(sum / features.length));

            this.scaler = {mean: means, std: stds};
        }

        // Apply scaling
        return features.map(row =>
            row.map((val, idx) =>
                this.scaler!.std[idx] === 0 ? 0 : (val - this.scaler!.mean[idx]) / this.scaler!.std[idx],
            ),
        );
    }

    async train(candles: ICandle[], lookAhead: number = 2): Promise<void> {
        const features = this.prepareFeatures(candles);
        const targets = this.prepareTargets(candles, lookAhead);

        // Remove samples that don't have targets
        const validFeatures = features.slice(0, targets.length);
        const scaledFeatures = this.standardizeFeatures(validFeatures);

        // Convert to tensors
        const xs = tf.tensor2d(scaledFeatures);
        const ys = tf.tensor2d(targets.map(t => [t]));

        // Create model
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({inputShape: [scaledFeatures[0].length], units: 64, activation: 'relu'}),
                tf.layers.dropout({rate: 0.3}),
                tf.layers.dense({units: 32, activation: 'relu'}),
                tf.layers.dropout({rate: 0.2}),
                tf.layers.dense({units: 1, activation: 'sigmoid'}),
            ],
        });

        this.model.compile({
            optimizer: 'adam',
            loss: 'binaryCrossentropy',
            metrics: ['accuracy'],
        });

        // Train
        await this.model.fit(xs, ys, {
            epochs: 100,
            batchSize: 32,
            validationSplit: 0.2,
            verbose: 0,
        });

        xs.dispose();
        ys.dispose();
    }

    async predict(candles: ICandle[]): Promise<number[]> {
        if (!this.model || !this.scaler) throw new Error('Model not trained');

        const features = this.prepareFeatures(candles);
        const scaledFeatures = features.map(row =>
            row.map((val, idx) =>
                this.scaler!.std[idx] === 0 ? 0 : (val - this.scaler!.mean[idx]) / this.scaler!.std[idx],
            ),
        );

        const xs = tf.tensor2d(scaledFeatures);
        const predictions = await this.model.predict(xs) as tf.Tensor;
        const results = await predictions.data();

        xs.dispose();
        predictions.dispose();

        return Array.from(results);
    }

    async exportModel(filepath: string): Promise<void> {
        if (!this.model) throw new Error('Model not trained');

        await this.model.save('file://' + filepath + '_model');
        const exportData: ModelExport = {
            modelData: filepath + '_model',
            scalerData: this.scaler,
            metadata: {
                trainedAt: new Date(),
                sampleCount: 0,
                features: ['rsi', 'rocp', 'ema9Diff', 'relVol1', 'atr', 'adx', 'linRegAng', 'utcHour', 'utcDow'],
            },
        };

        await fs.writeFile(filepath + '_meta.json', JSON.stringify(exportData, null, 2));
    }

    async importModel(filepath: string): Promise<void> {
        const metaData = JSON.parse(await fs.readFile(filepath + '_meta.json', 'utf8')) as ModelExport;
        const file = metaData.modelData + '/model.json';
        this.model = (await tf.loadLayersModel('file://' + file)) as any;
        this.scaler = metaData.scalerData;
    }
}
