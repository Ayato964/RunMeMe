import type { GameProgress, IScoreRepository, ScoreEntry } from './IScoreRepository';
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
        // 1. Always persist locally first for maximum resilience
        await this.localRepo.saveProgress(progress, discordUserId || 'guest');

        // Also record to local scoreboard list
        await this.localRepo.saveScore({
            name: progress.user_name,
            score: progress.last_score,
            level: progress.level,
            max_speed: progress.max_speed,
            items: progress.items,
            discord_user_id: discordUserId
        });

        // 2. If authenticated with Discord ID, sync to MoffyProfile cloud
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
                // Merge if cloud has higher score
                if (!localProgress || cloudProgress.high_score > localProgress.high_score) {
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
}
