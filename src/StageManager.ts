import type { ChunkDef, ChunkElement, GameConfig } from './types';
import { API_BASE_URL, LOGICAL_HEIGHT } from './config';

export class StageManager {
    private activeElements: ChunkElement[] = [];
    private totalDistance: number = 0;

    private platformImage: HTMLImageElement;
    private plantImage: HTMLImageElement;
    private stoneImage: HTMLImageElement;
    private soilImage: HTMLImageElement;
    private flowerImage: HTMLImageElement;
    private onigiriImage: HTMLImageElement;
    private icecreamImage: HTMLImageElement;
    private starImage: HTMLImageElement;

    private readonly BLOCK_SIZE = 100;
    private lastChunkId: string | null = null;
    private isFetching: boolean = false;

    private chunkQueue: ChunkDef[] = [];

    private testStage: ChunkDef | null = null;
    private testStagePlaced: boolean = false;

    constructor(_config: GameConfig) {
        this.platformImage = new Image();
        this.platformImage.src = 'assets/soil.png'; // Fallback
        this.plantImage = new Image();
        this.plantImage.src = 'assets/plant.png';
        this.stoneImage = new Image();
        this.stoneImage.src = 'assets/stone.png';
        this.soilImage = new Image();
        this.soilImage.src = 'assets/soil.png';
        this.flowerImage = new Image();
        this.flowerImage.src = 'assets/flower.png';
        this.onigiriImage = new Image();
        this.onigiriImage.src = 'assets/onigiri.png';
        this.icecreamImage = new Image();
        this.icecreamImage.src = 'assets/icecream.png';
        this.starImage = new Image();
        this.starImage.src = 'assets/star.png';

        this.reset();
    }

    public setTestStage(stage: ChunkDef) {
        console.log("StageManager: setTestStage called", stage);
        this.testStage = stage;
    }

    public reset() {
        this.totalDistance = 0;
        this.activeElements = [];
        this.lastChunkId = null;
        this.isFetching = false;
        this.chunkQueue = [];
        this.testStagePlaced = false;

        // Initial platform - Always start with flat ground
        // Hardcode initial chunks to prevent race conditions/falling
        const flatChunk: ChunkDef = {
            id: 'start_flat',
            width: 800,
            elements: [{ type: 'platform', x: 0, y: LOGICAL_HEIGHT - 100, width: 800, height: 100, blockType: 'grass' }]
        };

        this.addChunk(flatChunk, 0);
        this.addChunk(flatChunk, 800);
        this.addChunk(flatChunk, 1600);
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
        if (!lastElement || lastElement.x < 2500) {
            // Find the rightmost x position
            let maxX = -Infinity;
            this.activeElements.forEach(el => {
                if (el.x + el.width > maxX) maxX = el.x + el.width;
            });

            // If no elements, start at screen edge (shouldn't happen with proper init)
            if (maxX === -Infinity) maxX = 800;

            if (this.testStage && !this.testStagePlaced) {
                // In test mode, place the custom stage once
                this.addChunk(this.testStage, maxX);
                this.testStagePlaced = true;

                // Add a finish line or end marker? 
                // For now, we just stop generating or add a flat end.
                // Let's add a flat end so player can run off screen to finish
                this.addChunk({
                    id: 'finish',
                    width: 800,
                    elements: [{ type: 'platform', x: 0, y: LOGICAL_HEIGHT, width: 800, height: 100, blockType: 'grass' }] // Invisible or low platform
                }, maxX + this.testStage.width);

            } else if (!this.testStage) {
                // Normal infinite generation
                if (this.chunkQueue.length > 0) {
                    const chunk = this.chunkQueue.shift()!;
                    this.addChunk(chunk, maxX);
                    if (chunk.id) this.lastChunkId = chunk.id;
                } else if (!this.isFetching) {
                    this.fetchAndAddChunk(maxX);
                }
            }
        }
    }

