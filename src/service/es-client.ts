import {Client} from '@elastic/elasticsearch';

export const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    headers: {
        Accept: 'application/vnd.elasticsearch+json; compatible-with=8',
    },
});
