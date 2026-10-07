import MESSAGES from '../game_over_messages.json';
import type { AuthUser } from '../domain/auth/IAuthService';
import type { DetailedScoreRecord, IScoreRepository, RankingCategory, ScoreEntry } from '../domain/score/IScoreRepository';

export class UIManager {
    private loadingInterval: number | null = null;
    private scoreRepository?: IScoreRepository;
    private currentCategory: RankingCategory = 'personal';
    private currentDiscordUserId?: string;
    private tabsInitialized: boolean = false;
    private gameOverTimers: number[] = [];
    private slotIntervalId: number | null = null;

    constructor(scoreRepository?: IScoreRepository) {
        this.scoreRepository = scoreRepository;
    }

    public setScoreRepository(scoreRepository: IScoreRepository): void {
        this.scoreRepository = scoreRepository;
    }


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

    /**
     * Shows the initial auth gate ("アカウントを連携する" / "ゲストとしてログイン")
     */
    public showAuthGate(): void {
        const authGate = document.getElementById('auth-gate-container');
        const startControls = document.getElementById('start-controls-container');
        if (authGate) authGate.classList.remove('hidden');
        if (startControls) startControls.classList.add('hidden');
    }

    /**
     * Shows the actual game controls ("START GAME" / "RANKING") once logged in or guest
     */
    public showStartControls(): void {
        const authGate = document.getElementById('auth-gate-container');
        const startControls = document.getElementById('start-controls-container');
        if (authGate) authGate.classList.add('hidden');
        if (startControls) startControls.classList.remove('hidden');
    }

