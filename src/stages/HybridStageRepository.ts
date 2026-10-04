import type { ChunkDef } from '../types';
import type { IStageRepository } from './IStageRepository';
import { BundledStageRepository } from './BundledStageRepository';
import { LocalStorageStageRepository } from './LocalStorageStageRepository';
import { API_BASE_URL } from '../config';

export class HybridStageRepository implements IStageRepository {
    private bundledRepo: BundledStageRepository;
    private localRepo: LocalStorageStageRepository;

    constructor() {
        this.bundledRepo = new BundledStageRepository();
        this.localRepo = new LocalStorageStageRepository();
    }

    public getStartStage(): ChunkDef {
        return this.bundledRepo.getStartStage();
    }

    /**
     * Retrieves stage chunks offline-first.
     * To prevent game loop frame drops and coordinate desynchronization,
     * local/bundled stages are served immediately without waiting on slow network I/O.
     */
    public async getRandomStages(count: number, excludeId?: string | null): Promise<ChunkDef[]> {
        const bundled = await this.bundledRepo.getRandomStages(count, excludeId);
        const localStages = this.localRepo.getAllStages();

        if (localStages.length === 0) {
            return bundled;
        }

        const allCandidates = [...this.bundledRepo.getAllStages(), ...localStages];
        const result: ChunkDef[] = [];
        let lastId = excludeId;

        for (let i = 0; i < count; i++) {
            let pool = allCandidates;
            if (lastId && allCandidates.length > 1) {
                pool = allCandidates.filter(s => s.id !== lastId);
            }
            const picked = pool[Math.floor(Math.random() * pool.length)];
            result.push(JSON.parse(JSON.stringify(picked)));
            lastId = picked.id;
        }

        return result;
    }

    public async saveCustomStage(stage: ChunkDef): Promise<void> {
        // Save locally first for offline resilience
        await this.localRepo.saveCustomStage(stage);

        // Attempt remote background sync with strict 2-second timeout
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            await fetch(`${API_BASE_URL}/stage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(stage),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch {
            // Silently handled in offline mode
            console.info("Saved stage locally (backend offline or timed out).");
        }
    }

    public getAllStages(): ChunkDef[] {
        return [...this.bundledRepo.getAllStages(), ...this.localRepo.getAllStages()];
    }
}
