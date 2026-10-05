export interface GameProgress {
    high_score: number;
    last_score: number;
    level: number;
    max_speed: number;
    items: {
        onigiri: number;
        icecream: number;
        star: number;
    };
    total_games_played: number;
    user_name: string;
    updated_at: string;
}

export interface ScoreEntry {
    name: string;
    score: number;
    level: number;
    max_speed: number;
    items?: {
        onigiri?: number;
        icecream?: number;
        star?: number;
    };
    discord_user_id?: string;
    photo_url?: string | null;
    is_ambassador?: boolean;
    date?: string;
}

export interface IScoreRepository {
    /**
     * Saves full gameplay progress for a user (cloud or local storage).
     */
    saveProgress(progress: GameProgress, discordUserId?: string): Promise<boolean>;

    /**
     * Retrieves stored gameplay progress for a specific user ID.
     */
    getProgress(discordUserId: string): Promise<GameProgress | null>;

    /**
     * Retrieves leaderboard / score history entries.
     */
    getScores(): Promise<ScoreEntry[]>;

    /**
     * Records an individual score entry.
     */
    saveScore(score: ScoreEntry): Promise<void>;
}
