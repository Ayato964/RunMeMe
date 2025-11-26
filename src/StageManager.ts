import type { ChunkDef, ChunkElement, GameConfig } from './types';

export class StageManager {
    private activeElements: ChunkElement[] = [];
    private totalDistance: number = 0;

    private platformImage: HTMLImageElement;
    private plantImage: HTMLImageElement;
    private stoneImage: HTMLImageElement;
    private soilImage: HTMLImageElement;

    private readonly BLOCK_SIZE = 100; // Define block size

    constructor(_config: GameConfig) {
        this.platformImage = new Image();
        this.platformImage.src = '/assets/soil.png'; // Fallback
        this.plantImage = new Image();
        this.plantImage.src = '/assets/plant.png';
        this.stoneImage = new Image();
        this.stoneImage.src = '/assets/stone.png';
        this.soilImage = new Image();
        this.soilImage.src = '/assets/soil.png';

        this.reset();
    }

    public reset() {
        this.totalDistance = 0;
        this.activeElements = [];
        // Initial platform - Always start with flat ground
        this.fetchAndAddChunk(0, true);
        this.fetchAndAddChunk(800, true);
        this.fetchAndAddChunk(1600);
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
            // Find the rightmost x position
            let maxX = -Infinity;
            this.activeElements.forEach(el => {
                if (el.x + el.width > maxX) maxX = el.x + el.width;
            });

            // If no elements, start at screen edge (shouldn't happen with proper init)
            if (maxX === -Infinity) maxX = 800;

            this.fetchAndAddChunk(maxX);
        }
    }

    private async fetchAndAddChunk(startX: number, isStart: boolean = false) {
        try {
            const url = isStart ? 'http://localhost:8000/stage/start' : 'http://localhost:8000/stage/random';
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch stage');
            const chunk: ChunkDef = await response.json();
            this.addChunk(chunk, startX);
        } catch (error) {
            console.error("Error fetching chunk:", error);
            // Fallback: Add a flat chunk if fetch fails to prevent softlock
            this.addChunk({
                id: 'fallback',
                width: 800,
                elements: [{ type: 'platform', x: 0, y: 0, width: 800, height: 200, blockType: 'grass' }]
            }, startX);
        }
    }

    private addChunk(chunk: ChunkDef, startX: number) {
        const screenBottom = window.innerHeight;

        chunk.elements.forEach(el => {
            let adjustedY = el.y;

            if (el.type === 'platform') {
                // Enforce 2 blocks height if not specified or too small
                if (!el.height || el.height < this.BLOCK_SIZE) el.height = this.BLOCK_SIZE * 2;

                // Align bottom to screen bottom
                adjustedY = screenBottom - el.height;
            }

            // Add element
            if (el.type !== 'decoration') {
                this.activeElements.push({
                    ...el,
                    x: startX + el.x,
                    y: adjustedY
                });
            }

            // Add decorations relative to the new Y
            if (el.type === 'platform') {
                const numDecorations = Math.floor(Math.random() * 3);
                for (let i = 0; i < numDecorations; i++) {
                    const isPlant = Math.random() > 0.5;
                    const decoWidth = 50;
                    const decoHeight = 50;
                    if (el.width > decoWidth) {
                        const decoX = startX + el.x + Math.random() * (el.width - decoWidth);
                        const decoY = adjustedY - decoHeight + 10;

                        this.activeElements.push({
                            type: 'decoration',
                            subtype: isPlant ? 'plant' : 'stone',
                            x: decoX,
                            y: decoY,
                            width: decoWidth,
                            height: decoHeight
                        });
                    }
                }
            }
        });
    }

    public draw(ctx: CanvasRenderingContext2D) {
        this.activeElements.forEach(el => {
            if (el.type === 'platform') {
                const blockType = el.blockType || 'grass';

                // Draw blocks
                const cols = Math.ceil(el.width / this.BLOCK_SIZE);
                const rows = Math.ceil(el.height / this.BLOCK_SIZE);

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const bx = el.x + c * this.BLOCK_SIZE;
                        const by = el.y + r * this.BLOCK_SIZE;

                        // Clip to platform bounds
                        const bWidth = Math.min(this.BLOCK_SIZE, el.x + el.width - bx);
                        const bHeight = Math.min(this.BLOCK_SIZE, el.y + el.height - by);

                        if (bWidth <= 0 || bHeight <= 0) continue;

                        let img = this.soilImage;
                        if (blockType === 'grass' && r === 0) {
                            img = this.plantImage;
                        } else if (blockType === 'stone') {
                            img = this.stoneImage;
                        }

                        if (img.complete) {
                            ctx.drawImage(img, bx, by, bWidth, bHeight);
                        } else {
                            ctx.fillStyle = r === 0 ? '#48bb78' : '#4a5568';
                            ctx.fillRect(bx, by, bWidth, bHeight);
                        }
                    }
                }
            } else if (el.type === 'decoration') {
                const img = el.subtype === 'plant' ? this.plantImage : this.stoneImage;
                if (img.complete) {
                    ctx.drawImage(img, el.x, el.y, el.width, el.height);
                }
            }
        });
    }

    public getElements() {
        return this.activeElements;
    }
}
