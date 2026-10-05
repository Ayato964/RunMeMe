import type { GameProgress, IScoreRepository, ScoreEntry } from './IScoreRepository';
import { MOFFY_API_BASE_URL, MOFFY_API_KEY, GAME_ID } from '../../config';

export class MoffyScoreRepository implements IScoreRepository {
    private baseUrl: string;
    private apiKey: string;
    private gameId: string;

    constructor(baseUrl: string = MOFFY_API_BASE_URL, apiKey: string = MOFFY_API_KEY, gameId: string = GAME_ID) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
        this.gameId = gameId;
    }

    public async saveProgress(progress: GameProgress, discordUserId?: string): Promise<boolean> {
        if (!discordUserId || discordUserId.startsWith('guest')) {
            // Guests do not sync to MoffyProfile cloud
            return false;
        }

        try {
            const formData = new FormData();
            formData.append('discord_user_id', discordUserId);
            formData.append('progress_data', JSON.stringify(progress));

            const headers: Record<string, string> = {};
            if (this.apiKey) {
                headers['X-API-Key'] = this.apiKey;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(`${this.baseUrl}/api/v1/games/${encodeURIComponent(this.gameId)}/progress`, {
                method: 'POST',
                headers,
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const errorText = await res.text().catch(() => '');
                console.warn(`[MoffyScoreRepository] Save progress failed with status ${res.status}:`, errorText);
                return false;
            }

            return true;
        } catch (e) {
            console.warn('[MoffyScoreRepository] Cloud save error (offline or network failure):', e);
            return false;
        }
    }

    public async getProgress(discordUserId: string): Promise<GameProgress | null> {
        if (!discordUserId || discordUserId.startsWith('guest')) {
            return null;
        }

        try {
            const headers: Record<string, string> = {};
            if (this.apiKey) {
                headers['X-API-Key'] = this.apiKey;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const url = `${this.baseUrl}/api/v1/games/${encodeURIComponent(this.gameId)}/progress?discord_user_id=${encodeURIComponent(discordUserId)}`;
            const res = await fetch(url, {
                method: 'GET',
                headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                return null;
            }

            const json = await res.json();
            if (json && json.data) {
                return json.data as GameProgress;
            }
            return null;
        } catch {
            return null;
        }
    }

    public async getScores(): Promise<ScoreEntry[]> {
        // MoffyProfile stores individual progress per user. Global leaderboard is aggregated via HybridScoreRepository.
        return [];
    }

    public async saveScore(_score: ScoreEntry): Promise<void> {
        // Individual scores are folded into saveProgress
    }
}
