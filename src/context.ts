export class Context {
    private static instance: Context;
    private data: Map<string, any> = new Map();

    /**
     * Keys expected to exist in context
     */
    public static keys: Record<string, string> = {
        ctx_test_walk_forward: 'ctx_test_walk_forward',
        ctx_test_permutation: 'ctx_test_permutation',
        ctx_train: 'ctx_train',
        ctx_live: 'ctx_live',
        test_orders: 'test_orders',
    };

    private constructor() { }

    public static getInstance(): Context {
        if (!Context.instance) {
            Context.instance = new Context();
        }
        return Context.instance;
    }

    public set<T>(key: string, value: T): void {
        this.data.set(key, value);
    }

    public get<T>(key: string): T | undefined {
        return this.data.get(key);
    }

    public has(key: string): boolean {
        return this.data.has(key);
    }

    public clear(): void {
        this.data.clear();
    }

    public getAllKeys(): string[] {
        return Array.from(this.data.keys());
    }
}
