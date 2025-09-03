import path from 'node:path';
import {ICandle} from '../data/types';
import {DirectionClassifier} from './directional-classifier';
import {ReturnRegressor} from './return-regressor';
import {StackedModel} from './stacked-model';
import * as fs from 'node:fs';
import {Timer} from '../util/timer';

export class Pipeline {
    private directionModel: DirectionClassifier;
    private returnModel: ReturnRegressor;
    private stackedModel = new StackedModel();

    constructor(normalize: (candle: ICandle) => number[]) {
        this.directionModel = new DirectionClassifier(normalize);
        this.returnModel = new ReturnRegressor(normalize);
    }

    async trainAll(candles: ICandle[]): Promise<void> {
        const directionalTimer = new Timer('directional_training').start();
        await this.directionModel.train(candles);
        directionalTimer.end();

        const returnTimer = new Timer('return_training').start();
        await this.returnModel.train(candles);
        returnTimer.end();

        const predictTimer = new Timer('predict_models').start();
        // Get predictions from both models for stacking
        const dirPreds = await this.directionModel.predict(candles);
        const retPreds = await this.returnModel.predict(candles);
        predictTimer.end();

        // Prepare actual targets for stacked model
        const actualTargets: number[] = [];
        const lookforward = 1;
        for (let i = 0; i < candles.length - lookforward; i++) {
            const returnPct = (candles[i + lookforward].c - candles[i].c) / candles[i].c;
            actualTargets.push(Math.max(-0.025, Math.min(0.025, returnPct)));
        }

        // Align arrays (account for LSTM sequence requirements)
        const minLength = Math.min(dirPreds.length, retPreds.length, actualTargets.length);
        const stackedTimer = new Timer('stacked_train').start();
        await this.stackedModel.train(
            dirPreds.slice(0, minLength),
            retPreds.slice(0, minLength),
            actualTargets.slice(0, minLength),
        );
        stackedTimer.end();
    }

    async predict(candles: ICandle[]): Promise<{
        direction: number[];
        returns: number[];
        stacked: number[];
    }> {
        const direction = await this.directionModel.predict(candles);
        const returns = await this.returnModel.predict(candles);

        const minLength = Math.min(direction.length, returns.length);
        const stacked = await this.stackedModel.predict(
            direction.slice(0, minLength),
            returns.slice(0, minLength),
        );

        return {direction, returns, stacked};
    }

    async exportModels(name: string): Promise<void> {
        const dir = path.join(__dirname, '..', '..', '..', 'models', name);
        fs.mkdirSync(dir, {recursive: true});

        await Promise.all([
            this.directionModel.exportModel(`${dir}/direction`),
            this.returnModel.exportModel(`${dir}/return`),
            this.stackedModel.exportModel(`${dir}/stacked`),
        ]);
    }

    async importModels(name: string): Promise<void> {
        const dir = path.join(__dirname, '..', '..', '..', 'models', name);

        await Promise.all([
            this.directionModel.importModel(`${dir}/direction`),
            this.returnModel.importModel(`${dir}/return`),
            this.stackedModel.importModel(`${dir}/stacked`),
        ]);
    }
}
