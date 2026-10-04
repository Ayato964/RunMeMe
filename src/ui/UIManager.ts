import MESSAGES from '../game_over_messages.json';
import { API_BASE_URL } from '../config';

export interface ScoreData {
    name: string;
    score: number;
    level: number;
    max_speed: number;
    items?: {
        onigiri?: number;
        icecream?: number;
        star?: number;
    };
}

export class UIManager {
    private loadingInterval: number | null = null;
    private static readonly LOCAL_SCORES_KEY = 'runmeme_local_scores';

    public showLoading(): void {
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;

        loadingScreen.style.display = 'flex';
        void loadingScreen.offsetWidth;
        loadingScreen.classList.remove('opacity-0');
        this.startLoadingAnimation();
    }

    public hideLoading(): void {
        this.stopLoadingAnimation();
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;

        loadingScreen.classList.add('opacity-0');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }

    private startLoadingAnimation(): void {
        if (this.loadingInterval !== null) return;
        let frame = 1;
        const charaImg = document.getElementById('loading-chara') as HTMLImageElement;
        this.loadingInterval = window.setInterval(() => {
            if (charaImg) {
                charaImg.src = frame === 1 ? 'assets/chara_run_1.png' : 'assets/chara_run_2.png';
                frame = frame === 1 ? 2 : 1;
            }
        }, 200);
    }

    private stopLoadingAnimation(): void {
        if (this.loadingInterval !== null) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
    }

    public showStartScreen(): void {
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'flex';

        this.hideGameOverScreen();
        this.hideRankingsScreen();
        this.hideMobileControls();
    }

    public hideStartScreen(): void {
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'none';
    }

    public isStartScreenVisible(): boolean {
        const startScreen = document.getElementById('start-screen');
        return !!startScreen && startScreen.style.display !== 'none';
    }

    public showMobileControls(): void {
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'flex';
    }

    public hideMobileControls(): void {
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'none';
    }

    public showGameOverScreen(
        baseScore: number,
        level: number,
        maxSpeed: number,
        stars: number,
        items: { onigiri: number; icecream: number; star: number },
        onCanReturnCallback: () => void
    ): number {
        const gameOverScreen = document.getElementById('game-over-screen');
        const finalScoreEl = document.getElementById('final-score');
        const returnBtn = document.getElementById('return-title-btn');

        const starBonus = stars * 200;
        const finalScore = baseScore + starBonus;

        if (gameOverScreen && finalScoreEl) {
            const randomMsg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
            const msgEl = document.getElementById('game-over-message');
            if (msgEl) msgEl.innerText = randomMsg;

            finalScoreEl.innerText = finalScore.toString();

            const baseScoreEl = document.getElementById('base-score');
            if (baseScoreEl) baseScoreEl.innerText = baseScore.toString();

            const levelEl = document.getElementById('result-level');
            if (levelEl) levelEl.innerText = level.toString();

            const maxSpeedEl = document.getElementById('result-max-speed');
            if (maxSpeedEl) maxSpeedEl.innerText = maxSpeed.toFixed(2) + 'x';

            const onigiriEl = document.getElementById('count-onigiri');
            if (onigiriEl) onigiriEl.innerText = items.onigiri.toString();

            const icecreamEl = document.getElementById('count-icecream');
            if (icecreamEl) icecreamEl.innerText = items.icecream.toString();

            const starEl = document.getElementById('count-star');
            if (starEl) starEl.innerText = items.star.toString();

            const starCountEl = document.getElementById('star-count');
            if (starCountEl) starCountEl.innerText = stars.toString();

            const starBonusEl = document.getElementById('star-bonus');
            if (starBonusEl) starBonusEl.innerText = '+' + starBonus.toString();

            gameOverScreen.classList.remove('hidden');

            if (returnBtn) returnBtn.classList.add('hidden');
        }

        setTimeout(() => {
            onCanReturnCallback();
            if (returnBtn) {
                returnBtn.classList.remove('hidden');
                returnBtn.classList.add('animate-bounce');
            }
        }, 3000);

        return finalScore;
    }

    public hideGameOverScreen(): void {
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) gameOverScreen.classList.add('hidden');

