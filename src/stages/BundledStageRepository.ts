import type { ChunkDef } from '../types';
import type { IStageRepository } from './IStageRepository';

export class BundledStageRepository implements IStageRepository {
    private stages: Map<string, ChunkDef> = new Map();
    private startStage: ChunkDef | null = null;

    constructor() {
        this.loadBundledStages();
    }

    private loadBundledStages(): void {
        const modules = import.meta.glob<Record<string, unknown>>('./*.json', { eager: true });
        for (const path in modules) {
            const mod = modules[path];
            const data = (mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod) as ChunkDef;
            if (data && data.id && Array.isArray(data.elements)) {
                this.stages.set(data.id, data);
                if (data.id === 'flat') {
                    this.startStage = data;
                }
            }
        }

        if (!this.startStage) {
            this.startStage = {
                id: 'fallback_flat',
                width: 800,
                elements: [
                    { type: 'platform', x: 0, y: 0, width: 800, height: 200, blockType: 'grass' }
                ]
            };
            this.stages.set(this.startStage.id, this.startStage);
        }
    }

    public getStartStage(): ChunkDef {
        return JSON.parse(JSON.stringify(this.startStage));
    }

    public async getRandomStages(count: number, excludeId?: string | null): Promise<ChunkDef[]> {
        const allList = Array.from(this.stages.values());
        if (allList.length === 0) {
            return [this.getStartStage()];
        }

        const result: ChunkDef[] = [];
        let currentExclude = excludeId;

        for (let i = 0; i < count; i++) {
            let candidates = allList;
            if (currentExclude && allList.length > 1) {
                candidates = allList.filter(s => s.id !== currentExclude);
            }
            const picked = candidates[Math.floor(Math.random() * candidates.length)];
            result.push(JSON.parse(JSON.stringify(picked)));
            currentExclude = picked.id;
        }

        return result;
    }

    public async saveCustomStage(stage: ChunkDef): Promise<void> {
        this.stages.set(stage.id, stage);
        return Promise.resolve();
    }

    public getAllStages(): ChunkDef[] {
        return Array.from(this.stages.values()).map(s => JSON.parse(JSON.stringify(s)));
    }
}
