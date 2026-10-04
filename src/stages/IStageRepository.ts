import type { ChunkDef } from '../types';

export interface IStageRepository {
    getStartStage(): ChunkDef;
    getRandomStages(count: number, excludeId?: string | null): Promise<ChunkDef[]>;
    saveCustomStage(stage: ChunkDef): Promise<void>;
    getAllStages(): ChunkDef[];
}
