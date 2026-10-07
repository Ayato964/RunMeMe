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
                // Reconcile best_scores between local and cloud
                const localBest: DetailedScoreRecord[] = (localProgress?.best_scores && Array.isArray(localProgress.best_scores))
                    ? localProgress.best_scores
                    : [];
                const cloudBest: DetailedScoreRecord[] = (cloudProgress?.best_scores && Array.isArray(cloudProgress.best_scores))
                    ? cloudProgress.best_scores
                    : [];

                const combined = [...localBest];
                for (const cb of cloudBest) {
                    const exists = combined.some(lb => lb.score === cb.score && lb.recorded_at === cb.recorded_at);
                    if (!exists) {
                        combined.push(cb);
                    }
                }
                combined.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime();
                });
                const mergedBest = combined.slice(0, 3);
                const highestScore = Math.max(
                    localProgress?.high_score || 0,
                    cloudProgress.high_score || 0,
                    mergedBest[0]?.score || 0
                );

                const mergedProgress: GameProgress = {
                    ...cloudProgress,
                    ...localProgress,
                    high_score: highestScore,
                    best_scores: mergedBest,
                    updated_at: new Date().toISOString()
                };

                await this.localRepo.saveProgress(mergedProgress, discordUserId);
                return mergedProgress;
            }
        } catch (err) {
            console.warn('[HybridScoreRepository] Cloud getProgress sync failed:', err);
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
        const localScores = await this.localRepo.getPersonalScores(effectiveId);

        if (!discordUserId || discordUserId.startsWith('guest')) {
            return localScores;
        }

        // For authenticated users, fetch latest from cloud and reconcile
        try {
            const cloudScores = await this.moffyRepo.getPersonalScores(discordUserId);
            if (cloudScores && cloudScores.length > 0) {
                const combined = [...localScores];
                for (const cs of cloudScores) {
                    const exists = combined.some(ls => ls.score === cs.score && ls.recorded_at === cs.recorded_at);
                    if (!exists) {
                        combined.push(cs);
                    }
                }
                combined.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime();
                });
                const best3 = combined.slice(0, 3);

                // Update local storage so cache has the reconciled top 3
                const currentLocal = await this.localRepo.getProgress(discordUserId);
                if (currentLocal) {
                    currentLocal.best_scores = best3;
                    currentLocal.high_score = Math.max(currentLocal.high_score, best3[0]?.score || 0);
                    await this.localRepo.saveProgress(currentLocal, discordUserId);
                } else {
                    await this.localRepo.saveProgress({
                        high_score: best3[0]?.score || 0,
                        last_score: best3[0]?.score || 0,
                        level: best3[0]?.level || 1,
                        max_speed: best3[0]?.max_speed || 1,
                        items: best3[0]?.items || { onigiri: 0, icecream: 0, star: 0 },
                        total_games_played: 1,
                        best_scores: best3,
                        user_name: best3[0]?.user_name || 'PLAYER',
                        updated_at: best3[0]?.recorded_at || new Date().toISOString()
                    }, discordUserId);
                }

                return best3;
            }
        } catch (err) {
            console.warn('[HybridScoreRepository] Cloud personal scores fetch failed:', err);
        }

        return localScores;
    }

    public async getGlobalScores(): Promise<ScoreEntry[]> {
        try {
            const cloudScores = await this.moffyRepo.getGlobalScores();
            if (cloudScores && cloudScores.length > 0) {
                return cloudScores;
            }
        } catch (err) {
            console.warn('[HybridScoreRepository] Cloud global leaderboard fetch failed:', err);
        }
        return this.localRepo.getGlobalScores();
    }

    public async getWeeklyScores(): Promise<ScoreEntry[]> {
        try {
            const cloudScores = await this.moffyRepo.getWeeklyScores();
            if (cloudScores && cloudScores.length > 0) {
                return cloudScores;
            }
        } catch (err) {
            console.warn('[HybridScoreRepository] Cloud weekly leaderboard fetch failed:', err);
        }
        return this.localRepo.getWeeklyScores();
    }
}

