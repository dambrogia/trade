export interface ModelExport {
    modelData: string;
    scalerData?: any;
    metadata: {
        trainedAt: Date;
        sampleCount: number;
        features: string[];
    };
}