    private async fetchAndAddChunk(startX: number, isStart: boolean = false) {
        if (this.isFetching && !isStart) return;
        this.isFetching = true;

        try {
            let url = isStart ? `${API_BASE_URL}/stage/start` : `${API_BASE_URL}/stage/random?count=20`;
            if (!isStart && this.lastChunkId) {
                url += `&exclude_id=${this.lastChunkId}`;
            }

            const response = await fetch(url, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (!response.ok) throw new Error('Failed to fetch stage');

            if (isStart) {
                const chunk: ChunkDef = await response.json();
                if (chunk.id) this.lastChunkId = chunk.id;
                this.addChunk(chunk, startX);
            } else {
                const chunks: ChunkDef[] = await response.json();
                this.chunkQueue.push(...chunks);
                // Add the first one immediately if needed
                if (this.chunkQueue.length > 0) {
                    const chunk = this.chunkQueue.shift()!;
                    if (chunk.id) this.lastChunkId = chunk.id;
                    this.addChunk(chunk, startX);
                }
            }
        } catch (error) {
            console.error("Error fetching chunk:", error);
            // Fallback: Add a flat chunk if fetch fails to prevent softlock
            this.addChunk({
                id: 'fallback',
                width: 800,
                elements: [{ type: 'platform', x: 0, y: 0, width: 800, height: 200, blockType: 'grass' }]
            }, startX);
        } finally {
            this.isFetching = false;
        }
    }

    private addChunk(chunk: ChunkDef, startX: number) {
        const screenBottom = LOGICAL_HEIGHT;

        chunk.elements.forEach(el => {
            let adjustedY = el.y;

            if (el.type === 'platform') {
                // Check if it's a custom stage (absolute coordinates)
                if (chunk.id && chunk.id.startsWith('custom_')) {
                    console.log(`Using absolute Y for custom element: ${el.y}`);
                    adjustedY = el.y;
                } else {
                    // Standard generation (grounded)
                    // Enforce 2 blocks height if not specified or too small
                    if (!el.height || el.height < this.BLOCK_SIZE) el.height = this.BLOCK_SIZE * 2;

                    // Align bottom to screen bottom
                    adjustedY = screenBottom - el.height;
                }
            }

            // Add element
            if (el.type !== 'decoration' && el.type !== 'item_area') {
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
                            subtype: isPlant ? 'flower' : 'stone',
                            x: decoX,
                            y: decoY,
                            width: decoWidth,
                            height: decoHeight
                        });
                    }
                }
            }

            // Handle Item Areas
            if (el.type === 'item_area') {
                const cols = Math.ceil(el.width / this.BLOCK_SIZE);
                const rows = Math.ceil(el.height / this.BLOCK_SIZE);

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const bx = startX + el.x + c * this.BLOCK_SIZE;
                        const by = adjustedY + r * this.BLOCK_SIZE;

                        // Random generation
                        const rand = Math.random();
                        let itemType: 'onigiri' | 'icecream' | 'star' | null = null;

                        if (rand < 0.01) {
                            itemType = 'star'; // 1%
                        } else if (rand < 0.02) { // 0.01 + 0.02
                            itemType = 'onigiri'; // 2%
                        } else if (rand < 0.22) { // 0.02 + 0.20
                            itemType = 'icecream'; // 20%
                        }

                        if (itemType) {
                            // Center item in block
                            const itemSize = 50;
                            const offset = (this.BLOCK_SIZE - itemSize) / 2;

                            this.activeElements.push({
                                type: 'item',
                                subtype: itemType,
                                x: bx + offset,
                                y: by + offset,
                                width: itemSize,
                                height: itemSize
                            });
                        }
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
                let img = this.stoneImage;
                if (el.subtype === 'plant') img = this.plantImage;
                else if (el.subtype === 'flower') img = this.flowerImage;

                if (img.complete) {
                    ctx.drawImage(img, el.x, el.y, el.width, el.height);
                }
            } else if (el.type === 'item') {
                let img = this.onigiriImage;
                if (el.subtype === 'icecream') img = this.icecreamImage;
                else if (el.subtype === 'star') img = this.starImage;

                if (img.complete) {
                    ctx.drawImage(img, el.x, el.y, el.width, el.height);
                }
            }
        });
    }

    public getElements() {
        return this.activeElements;
    }

    public getTotalDistance() {
        return this.totalDistance;
    }
}
