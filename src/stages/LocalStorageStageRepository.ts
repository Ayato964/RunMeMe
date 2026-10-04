import type { ChunkDef } from '../types';
import type { IStageRepository } from './IStageRepository';

export class LocalStorageStageRepository implements IStageRepository {
    private static readonly STORAGE_KEY = 'runmeme_custom_stages';

    private loadFromStorage(): ChunkDef[] {
        try {
            const raw = localStorage.getItem(LocalStorageStageRepository.STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn("Failed to load stages from localStorage:", e);
            return [];
        }
    }

    private saveToStorage(stages: ChunkDef[]): void {
        try {
            localStorage.setItem(LocalStorageStageRepository.STORAGE_KEY, JSON.stringify(stages));
        } catch (e) {
            console.error("Failed to save stage to localStorage:", e);
        }
    }

    public getStartStage(): ChunkDef {
        const stages = this.loadFromStorage();
        if (stages.length > 0) {
            return JSON.parse(JSON.stringify(stages[0]));
        }
        return {
            id: 'local_fallback',
            width: 800,
            elements: [{ type: 'platform', x: 0, y: 0, width: 800, height: 200, blockType: 'grass' }]
        };
    }

    public async getRandomStages(count: number, excludeId?: string | null): Promise<ChunkDef[]> {
        const stages = this.loadFromStorage();
        if (stages.length === 0) return [this.getStartStage()];

        const result: ChunkDef[] = [];
        let currentExclude = excludeId;

        for (let i = 0; i < count; i++) {
            let candidates = stages;
            if (currentExclude && stages.length > 1) {
                candidates = stages.filter(s => s.id !== currentExclude);
            }
            const picked = candidates[Math.floor(Math.random() * candidates.length)];
            result.push(JSON.parse(JSON.stringify(picked)));
            currentExclude = picked.id;
        }

        return result;
    }

    public async saveCustomStage(stage: ChunkDef): Promise<void> {
        const stages = this.loadFromStorage();
        const existingIndex = stages.findIndex(s => s.id === stage.id);
        if (existingIndex >= 0) {
            stages[existingIndex] = stage;
        } else {
            stages.push(stage);
        }
        this.saveToStorage(stages);
        return Promise.resolve();
    }

    public getAllStages(): ChunkDef[] {
        return this.loadFromStorage();
    }
}
