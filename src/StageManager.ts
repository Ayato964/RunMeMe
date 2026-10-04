import type { ChunkDef, ChunkElement } from './types';
import type { IStageRepository } from './stages/IStageRepository';
import type { IAssetManager } from './core/AssetManager';
import { LOGICAL_HEIGHT } from './config';

export class StageManager {
    private activeElements: ChunkElement[] = [];
    private totalDistance: number = 0;
    private readonly BLOCK_SIZE = 100;
    private lastChunkId: string | null = null;
    private isFetching: boolean = false;
    private chunkQueue: ChunkDef[] = [];
    private testStage: ChunkDef | null = null;
    private testStagePlaced: boolean = false;

    private stageRepository: IStageRepository;
    private assetManager: IAssetManager;

    constructor(stageRepository: IStageRepository, assetManager: IAssetManager) {
        this.stageRepository = stageRepository;
        this.assetManager = assetManager;
        this.reset();
    }

    public setTestStage(stage: ChunkDef): void {
        this.testStage = stage;
    }

    public reset(): void {
        this.totalDistance = 0;
        this.activeElements = [];
        this.lastChunkId = null;
        this.isFetching = false;
        this.chunkQueue = [];
        this.testStagePlaced = false;

        // Start with flat ground chunks from repository
        const startChunk = this.stageRepository.getStartStage();
        this.addChunk(startChunk, 0);
        this.addChunk(startChunk, 800);
        this.addChunk(startChunk, 1600);
    }

    private getRightmostEdge(): number {
        let maxX = -Infinity;
        for (let i = 0; i < this.activeElements.length; i++) {
            const el = this.activeElements[i];
            if (el.x + el.width > maxX) maxX = el.x + el.width;
        }
        return maxX === -Infinity ? 800 : maxX;
    }

    public update(dt: number, speedMultiplier: number, scrollSpeed: number): void {
        const moveAmount = scrollSpeed * speedMultiplier * (dt / 16);
        this.totalDistance += moveAmount;

        // Move elements leftward
        for (let i = this.activeElements.length - 1; i >= 0; i--) {
            this.activeElements[i].x -= moveAmount;

            // Prune elements off-screen
            if (this.activeElements[i].x + this.activeElements[i].width < -100) {
                this.activeElements.splice(i, 1);
            }
        }

        // Generate new chunks ahead of the screen
        const lastElement = this.activeElements[this.activeElements.length - 1];
        if (!lastElement || lastElement.x < 2500) {
            const currentEdge = this.getRightmostEdge();

            if (this.testStage && !this.testStagePlaced) {
                this.addChunk(this.testStage, currentEdge);
                this.testStagePlaced = true;

                this.addChunk({
                    id: 'finish',
                    width: 800,
                    elements: [{ type: 'platform', x: 0, y: LOGICAL_HEIGHT, width: 800, height: 100, blockType: 'grass' }]
                }, currentEdge + this.testStage.width);
            } else if (!this.testStage) {
                if (this.chunkQueue.length > 0) {
                    const chunk = this.chunkQueue.shift()!;
                    this.addChunk(chunk, currentEdge);
                    if (chunk.id) this.lastChunkId = chunk.id;
                } else if (!this.isFetching) {
                    this.fetchAndQueueChunks();
                }
            }
        }
    }

    private async fetchAndQueueChunks(): Promise<void> {
        if (this.isFetching) return;
        this.isFetching = true;

        try {
            const chunks = await this.stageRepository.getRandomStages(20, this.lastChunkId);
            if (chunks && chunks.length > 0) {
                this.chunkQueue.push(...chunks);
                const first = this.chunkQueue.shift()!;
                if (first.id) this.lastChunkId = first.id;
                // Compute insertion point dynamically AT PLACEMENT TIME (never stale)
                const currentEdge = this.getRightmostEdge();
                this.addChunk(first, currentEdge);
            }
        } catch (error) {
            console.warn("Failed to retrieve stage chunks:", error);
            const fallback = this.stageRepository.getStartStage();
            const currentEdge = this.getRightmostEdge();
            this.addChunk(fallback, currentEdge);
        } finally {
            this.isFetching = false;
        }
    }

