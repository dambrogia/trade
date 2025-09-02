import {dataAggregate} from './data/aggregate';
import {dataDrop} from './data/drop';
import {mlTest} from './ml/test';
import {mlTrain} from './ml/train';
import {talibExplain} from './talib/talib-explain';
import {testWalkForward} from './test/walk-forward';
import {testWarmData} from './test/warm-data';

export default [
    dataAggregate,
    dataDrop,
    mlTest,
    mlTrain,
    talibExplain,
    testWalkForward,
    testWarmData,
];
