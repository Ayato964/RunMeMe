import type { DetailedScoreRecord, GameProgress, IScoreRepository, ScoreEntry } from './IScoreRepository';
import { LocalStorageScoreRepository } from './LocalStorageScoreRepository';
import { MoffyScoreRepository } from './MoffyScoreRepository';

export class HybridScoreRepository implements IScoreRepository {
    private localRepo: LocalStorageScoreRepository;
    private moffyRepo: MoffyScoreRepository;

    constructor(
        localRepo: LocalStorageScoreRepository = new LocalStorageScoreRepository(),
        moffyRepo: MoffyScoreRepository = new MoffyScoreRepository()
    ) {
        this.localRepo = localRepo;
        this.moffyRepo = moffyRepo;
    }

    public async saveProgress(progress: GameProgress, discordUserId?: string): Promise<boolean> {
        const effectiveUserId = discordUserId || 'guest';

        // 1. Retrieve existing progress to calculate top 3 best scores
        const existingProgress = await this.getProgress(effectiveUserId);
        const existingBest: DetailedScoreRecord[] = (existingProgress?.best_scores && Array.isArray(existingProgress.best_scores))
            ? existingProgress.best_scores
            : [];

        const newRecord: DetailedScoreRecord = {
            score: progress.last_score,
            level: progress.level,
            max_speed: progress.max_speed,
            items: { ...progress.items },
            recorded_at: progress.updated_at || new Date().toISOString(),
            user_name: progress.user_name,
            discord_user_id: discordUserId
        };

        // Combine and sort top 3 (descending by score, then newer date)
        const updatedBest = [...existingBest, newRecord]
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime();
            })
            .slice(0, 3);

        progress.best_scores = updatedBest;
        progress.high_score = Math.max(progress.high_score, updatedBest[0]?.score || 0);

        // 2. Always persist locally first for maximum resilience
        await this.localRepo.saveProgress(progress, effectiveUserId);

        // Also record to local scoreboard history for GLOBAL & WEEKLY aggregation
        await this.localRepo.saveScore({
            name: progress.user_name,
            score: progress.last_score,
            level: progress.level,
            max_speed: progress.max_speed,
            items: progress.items,
            discord_user_id: discordUserId,
            date: newRecord.recorded_at
        });

        // 3. If authenticated with Discord ID, sync to MoffyProfile cloud
        if (discordUserId && !discordUserId.startsWith('guest')) {
            // Asynchronously dispatch to cloud without blocking the game UI
            this.moffyRepo.saveProgress(progress, discordUserId).catch((err) => {
                console.warn('[HybridScoreRepository] Cloud background sync deferred:', err);
            });
            return true;
        }

        return true;
    }

    public async getProgress(discordUserId: string): Promise<GameProgress | null> {
        // Try local storage first (instant response)
        const localProgress = await this.localRepo.getProgress(discordUserId);

        if (!discordUserId || discordUserId.startsWith('guest')) {
            return localProgress;
        }

        // Attempt cloud retrieval in background/sync if online
        try {
            const cloudProgress = await this.moffyRepo.getProgress(discordUserId);
            if (cloudProgress) {
                // Merge if cloud has higher score or richer best_scores
                const localBestCount = localProgress?.best_scores?.length || 0;
                const cloudBestCount = cloudProgress?.best_scores?.length || 0;
                if (!localProgress || cloudProgress.high_score > localProgress.high_score || cloudBestCount > localBestCount) {
                    await this.localRepo.saveProgress(cloudProgress, discordUserId);
                    return cloudProgress;
                }
            }
        } catch {
            // Silently use local progress on network issues
        }

        return localProgress;
    }

    public async getScores(): Promise<ScoreEntry[]> {
        return this.localRepo.getScores();
    }

    public async saveScore(score: ScoreEntry): Promise<void> {
        await this.localRepo.saveScore(score);
    }

    public async getPersonalScores(discordUserId?: string): Promise<DetailedScoreRecord[]> {
        const effectiveId = discordUserId || 'guest';
        // Try local first
        const localScores = await this.localRepo.getPersonalScores(effectiveId);
        if (localScores.length > 0 || !discordUserId || discordUserId.startsWith('guest')) {
            return localScores;
        }

        // If authenticated and local has no best scores yet, try fetching from cloud
        try {
            const cloudScores = await this.moffyRepo.getPersonalScores(discordUserId);
            if (cloudScores && cloudScores.length > 0) {
                return cloudScores;
            }
        } catch {
            // Fallback to local
        }

        return localScores;
    }

    public async getGlobalScores(): Promise<ScoreEntry[]> {
        return this.localRepo.getGlobalScores();
    }

    public async getWeeklyScores(): Promise<ScoreEntry[]> {
        return this.localRepo.getWeeklyScores();
    }
}