    /**
     * Displays user badge on title screen when logged in / guest
     */
    public renderUserBadge(user: AuthUser | null): void {
        const badgeEl = document.getElementById('user-badge');
        const nameEl = document.getElementById('user-display-name');
        const discordIdEl = document.getElementById('user-discord-id');
        const avatarEl = document.getElementById('user-avatar') as HTMLImageElement;
        const ambassadorTag = document.getElementById('ambassador-tag');
        const nameInput = document.getElementById('player-name-input') as HTMLInputElement;

        if (!badgeEl) return;

        if (!user) {
            badgeEl.classList.add('hidden');
            return;
        }

        badgeEl.classList.remove('hidden');

        const displayName = user.nickname || user.name || (user.is_guest ? 'Guest Player' : user.discord_user_id);
        if (nameEl) nameEl.innerText = displayName;

        if (discordIdEl) {
            discordIdEl.innerText = user.is_guest ? 'ゲストモード' : `@${user.discord_user_id}`;
        }

        if (avatarEl) {
            avatarEl.src = this.getSafeAvatarUrl(user.photo_url);
            avatarEl.onerror = () => {
                avatarEl.src = 'assets/chara_stop.png';
            };
        }

        if (ambassadorTag) {
            if (user.is_ambassador) {
                ambassadorTag.classList.remove('hidden');
            } else {
                ambassadorTag.classList.add('hidden');
            }
        }

        if (nameInput) {
            nameInput.value = displayName.substring(0, 15);
        }
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
        this.clearGameOverAnimations();

        const gameOverScreen = document.getElementById('game-over-screen');
        const container = document.getElementById('game-over-container');
        const charaEl = document.getElementById('game-over-character');
        const msgEl = document.getElementById('game-over-message');
        const itemsBox = document.getElementById('result-items-box');
        const otherStats = document.getElementById('result-other-stats');
        const buttonsContainer = document.getElementById('game-over-buttons-container');
        const finalScoreEl = document.getElementById('final-score');
        const finalScoreBox = document.getElementById('final-score-box');

        const starBonus = stars * 200;
        const finalScore = baseScore + starBonus;

        if (!gameOverScreen || !finalScoreEl) return finalScore;

        // Reset elements to initial states
        container?.classList.remove('animate-screen-shake');
        finalScoreBox?.classList.remove('animate-slot-pop');
        msgEl?.classList.remove('animate-drop-bounce');

        if (charaEl) {
            charaEl.className = "h-64 lg:h-96 object-contain z-10 transition-all duration-500 ease-out transform -translate-x-[200%] opacity-0";
        }
        if (msgEl) {
            const randomMsg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
            msgEl.innerText = randomMsg;
            msgEl.className = "absolute top-10 right-10 lg:right-0 bg-white text-black p-6 rounded-[2rem] rounded-bl-none text-xl lg:text-2xl font-bold border-4 border-black shadow-[8px_8px_0_rgba(0,0,0,0.5)] max-w-[200px] transform -translate-y-24 opacity-0 transition-all duration-300";
        }
        if (itemsBox) {
            itemsBox.className = "bg-black/40 rounded-xl p-3 col-span-2 border-2 border-transparent transition-all duration-500 opacity-0 transform scale-75";
        }
        if (otherStats) {
            otherStats.className = "col-span-2 grid grid-cols-2 gap-4 transition-all duration-500 opacity-0 transform translate-y-6";
        }
        if (buttonsContainer) {
            buttonsContainer.className = "flex flex-col sm:flex-row gap-4 justify-center transition-all duration-300 opacity-0 pointer-events-none transform translate-y-4";
        }

        // Set static values
        const baseScoreEl = document.getElementById('base-score');
        if (baseScoreEl) baseScoreEl.innerText = baseScore.toString();
        const levelEl = document.getElementById('result-level');
        if (levelEl) levelEl.innerText = level.toString();
        const maxSpeedEl = document.getElementById('result-max-speed');
        if (maxSpeedEl) maxSpeedEl.innerText = maxSpeed.toFixed(2) + 'x';
        const starCountEl = document.getElementById('star-count');
        if (starCountEl) starCountEl.innerText = stars.toString();
        const starBonusEl = document.getElementById('star-bonus');
        if (starBonusEl) starBonusEl.innerText = '+' + starBonus.toString();

        // Initialize items display at 0
        const onigiriEl = document.getElementById('count-onigiri');
        const icecreamEl = document.getElementById('count-icecream');
        const starEl = document.getElementById('count-star');
        if (onigiriEl) onigiriEl.innerText = '0';
        if (icecreamEl) icecreamEl.innerText = '0';
        if (starEl) starEl.innerText = '0';

        gameOverScreen.classList.remove('hidden');

        // ==========================================
        // Step 1: Slot machine score roll & particles (0ms - 1000ms)
        // ==========================================
        this.runSlotAnimation(finalScore, finalScoreEl, finalScoreBox);

        // ==========================================
        // Step 2: Items fade-in & count-up & screen shake (1000ms - 1800ms)
        // ==========================================
        const timer1 = window.setTimeout(() => {
            if (itemsBox) {
                itemsBox.classList.remove('opacity-0', 'scale-75');
                itemsBox.classList.add('opacity-100', 'scale-100');
            }
            this.animateNumberCount(onigiriEl, 0, items.onigiri, 500);
            this.animateNumberCount(icecreamEl, 0, items.icecream, 500);
            this.animateNumberCount(starEl, 0, items.star, 500);
        }, 1050);
        this.gameOverTimers.push(timer1);

        const timer2 = window.setTimeout(() => {
            // Screen Shake "ドンッ！"
            if (container) {
                container.classList.remove('animate-screen-shake');
                void container.offsetWidth; // force reflow
                container.classList.add('animate-screen-shake');
            }
        }, 1750);
        this.gameOverTimers.push(timer2);

        // ==========================================
        // Step 3: Character slide-in & comment drop & dust (1800ms - 2500ms)
        // ==========================================
        const timer3 = window.setTimeout(() => {
            if (charaEl) {
                charaEl.classList.remove('-translate-x-[200%]', 'opacity-0');
                charaEl.classList.add('translate-x-0', 'opacity-100');
            }
        }, 1850);
        this.gameOverTimers.push(timer3);

        const timer4 = window.setTimeout(() => {
            this.spawnDustParticles();
            if (msgEl) {
                msgEl.classList.remove('-translate-y-24', 'opacity-0');
                msgEl.classList.add('animate-drop-bounce');
            }
        }, 2200);
        this.gameOverTimers.push(timer4);

        // ==========================================
        // Step 4: Other stats fade-in & buttons appear (2500ms - 3000ms)
        // ==========================================
        const timer5 = window.setTimeout(() => {
            if (otherStats) {
                otherStats.classList.remove('opacity-0', 'translate-y-6');
                otherStats.classList.add('opacity-100', 'translate-y-0');
            }
        }, 2550);
        this.gameOverTimers.push(timer5);

        const timer6 = window.setTimeout(() => {
            if (buttonsContainer) {
                buttonsContainer.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
                buttonsContainer.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
            }
            const returnBtn = document.getElementById('return-title-btn');
            if (returnBtn) {
                returnBtn.classList.add('animate-bounce');
            }
            onCanReturnCallback();
        }, 3000);
        this.gameOverTimers.push(timer6);

        return finalScore;
    }