        const returnBtn = document.getElementById('return-title-btn');
        if (returnBtn) {
            returnBtn.classList.add('hidden');
            returnBtn.classList.remove('animate-bounce');
        }
    }

    public async showRankings(isGameOver: boolean = false, score?: number): Promise<void> {
        const rankingsEl = document.getElementById('rankings-screen');
        const rankingsList = document.getElementById('rankings-list');
        if (!rankingsEl || !rankingsList) return;

        rankingsList.innerHTML = '<div class="text-4xl font-black text-white animate-pulse">LOADING...</div>';
        rankingsEl.classList.remove('hidden');

        if (isGameOver) {
            const title = document.createElement('h2');
            title.className = "text-6xl font-black text-red-500 mb-4 drop-shadow-[4px_4px_0_#000] transform -rotate-3";
            title.innerText = "GAME OVER";
            rankingsList.innerHTML = '';
            rankingsList.appendChild(title);

            const scoreDisplay = document.createElement('div');
            scoreDisplay.className = "text-4xl font-bold text-white mb-8 drop-shadow-[2px_2px_0_#000]";
            scoreDisplay.innerText = `SCORE: ${score !== undefined ? score : 0}`;
            rankingsList.appendChild(scoreDisplay);
        } else {
            rankingsList.innerHTML = '<h2 class="text-6xl font-black text-yellow-400 mb-8 drop-shadow-[4px_4px_0_#000] transform -rotate-3">RANKING</h2>';
        }

        let scores: ScoreData[] = [];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const res = await fetch(`${API_BASE_URL}/scores`, {
                headers: { 'ngrok-skip-browser-warning': 'true' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    scores = data;
                } else {
                    scores = this.getLocalScores();
                }
            } else {
                scores = this.getLocalScores();
            }
        } catch {
            scores = this.getLocalScores();
        }

        const listContainer = document.createElement('div');
        listContainer.className = "w-full max-w-2xl bg-white/90 border-4 border-black rounded-xl p-6 shadow-[8px_8px_0_#000] transform rotate-1";

        if (scores.length === 0) {
            listContainer.innerHTML = '<div class="text-xl font-bold text-gray-700 py-4">No scores recorded yet!</div>';
        } else {
            listContainer.innerHTML = scores.map((s, i) => `
                <div class="flex justify-between items-center mb-4 border-b-2 border-dashed border-gray-400 pb-2 last:border-0">
                    <div class="flex items-center gap-4">
                        <span class="text-3xl font-black ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-orange-600' : 'text-black'} drop-shadow-sm">#${i + 1}</span> 
                        <div class="flex flex-col text-left">
                            <span class="text-2xl font-bold text-gray-800 truncate max-w-[200px]">${s.name}</span>
                            <span class="text-xs font-bold text-gray-500">Lv.${s.level || 1} | Max Speed: ${(s.max_speed || 1.0).toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-3xl font-black text-pink-500 drop-shadow-sm">${s.score}</span>
                        <div class="flex gap-1 text-xs text-gray-600">
                            <span>🍙${s.items?.onigiri || 0}</span>
                            <span>🍦${s.items?.icecream || 0}</span>
                            <span>⭐${s.items?.star || 0}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        rankingsList.appendChild(listContainer);
    }

    public hideRankingsScreen(): void {
        const rankingsEl = document.getElementById('rankings-screen');
        if (rankingsEl) rankingsEl.classList.add('hidden');
    }

    public submitScore(scoreData: ScoreData): void {
        // Save locally first (offline resilience)
        this.saveLocalScore(scoreData);

        // Try remote submission asynchronously
        fetch(`${API_BASE_URL}/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(scoreData)
        }).catch(() => {
            // Silently handled in offline mode
        });
    }

    private getLocalScores(): ScoreData[] {
        try {
            const raw = localStorage.getItem(UIManager.LOCAL_SCORES_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(item => item && typeof item === 'object' && typeof item.score === 'number');
        } catch {
            return [];
        }
    }

    private saveLocalScore(score: ScoreData): void {
        try {
            const list = this.getLocalScores();
            list.push(score);
            list.sort((a, b) => b.score - a.score);
            const topScores = list.slice(0, 100);
            localStorage.setItem(UIManager.LOCAL_SCORES_KEY, JSON.stringify(topScores));
        } catch (e) {
            console.warn("Failed to persist local score:", e);
        }
    }
}
