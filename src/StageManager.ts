import type { ChunkDef, ChunkElement, GameConfig } from './types';

export class StageManager {
    private activeElements: ChunkElement[] = [];
    private totalDistance: number = 0;

    // Pool of available chunks
    private chunkPool: ChunkDef[] = [];

    constructor(_config: GameConfig) {
        this.loadChunks();
        this.reset();
    }

    private loadChunks() {
        // Eagerly load all JSON files from ./stages
        const modules = import.meta.glob('./stages/*.json', { eager: true });
        // Extract the default export (the JSON content)
        this.chunkPool = Object.values(modules).map((mod: any) => mod.default || mod);
    }

    public reset() {
        this.totalDistance = 0;
        this.activeElements = [];
        // Initial platform
        if (this.chunkPool.length > 0) {
            // Find 'flat' chunk for start if possible, otherwise random
            const startChunk = this.chunkPool.find(c => c.id === 'flat') || this.chunkPool[0];
            this.addChunk(startChunk, 0);
            this.addChunk(startChunk, 800);
            this.addChunk(startChunk, 1600); // Add more initial ground
        }
    }

    public update(dt: number, speedMultiplier: number, scrollSpeed: number) {
        const moveAmount = scrollSpeed * speedMultiplier * (dt / 16);
        this.totalDistance += moveAmount;

        // Move elements
        for (let i = this.activeElements.length - 1; i >= 0; i--) {
            this.activeElements[i].x -= moveAmount;

            // Remove off-screen elements
            if (this.activeElements[i].x + this.activeElements[i].width < -100) {
                this.activeElements.splice(i, 1);
            }
        }

        // Generate new chunks
        const lastElement = this.activeElements[this.activeElements.length - 1];
        // Generate well ahead of the screen (e.g., 2500px) to hide loading
        if (lastElement && lastElement.x < 2500) {
            const randomChunk = this.chunkPool[Math.floor(Math.random() * this.chunkPool.length)];
            // Find the rightmost x position
            let maxX = -Infinity;
            this.activeElements.forEach(el => {
                if (el.x + el.width > maxX) maxX = el.x + el.width;
            });

            // If no elements, start at screen edge (shouldn't happen with proper init)
            if (maxX === -Infinity) maxX = 800;

            this.addChunk(randomChunk, maxX);
        }
    }

    private addChunk(chunk: ChunkDef, startX: number) {
        chunk.elements.forEach(el => {
            this.activeElements.push({
                ...el,
                x: startX + el.x
            });
        });
    }

    public draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#4a5568'; // Gray-700
        this.activeElements.forEach(el => {
            if (el.type === 'platform') {
                ctx.fillRect(el.x, el.y, el.width, el.height);
            }
        });
    }

    public getElements() {
        return this.activeElements;
    }
}