    private addChunk(chunk: ChunkDef, startX: number): void {
        const screenBottom = LOGICAL_HEIGHT;

        chunk.elements.forEach(el => {
            let adjustedY = el.y;

            if (el.type === 'platform') {
                if (chunk.id && chunk.id.startsWith('custom_')) {
                    adjustedY = el.y;
                } else {
                    if (!el.height || el.height < this.BLOCK_SIZE) {
                        el.height = this.BLOCK_SIZE * 2;
                    }
                    adjustedY = screenBottom - el.height;
                }
            }

            if (el.type !== 'decoration' && el.type !== 'item_area') {
                let finalX = startX + el.x;
                let finalY = adjustedY;
                let finalWidth = el.width;
                let finalHeight = el.height;

                if (el.type === 'thorn') {
                    const size = 80;
                    finalWidth = size;
                    finalHeight = size;

                    const cellCenterX = startX + el.x + this.BLOCK_SIZE / 2;
                    const cellCenterY = adjustedY + this.BLOCK_SIZE / 2;
                    const offset = 10;
                    const rad = (el.rotation || 0) * Math.PI / 180;
                    const offsetX = -offset * Math.sin(rad);
                    const offsetY = offset * Math.cos(rad);

                    finalX = (cellCenterX + offsetX) - size / 2;
                    finalY = (cellCenterY + offsetY) - size / 2;
                } else if (el.type === 'item') {
                    const size = 50;
                    finalWidth = size;
                    finalHeight = size;
                    finalX += (this.BLOCK_SIZE - size) / 2;
                    finalY += (this.BLOCK_SIZE - size) / 2;
                }

                this.activeElements.push({
                    ...el,
                    x: finalX,
                    y: finalY,
                    width: finalWidth,
                    height: finalHeight
                });
            }

            if (el.type === 'platform') {
                const numDecorations = Math.floor(Math.random() * 3);
                for (let i = 0; i < numDecorations; i++) {
                    const decoWidth = 50;
                    const decoHeight = 50;
                    if (el.width > decoWidth) {
                        const decoX = startX + el.x + Math.random() * (el.width - decoWidth);
                        const decoY = adjustedY - decoHeight + 10;

                        this.activeElements.push({
                            type: 'decoration',
                            subtype: 'flower',
                            x: decoX,
                            y: decoY,
                            width: decoWidth,
                            height: decoHeight
                        });
                    }
                }
            }

            if (el.type === 'item_area') {
                const cols = Math.ceil(el.width / this.BLOCK_SIZE);
                const rows = Math.ceil(el.height / this.BLOCK_SIZE);

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const bx = startX + el.x + c * this.BLOCK_SIZE;
                        const by = adjustedY + r * this.BLOCK_SIZE;

                        const rand = Math.random();
                        let itemType: 'onigiri' | 'icecream' | 'star' | null = null;

                        if (rand < 0.01) {
                            itemType = 'star';
                        } else if (rand < 0.03) {
                            itemType = 'onigiri';
                        } else if (rand < 0.23) {
                            itemType = 'icecream';
                        }

                        if (itemType) {
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

    public draw(ctx: CanvasRenderingContext2D): void {
        for (let i = 0; i < this.activeElements.length; i++) {
            const el = this.activeElements[i];
            ctx.save();
            const centerX = el.x + el.width / 2;
            const centerY = el.y + el.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((el.rotation || 0) * Math.PI / 180);
            ctx.translate(-centerX, -centerY);

            if (el.type === 'platform') {
                const blockType = el.blockType || 'grass';
                const cols = Math.ceil(el.width / this.BLOCK_SIZE);
                const rows = Math.ceil(el.height / this.BLOCK_SIZE);

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const bx = el.x + c * this.BLOCK_SIZE;
                        const by = el.y + r * this.BLOCK_SIZE;
                        const bWidth = Math.min(this.BLOCK_SIZE, el.x + el.width - bx);
                        const bHeight = Math.min(this.BLOCK_SIZE, el.y + el.height - by);

                        if (bWidth <= 0 || bHeight <= 0) continue;

                        let imgPath = 'assets/soil.png';
                        if (blockType === 'grass' && r === 0) {
                            imgPath = 'assets/plant.png';
                        } else if (blockType === 'stone') {
                            imgPath = 'assets/stone.png';
                        }

                        const img = this.assetManager.getImage(imgPath);
                        if (img.complete) {
                            ctx.drawImage(img, bx, by, bWidth, bHeight);
                        } else {
                            ctx.fillStyle = r === 0 ? '#48bb78' : '#4a5568';
                            ctx.fillRect(bx, by, bWidth, bHeight);
                        }
                    }
                }
            } else if (el.type === 'decoration') {
                let imgPath = 'assets/stone.png';
                if (el.subtype === 'plant') imgPath = 'assets/plant.png';
                else if (el.subtype === 'flower') imgPath = 'assets/flower.png';

                const img = this.assetManager.getImage(imgPath);
                if (img.complete) {
                    ctx.drawImage(img, el.x, el.y, el.width, el.height);
                }
            } else if (el.type === 'item') {
                let imgPath = 'assets/onigiri.png';
                if (el.subtype === 'icecream') imgPath = 'assets/icecream.png';
                else if (el.subtype === 'star') imgPath = 'assets/star.png';

                const img = this.assetManager.getImage(imgPath);
                if (img.complete) {
                    ctx.drawImage(img, el.x, el.y, el.width, el.height);
                }
            } else if (el.type === 'thorn') {
                const img = this.assetManager.getImage('assets/thorn.png');
                if (img.complete) {
                    ctx.drawImage(img, el.x, el.y, el.width, el.height);
                } else {
                    ctx.fillStyle = 'purple';
                    ctx.fillRect(el.x, el.y, el.width, el.height);
                }
            }
            ctx.restore();
        }
    }

    public getElements(): ChunkElement[] {
        return this.activeElements;
    }

    public getTotalDistance(): number {
        return this.totalDistance;
    }
}
