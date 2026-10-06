import type { DetailedScoreRecord, GameProgress, IScoreRepository, ScoreEntry } from './IScoreRepository';

const LOCAL_SCORES_KEY = 'runmeme_scores';
const LEGACY_SCORES_KEY = 'run_me_me_scores';
const LOCAL_PROGRESS_KEY = 'runmeme_progress_';

export class LocalStorageScoreRepository implements IScoreRepository {
    public async saveProgress(progress: GameProgress, discordUserId: string = 'guest'): Promise<boolean> {
        try {
            const key = LOCAL_PROGRESS_KEY + discordUserId;
            localStorage.setItem(key, JSON.stringify(progress));
            return true;
        } catch (e) {
            console.warn('[LocalStorageScoreRepository] Failed to save progress locally:', e);
            return false;
        }
    }

    public async getProgress(discordUserId: string = 'guest'): Promise<GameProgress | null> {
        try {
            const key = LOCAL_PROGRESS_KEY + discordUserId;
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw) as GameProgress;
        } catch {
            return null;
        }
    }

    public async getScores(): Promise<ScoreEntry[]> {
        try {
            let raw = localStorage.getItem(LOCAL_SCORES_KEY);
            if (!raw) {
                // Check legacy key
                raw = localStorage.getItem(LEGACY_SCORES_KEY);
            }
            if (!raw) return [];

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];

            return parsed
                .filter(item => item && typeof item === 'object' && typeof item.score === 'number')
                .sort((a, b) => b.score - a.score);
        } catch {
            return [];
        }
    }

    public async saveScore(score: ScoreEntry): Promise<void> {
        try {
            const scores = await this.getScores();
            scores.push({
                ...score,
                date: score.date || new Date().toISOString()
            });

            // Keep up to 200 history entries to enable weekly and global historical calculations
            scores.sort((a, b) => b.score - a.score);
            const topScores = scores.slice(0, 200);

            localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(topScores));
        } catch (e) {
            console.warn('[LocalStorageScoreRepository] Failed to save score locally:', e);
        }
    }

    public async getPersonalScores(discordUserId: string = 'guest'): Promise<DetailedScoreRecord[]> {
        try {
            const progress = await this.getProgress(discordUserId);
            if (progress && Array.isArray(progress.best_scores) && progress.best_scores.length > 0) {
                return [...progress.best_scores]
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3);
            }

            // Fallback: search saved scores history for this user
            const allScores = await this.getScores();
            const userScores = allScores.filter(s => {
                if (discordUserId && !discordUserId.startsWith('guest')) {
                    return s.discord_user_id === discordUserId;
                }
                return s.name === (progress?.user_name || 'PLAYER');
            });

            if (userScores.length === 0 && progress && progress.high_score > 0) {
                return [{
                    score: progress.high_score,
                    level: progress.level || 1,
                    max_speed: progress.max_speed || 1.0,
                    items: progress.items || { onigiri: 0, icecream: 0, star: 0 },
                    recorded_at: progress.updated_at || new Date().toISOString(),
                    user_name: progress.user_name || 'PLAYER',
                    discord_user_id: discordUserId
                }];
            }

            return userScores
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map(s => ({
                    score: s.score,
                    level: s.level || 1,
                    max_speed: s.max_speed || 1.0,
                    items: {
                        onigiri: s.items?.onigiri || 0,
                        icecream: s.items?.icecream || 0,
                        star: s.items?.star || 0
                    },
                    recorded_at: s.date || new Date().toISOString(),
                    user_name: s.name,
                    discord_user_id: s.discord_user_id
                }));
        } catch {
            return [];
        }
    }

    public async getGlobalScores(): Promise<ScoreEntry[]> {
        const allScores = await this.getScores();
        // Aggregate best score per user (keyed by discord_user_id if present, else player name)
        const bestByUser = new Map<string, ScoreEntry>();

        for (const entry of allScores) {
            const userKey = entry.discord_user_id || entry.name.trim().toLowerCase();
            const existing = bestByUser.get(userKey);
            if (!existing || entry.score > existing.score) {
                bestByUser.set(userKey, entry);
            }
        }

        return Array.from(bestByUser.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);
    }

    public async getWeeklyScores(): Promise<ScoreEntry[]> {
        const allScores = await this.getScores();
        const oneWeekAgoMs = Date.now() - (7 * 24 * 60 * 60 * 1000);

        // Filter scores recorded within the last 7 days
        const weeklyScores = allScores.filter(entry => {
            if (!entry.date) return false;
            const entryTime = new Date(entry.date).getTime();
            return !isNaN(entryTime) && entryTime >= oneWeekAgoMs;
        });

        // Aggregate weekly best score per user
        const bestWeeklyByUser = new Map<string, ScoreEntry>();
        for (const entry of weeklyScores) {
            const userKey = entry.discord_user_id || entry.name.trim().toLowerCase();
            const existing = bestWeeklyByUser.get(userKey);
            if (!existing || entry.score > existing.score) {
                bestWeeklyByUser.set(userKey, entry);
            }
        }

        return Array.from(bestWeeklyByUser.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);
    }
}

