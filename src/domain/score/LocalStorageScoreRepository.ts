import type { GameProgress, IScoreRepository, ScoreEntry } from './IScoreRepository';

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
                .sort((a, b) => b.score - a.score)
                .slice(0, 100);
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

            scores.sort((a, b) => b.score - a.score);
            const topScores = scores.slice(0, 50);

            localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(topScores));
        } catch (e) {
            console.warn('[LocalStorageScoreRepository] Failed to save score locally:', e);
        }
    }
}
