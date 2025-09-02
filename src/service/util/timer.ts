export class Timer {
    private id: string;
    private started: Date | undefined = undefined;

    constructor(id: string = 'default') {
        this.id = id;
    }

    start(): Timer {
        this.started = new Date();
        console.log(`Started timer for ${this.id} at ${this.started.toISOString()}`);
        return this;
    }

    end(): Timer {
        if (this.started === undefined) {
            throw Error('Must start timer before ending timer');
        }
        const d = new Date();
        const ended = Math.floor(d.getTime() / 1000);
        const started = Math.floor(this.started.getTime() / 1000);
        const seconds = ended - started;

        console.log(`Ended timer for ${this.id} at ${d.toISOString()}. Active for ~${seconds} seconds.`);
        this.started = undefined;

        return this;
    }
}
