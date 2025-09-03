import * as fs from 'fs';
import * as path from 'path';

export interface CacheOptions {
    cachePath?: string;
    enableLogging?: boolean;
}

export class FileCache {
    private cachePath: string;
    private enableLogging: boolean;

    constructor(options: CacheOptions = {}) {
        this.cachePath = options.cachePath || path.join(__dirname, '..', '..', '..', '.cache');
        this.enableLogging = options.enableLogging || false;
        this.ensureCacheDirectory();
    }

    // Ensure cache directory exists
    private ensureCacheDirectory(): void {
        if (!fs.existsSync(this.cachePath)) {
            fs.mkdirSync(this.cachePath, {recursive: true});
            this.log(`Created cache directory: ${this.cachePath}`);
        }
    }

    // Generate file path for cache key
    private getFilePath(key: string): string {
        return path.join(this.cachePath, `${key}.json`);
    }

    // Logging helper
    private log(message: string): void {
        if (this.enableLogging) {
            console.log(`[FileCache] ${message}`);
        }
    }

    // Set cache entry
    async set<T>(key: string, data: T): Promise<void> {
        try {
            const filePath = this.getFilePath(key);
            await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
            this.log(`Cached key: ${key}`);
        } catch (error) {
            this.log(`Error writing cache file for key ${key}: ${error}`);
            throw error;
        }
    }

    // Get cache entry
    async get<T>(key: string): Promise<T | null> {
        try {
            const filePath = this.getFilePath(key);
            if (fs.existsSync(filePath)) {
                const content = await fs.promises.readFile(filePath, 'utf8');
                const data: T = JSON.parse(content);
                this.log(`Cache hit: ${key}`);
                return data;
            }
        } catch (error) {
            this.log(`Error reading cache file for key ${key}: ${error}`);
        }

        this.log(`Cache miss: ${key}`);
        return null;
    }

    // Check if key exists
    async has(key: string): Promise<boolean> {
        const filePath = this.getFilePath(key);
        return fs.existsSync(filePath);
    }

    // Delete cache entry
    async delete(key: string): Promise<boolean> {
        try {
            const filePath = this.getFilePath(key);
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                this.log(`Deleted cache key: ${key}`);
                return true;
            }
            return false;
        } catch (error) {
            this.log(`Error deleting cache key ${key}: ${error}`);
            return false;
        }
    }
}