    private runSlotAnimation(finalScore: number, finalScoreEl: HTMLElement, finalScoreBox: HTMLElement | null): void {
        const targetStr = finalScore.toString();
        const numDigits = targetStr.length;
        const startTime = performance.now();
        const duration = 1000;

        let lockedDigits = 0;

        this.slotIntervalId = window.setInterval(() => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Calculate how many digits should be locked from left to right
            const targetLocked = Math.min(numDigits, Math.floor(progress * (numDigits + 0.5)));

            if (targetLocked > lockedDigits) {
                for (let k = lockedDigits; k < targetLocked; k++) {
                    this.spawnSparkleParticles(4);
                }
                lockedDigits = targetLocked;
            }

            let displayStr = '';
            for (let i = 0; i < numDigits; i++) {
                if (i < lockedDigits) {
                    displayStr += targetStr[i];
                } else {
                    displayStr += Math.floor(Math.random() * 10).toString();
                }
            }
            finalScoreEl.innerText = displayStr;

            if (progress >= 1 && lockedDigits >= numDigits) {
                if (this.slotIntervalId !== null) {
                    clearInterval(this.slotIntervalId);
                    this.slotIntervalId = null;
                }
                finalScoreEl.innerText = targetStr;
                if (finalScoreBox) {
                    finalScoreBox.classList.remove('animate-slot-pop');
                    void finalScoreBox.offsetWidth;
                    finalScoreBox.classList.add('animate-slot-pop');
                }
                this.spawnSparkleParticles(12);
            }
        }, 40);
    }

    private animateNumberCount(el: HTMLElement | null, start: number, target: number, duration: number): void {
        if (!el) return;
        if (target === 0) {
            el.innerText = '0';
            return;
        }

        const startTime = performance.now();
        const step = (now: number) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const current = Math.round(start + (target - start) * progress);
            el.innerText = current.toString();
            if (progress < 1) {
                const animId = requestAnimationFrame(step);
                this.gameOverTimers.push(animId);
            } else {
                el.innerText = target.toString();
            }
        };
        const animId = requestAnimationFrame(step);
        this.gameOverTimers.push(animId);
    }

    private spawnSparkleParticles(count: number = 6): void {
        const container = document.getElementById('game-over-sparkle-container');
        if (!container) return;

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            const size = Math.floor(Math.random() * 12) + 8; // 8px - 20px
            const left = Math.floor(Math.random() * 90) + 5; // 5% - 95%
            const top = Math.floor(Math.random() * 90) + 5;
            const colors = ['#fde047', '#f59e0b', '#fbbf24', '#ffffff'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            p.className = "absolute rounded-full pointer-events-none animate-sparkle shadow-sm";
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.left = `${left}%`;
            p.style.top = `${top}%`;
            p.style.backgroundColor = color;

            container.appendChild(p);
            setTimeout(() => {
                p.remove();
            }, 600);
        }
    }

    private spawnDustParticles(count: number = 10): void {
        const container = document.getElementById('game-over-dust-container');
        if (!container) return;

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            const size = Math.floor(Math.random() * 14) + 8; // 8px - 22px
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 40 + 20;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist - 15; // slightly upward bias

            p.className = "absolute rounded-full pointer-events-none animate-dust bg-white/70";
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.left = `calc(50% - ${size / 2}px)`;
            p.style.top = `calc(50% - ${size / 2}px)`;
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);

            container.appendChild(p);
            setTimeout(() => {
                p.remove();
            }, 700);
        }
    }

    public hideGameOverScreen(): void {
        this.clearGameOverAnimations();
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) gameOverScreen.classList.add('hidden');

        const returnBtn = document.getElementById('return-title-btn');
        if (returnBtn) {
            returnBtn.classList.remove('animate-bounce');
        }
    }

    private clearGameOverAnimations(): void {
        if (this.slotIntervalId !== null) {
            clearInterval(this.slotIntervalId);
            this.slotIntervalId = null;
        }
        for (const t of this.gameOverTimers) {
            clearTimeout(t);
            cancelAnimationFrame(t);
        }
        this.gameOverTimers = [];

        // Clear spawned particle elements
        const sparkleLayer = document.getElementById('game-over-sparkle-container');
        if (sparkleLayer) sparkleLayer.innerHTML = '';
        const dustLayer = document.getElementById('game-over-dust-container');
        if (dustLayer) dustLayer.innerHTML = '';
    }

    // ==========================================
    // Tutorial Modal Management
    // ==========================================
    public showTutorial(): void {
        const modal = document.getElementById('tutorial-modal');
        if (modal) modal.classList.remove('hidden');
    }

    public hideTutorial(): void {
        const modal = document.getElementById('tutorial-modal');
        if (modal) modal.classList.add('hidden');
    }

    public isTutorialVisible(): boolean {
        const modal = document.getElementById('tutorial-modal');
        return modal ? !modal.classList.contains('hidden') : false;
    }

    public isModalOpen(): boolean {
        const tutorialModal = document.getElementById('tutorial-modal');
        const rankingsModal = document.getElementById('rankings-screen');
        const isTutorial = tutorialModal ? !tutorialModal.classList.contains('hidden') : false;
        const isRankings = rankingsModal ? !rankingsModal.classList.contains('hidden') : false;
        return isTutorial || isRankings;
    }


    public async showRankings(
        isGameOver: boolean = false,
        score?: number,
        defaultCategory?: RankingCategory,
        discordUserId?: string
    ): Promise<void> {
        const rankingsEl = document.getElementById('rankings-screen');
        if (!rankingsEl) return;

        this.currentDiscordUserId = discordUserId;
        this.initRankingTabs();

        const titleEl = document.getElementById('rankings-title');
        const subtitleEl = document.getElementById('rankings-subtitle');

        if (isGameOver) {
            if (titleEl) {
                titleEl.innerText = "GAME OVER";
                titleEl.className = "text-5xl sm:text-6xl font-black text-red-500 drop-shadow-[4px_4px_0_#000] transform -rotate-2 tracking-wider";
            }
            if (subtitleEl) {
                subtitleEl.innerText = `SCORE: ${score !== undefined ? score : 0}`;
                subtitleEl.classList.remove('hidden');
            }
        } else {
            if (titleEl) {
                titleEl.innerText = "RANKING";
                titleEl.className = "text-5xl sm:text-6xl font-black text-yellow-400 drop-shadow-[4px_4px_0_#000] transform -rotate-2 tracking-wider";
            }
            if (subtitleEl) {
                subtitleEl.classList.add('hidden');
            }
        }

        rankingsEl.classList.remove('hidden');

        // Choose category: Game over defaults to personal best, title screen defaults to global
        const initialCategory: RankingCategory = defaultCategory || (isGameOver ? 'personal' : 'global');
        await this.switchRankingCategory(initialCategory);
    }

    private initRankingTabs(): void {
        if (this.tabsInitialized) return;
        this.tabsInitialized = true;

        const myBestBtn = document.getElementById('rankings-tab-mybest');
        const globalBtn = document.getElementById('rankings-tab-global');
        const weeklyBtn = document.getElementById('rankings-tab-weekly');

        myBestBtn?.addEventListener('click', () => {
            void this.switchRankingCategory('personal');
        });
        globalBtn?.addEventListener('click', () => {
            void this.switchRankingCategory('global');
        });
        weeklyBtn?.addEventListener('click', () => {
            void this.switchRankingCategory('weekly');
        });
    }

    public async switchRankingCategory(category: RankingCategory): Promise<void> {
        this.currentCategory = category;

        const myBestBtn = document.getElementById('rankings-tab-mybest');
        const globalBtn = document.getElementById('rankings-tab-global');
        const weeklyBtn = document.getElementById('rankings-tab-weekly');
        const noticeEl = document.getElementById('rankings-category-notice');

        const activeClass = "bg-yellow-400 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5";
        const inactiveClass = "bg-white/80 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-white";

        const updateBtn = (btn: HTMLElement | null, isActive: boolean) => {
            if (!btn) return;
            if (isActive) {
                btn.className = `flex-1 py-2 sm:py-2.5 px-2 border-4 border-black rounded-xl text-base sm:text-lg font-black transition-all cursor-pointer ${activeClass}`;
            } else {
                btn.className = `flex-1 py-2 sm:py-2.5 px-2 border-4 border-black rounded-xl text-base sm:text-lg font-black transition-all cursor-pointer ${inactiveClass}`;
            }
        };

        updateBtn(myBestBtn, category === 'personal');
        updateBtn(globalBtn, category === 'global');
        updateBtn(weeklyBtn, category === 'weekly');

        if (noticeEl) {
            if (category === 'personal') {
                noticeEl.innerText = "TOP 3 PERSONAL RECORDS (SAVED IN CLOUD & LOCAL)";
            } else if (category === 'global') {
                noticeEl.innerText = "ALL-TIME GLOBAL TOP PLAYERS";
            } else {
                noticeEl.innerText = "THIS WEEK'S TOP PLAYERS (LAST 7 DAYS)";
            }
        }

        await this.renderCategoryList();
    }

    private async renderCategoryList(): Promise<void> {
        const rankingsList = document.getElementById('rankings-list');
        if (!rankingsList) return;

        rankingsList.innerHTML = '<div class="text-3xl font-black text-white py-8 animate-pulse">LOADING...</div>';

        const listContainer = document.createElement('div');
        listContainer.className = "w-full max-w-2xl mx-auto bg-white/95 border-4 border-black rounded-xl p-4 sm:p-6 shadow-[8px_8px_0_#000] text-black";

        if (!this.scoreRepository) {
            listContainer.innerHTML = '<div class="text-xl font-bold text-gray-700 py-4">Score repository not available.</div>';
            rankingsList.innerHTML = '';
            rankingsList.appendChild(listContainer);
            return;
        }

        if (this.currentCategory === 'personal') {
            const records: DetailedScoreRecord[] = await this.scoreRepository.getPersonalScores(this.currentDiscordUserId);
            if (records.length === 0) {
                listContainer.innerHTML = `
                    <div class="py-6 text-center">
                        <div class="text-xl font-black text-gray-800 mb-2">NO PERSONAL RECORDS YET</div>
                        <div class="text-sm font-bold text-gray-500">Play a game to record your personal best score!</div>
                    </div>
                `;
            } else {
                listContainer.innerHTML = records.map((r, i) => {
                    const rankColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-500' : 'text-amber-700';
                    const rankLabel = `#${i + 1}`;
                    const formattedDate = this.formatDate(r.recorded_at);

                    return `
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b-2 border-dashed border-gray-300 last:border-0 gap-2">
                            <div class="flex items-center gap-4 text-left">
                                <span class="text-4xl font-black ${rankColor} drop-shadow-sm w-12 text-center">${rankLabel}</span>
                                <div class="flex flex-col">
                                    <div class="flex items-baseline gap-2">
                                        <span class="text-2xl font-black text-gray-900">${this.escapeHtml(r.user_name)}</span>
                                        ${formattedDate ? `<span class="text-xs font-mono font-bold text-gray-500">${this.escapeHtml(formattedDate)}</span>` : ''}
                                    </div>
                                    <span class="text-xs font-bold text-gray-600">Lv.${r.level} | Max Speed: ${r.max_speed.toFixed(2)}x</span>
                                </div>
                            </div>
                            <div class="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-200">
                                <span class="text-3xl font-black text-pink-500 drop-shadow-sm">${r.score}</span>
                                <div class="flex gap-2 text-xs font-bold text-gray-600">
                                    <span>🍙${r.items.onigiri}</span>
                                    <span>🍦${r.items.icecream}</span>
                                    <span>⭐${r.items.star}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } else if (this.currentCategory === 'global') {
            const scores: ScoreEntry[] = await this.scoreRepository.getGlobalScores();
            if (scores.length === 0) {
                listContainer.innerHTML = `
                    <div class="py-6 text-center">
                        <div class="text-xl font-black text-gray-800 mb-2">NO GLOBAL SCORES YET</div>
                        <div class="text-sm font-bold text-gray-500">Be the first to record a score on the leaderboard!</div>
                    </div>
                `;
            } else {
                listContainer.innerHTML = scores.map((s, i) => {
                    const rankColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-amber-700' : 'text-black';
                    return `
                        <div class="flex justify-between items-center py-2.5 border-b-2 border-dashed border-gray-300 last:border-0">
                            <div class="flex items-center gap-3 text-left">
                                <span class="text-2xl font-black ${rankColor} w-10 text-center">#${i + 1}</span>
                                ${s.photo_url ? `<img src="${this.getSafeAvatarUrl(s.photo_url)}" alt="avatar" class="w-9 h-9 rounded-full border-2 border-black object-cover shrink-0" onerror="this.style.display='none'" />` : ''}
                                <div class="flex flex-col">
                                    <span class="text-lg sm:text-xl font-black text-gray-800 truncate max-w-[180px] sm:max-w-[240px]">${this.escapeHtml(s.name)}</span>
                                    <span class="text-xs font-bold text-gray-500">Lv.${s.level || 1} | Max Speed: ${(s.max_speed || 1.0).toFixed(2)}x</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-end">
                                <span class="text-2xl sm:text-3xl font-black text-pink-500">${s.score}</span>
                                <div class="flex gap-1.5 text-xs text-gray-600 font-bold">
                                    <span>🍙${s.items?.onigiri || 0}</span>
                                    <span>🍦${s.items?.icecream || 0}</span>
                                    <span>⭐${s.items?.star || 0}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } else {
            // Weekly
            const scores: ScoreEntry[] = await this.scoreRepository.getWeeklyScores();
            if (scores.length === 0) {
                listContainer.innerHTML = `
                    <div class="py-6 text-center">
                        <div class="text-xl font-black text-gray-800 mb-2">NO WEEKLY SCORES YET</div>
                        <div class="text-sm font-bold text-gray-500">No plays recorded within the last 7 days. Be the first!</div>
                    </div>
                `;
            } else {
                listContainer.innerHTML = scores.map((s, i) => {
                    const rankColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-amber-700' : 'text-black';
                    const formattedDate = this.formatDate(s.date);
                    return `
                        <div class="flex justify-between items-center py-2.5 border-b-2 border-dashed border-gray-300 last:border-0">
                            <div class="flex items-center gap-3 text-left">
                                <span class="text-2xl font-black ${rankColor} w-10 text-center">#${i + 1}</span>
                                ${s.photo_url ? `<img src="${this.getSafeAvatarUrl(s.photo_url)}" alt="avatar" class="w-9 h-9 rounded-full border-2 border-black object-cover shrink-0" onerror="this.style.display='none'" />` : ''}
                                <div class="flex flex-col">
                                    <div class="flex items-baseline gap-2">
                                        <span class="text-lg sm:text-xl font-black text-gray-800 truncate max-w-[160px] sm:max-w-[220px]">${this.escapeHtml(s.name)}</span>
                                        ${formattedDate ? `<span class="text-xs font-mono font-bold text-gray-400">${this.escapeHtml(formattedDate)}</span>` : ''}
                                    </div>
                                    <span class="text-xs font-bold text-gray-500">Lv.${s.level || 1} | Max Speed: ${(s.max_speed || 1.0).toFixed(2)}x</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-end">
                                <span class="text-2xl sm:text-3xl font-black text-pink-500">${s.score}</span>
                                <div class="flex gap-1.5 text-xs text-gray-600 font-bold">
                                    <span>🍙${s.items?.onigiri || 0}</span>
                                    <span>🍦${s.items?.icecream || 0}</span>
                                    <span>⭐${s.items?.star || 0}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        rankingsList.innerHTML = '';
        rankingsList.appendChild(listContainer);
    }

    private formatDate(dateStr?: string): string {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
        } catch {
            return '';
        }
    }

    public hideRankingsScreen(): void {
        const rankingsEl = document.getElementById('rankings-screen');
        if (rankingsEl) rankingsEl.classList.add('hidden');
    }

    private escapeHtml(text: string): string {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private getSafeAvatarUrl(url: string | null | undefined): string {
        if (!url || typeof url !== 'string') return 'assets/chara_stop.png';
        const trimmed = url.trim();
        if (trimmed.startsWith('assets/') || trimmed.startsWith('/assets/')) {
            return trimmed;
        }
        try {
            const parsed = new URL(trimmed, window.location.href);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.href;
            }
        } catch {
            // Ignore parse errors
        }
        return 'assets/chara_stop.png';
    }
}
