import * as tf from '@tensorflow/tfjs-node';
import {promises as fs} from 'fs';
import {ModelExport} from './types';

export class StackedModel {
    private model: tf.Sequential | null = null;

    async train(
        directionPredictions: number[],
        returnPredictions: number[],
        actualTargets: number[],
    ): Promise<void> {
        // Prepare features from both models
        const features = directionPredictions.map((dir, idx) => [
            dir, // direction confidence
            returnPredictions[idx], // return prediction
            dir * Math.abs(returnPredictions[idx]), // interaction term
        ]);

        const xs = tf.tensor2d(features);
        const ys = tf.tensor2d(actualTargets.map(t => [t]));

        // Simple linear stacking model
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({inputShape: [3], units: 8, activation: 'relu'}),
                tf.layers.dense({units: 1, activation: 'tanh'}),
            ],
        });

        this.model.compile({
            optimizer: 'adam',
            loss: 'meanSquaredError',
            metrics: ['mae'],
        });

        await this.model.fit(xs, ys, {
            epochs: 100,
            batchSize: 32,
            validationSplit: 0.2,
            verbose: 0,
        });

        xs.dispose();
        ys.dispose();
    }

    async predict(directionPredictions: number[], returnPredictions: number[]): Promise<number[]> {
        if (!this.model) throw new Error('Model not trained');

        const features = directionPredictions.map((dir, idx) => [
            dir,
            returnPredictions[idx],
            dir * Math.abs(returnPredictions[idx]),
        ]);

        const xs = tf.tensor2d(features);
        const predictions = await this.model.predict(xs) as tf.Tensor;
        const results = await predictions.data();

        xs.dispose();
        predictions.dispose();

        return Array.from(results);
    }

    async exportModel(filepath: string): Promise<void> {
        if (!this.model) throw new Error('Model not trained');

        await this.model.save('file://' + filepath + '_stacked_model');
        const exportData: ModelExport = {
            modelData: filepath + '_stacked_model',
            metadata: {
                trainedAt: new Date(),
                sampleCount: 0,
                features: ['direction_confidence', 'return_prediction', 'interaction'],
            },
        };

        await fs.writeFile(filepath + '_stacked_meta.json', JSON.stringify(exportData, null, 2));
    }

    async importModel(filepath: string): Promise<void> {
        const metaData = JSON.parse(await fs.readFile(filepath + '_stacked_meta.json', 'utf8')) as ModelExport;
        const file = metaData.modelData + '/model.json';
        this.model = (await tf.loadLayersModel('file://' + file)) as any;
    }
}
