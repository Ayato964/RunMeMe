import { StageManager } from './StageManager';
import { Player } from './Player';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './config';
import type { GameConfig } from './types';
import { AssetManager } from './core/AssetManager';
import { InputManager } from './core/InputManager';
import { CollisionSystem } from './core/CollisionSystem';
import { ItemRegistry } from './domain/items/ItemRegistry';
import { HybridStageRepository } from './stages/HybridStageRepository';
import type { IStageRepository } from './stages/IStageRepository';
import { UIManager } from './ui/UIManager';
import type { GamePlayContext } from './domain/items/ItemStrategy';
import type { IAuthService } from './domain/auth/IAuthService';
import { MoffyAuthService } from './domain/auth/MoffyAuthService';
import type { IScoreRepository, RankingCategory } from './domain/score/IScoreRepository';
import { HybridScoreRepository as GameScoreRepository } from './domain/score/HybridScoreRepository';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // Core Managers & Systems
    private assetManager: AssetManager;
    private stageRepository: IStageRepository;
    private stageManager: StageManager;
    private player: Player;
    private collisionSystem: CollisionSystem;
    private itemRegistry: ItemRegistry;
    private uiManager: UIManager;
    private authService: IAuthService;
    private scoreRepository: IScoreRepository;
    private inputManager!: InputManager;

    // Game Loop & Timing
    private lastTime: number = 0;
    private gameLoopId: number | null = null;
    private isGameOver: boolean = false;
    private canReturnToTitle: boolean = false;
    private totalPlayTime: number = 0;
    private timeSinceLastSpeedIncrease: number = 0;

    // Scoring & Progression
    private score: number = 0;
    private lastScoreDistance: number = 0;
    private maxSpeed: number = 1.0;
    private speedMultiplier: number = 1.0;
    private readonly scrollSpeed: number = 6;
    private level: number = 1;
    private testFinishDistance: number | null = null;

    private collectedItems = {
        onigiri: 0,
        icecream: 0,
        star: 0
    };

    // Scaling & Viewport
    private scale: number = 1;
    private offsetX: number = 0;
    private offsetY: number = 0;
    private backgroundIndex: number = 1;

    // Visual Effects
    private levelUpEffect = {
        active: false,
        timer: 0,
        alpha: 1
    };
    private particles: Particle[] = [];

    private readonly config: GameConfig = {
        gravity: 0.6,
        jumpForce: -15,
        baseSpeed: 6,
        speedIncreaseRate: 0.1
    };

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        // Instantiate decoupled subsystems (DIP)
        this.assetManager = new AssetManager();
        this.stageRepository = new HybridStageRepository();
        this.stageManager = new StageManager(this.stageRepository, this.assetManager);
        this.player = new Player(this.config, this.assetManager, 100, LOGICAL_HEIGHT - 300);
        this.itemRegistry = new ItemRegistry();
        this.collisionSystem = new CollisionSystem(this.itemRegistry, this.assetManager);
        this.authService = new MoffyAuthService();
        this.scoreRepository = new GameScoreRepository();
        this.uiManager = new UIManager(this.scoreRepository);

        this.initGame();
    }

    private async initGame(): Promise<void> {
        this.uiManager.showLoading();

        // Handle OAuth callback if returning from IdentityLoginSystem with token fragment
        this.authService.handleCallback();

        this.setupInputs();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Preload assets asynchronously
        await this.assetManager.preloadAll();
        this.uiManager.hideLoading();

        // Check authentication state
        if (this.authService.isAuthenticated()) {
            const currentUser = this.authService.getCurrentUser();
            this.uiManager.renderUserBadge(currentUser);
            this.uiManager.showStartControls();

            // Synchronize cloud progress in the background to ensure newest personal bests on this device
            if (currentUser && !currentUser.is_guest) {
                this.scoreRepository.getProgress(currentUser.discord_user_id).catch((err) => {
                    console.warn('[Game] Initial cloud sync deferred:', err);
                });
            }
        } else {
            this.uiManager.renderUserBadge(null);
            this.uiManager.showAuthGate();
        }

        // Check for test mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test') {
            this.start();
        }
    }

    private setupInputs(): void {
        this.inputManager = new InputManager(
            this.canvas,
            {
                onJump: () => {
                    if (this.player.jump()) {
                        this.assetManager.playSfx('assets/sound/Jump.wav');
                    }
                },
                onStartGame: () => {
                    // Crucial: Trigger audio unlock synchronously inside the user activation event call stack!
                    this.assetManager.playRandomBgm();
                    this.uiManager.showLoading();
                    setTimeout(() => {
                        this.start(false).then(() => {
                            this.uiManager.hideLoading();
                        });
                    }, 500);
                },
                onReturnToTitle: () => {
                    this.returnToTitle();
                },
                onShowRankings: () => {
                    this.showRankings();
                },
                onCloseRankings: () => {
                    this.uiManager.hideRankingsScreen();
                },
                onShowTutorial: () => {
                    this.uiManager.showTutorial();
                },
                onCloseTutorial: () => {
                    this.uiManager.hideTutorial();
                },
                onLinkAccount: () => {
                    this.authService.login();
                },
                onGuestLogin: () => {
                    this.authService.loginAsGuest();
                    this.uiManager.renderUserBadge(this.authService.getCurrentUser());
                    this.uiManager.showStartControls();
                },
                onLogout: () => {
                    this.authService.logout();
                    this.uiManager.renderUserBadge(null);
                    this.uiManager.showAuthGate();
                }
            },
            () => this.isGameOver,
            () => this.canReturnToTitle,
            () => this.uiManager.isStartScreenVisible(),
            () => !this.authService.isAuthenticated(),
            () => this.uiManager.isModalOpen()
        );
    }

    private resize(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        const scaleX = this.canvas.width / LOGICAL_WIDTH;
        const scaleY = this.canvas.height / LOGICAL_HEIGHT;
        this.scale = Math.min(scaleX, scaleY);

        this.offsetX = (this.canvas.width - LOGICAL_WIDTH * this.scale) / 2;
        this.offsetY = (this.canvas.height - LOGICAL_HEIGHT * this.scale) / 2;
    }

    public async start(playBgm: boolean = true): Promise<void> {
        try {
            this.reset();
            if (playBgm) {
                this.assetManager.playRandomBgm();
            }
            if (!this.gameLoopId) {
                this.loop(performance.now());
            }
        } catch (error) {
            console.error("Game start error:", error);
            alert("Failed to start game. Please refresh.");
        }
    }

    private reset(): void {
        this.canReturnToTitle = false;
        this.isGameOver = false;
        this.score = 0;
        this.lastScoreDistance = 0;
        this.maxSpeed = 1.0;
        this.collectedItems = { onigiri: 0, icecream: 0, star: 0 };
        this.speedMultiplier = 1.0;
        this.timeSinceLastSpeedIncrease = 0;
        this.totalPlayTime = 0;
        this.level = 1;
        this.particles = [];
        this.levelUpEffect.active = false;
        this.testFinishDistance = null;

        this.stageManager.reset();
        this.player = new Player(this.config, this.assetManager, 100, LOGICAL_HEIGHT - 300);

        this.uiManager.hideRankingsScreen();
        this.uiManager.hideTutorial();
        this.uiManager.hideStartScreen();
        this.uiManager.hideGameOverScreen();
        this.uiManager.showMobileControls();

        this.lastTime = performance.now();

        // Safely parse test stage once on reset (defensive against corrupt localStorage)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test') {
            try {
                const testStageStr = localStorage.getItem('testStage');
                const testSpeedStr = localStorage.getItem('testSpeed');

                if (testStageStr) {
                    const testStage = JSON.parse(testStageStr);
                    if (testStage && typeof testStage.width === 'number') {
                        this.stageManager.setTestStage(testStage);
                        this.testFinishDistance = 2400 + testStage.width;
                    }

                    if (testSpeedStr) {
                        const parsed = parseFloat(testSpeedStr);
                        if (!isNaN(parsed) && parsed > 0) {
                            this.speedMultiplier = parsed;
                            this.config.speedIncreaseRate = 0;
                        }
                    }
                }
            } catch (e) {
                console.warn("Failed to load test stage safely:", e);
            }
        }

        this.backgroundIndex = Math.floor(Math.random() * 5) + 1;
    }

    private loop(timestamp: number): void {
        if (this.isGameOver) return;

        let dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (dt > 50) dt = 50;

        this.update(dt);
        this.draw();

        this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
    }

    private update(dt: number): void {
        this.totalPlayTime += dt;

        // Level calculation (Level 1 to 8, +1 every 35s)
        const newLevel = Math.min(8, Math.floor(this.totalPlayTime / 35000) + 1);
        if (newLevel > this.level) {
            this.level = newLevel;
            this.levelUpEffect.active = true;
            this.levelUpEffect.timer = 3000;
            this.levelUpEffect.alpha = 1;

            for (let i = 0; i < 30; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 5;
                this.particles.push({
                    x: LOGICAL_WIDTH / 2,
                    y: LOGICAL_HEIGHT / 2,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1000 + Math.random() * 1500,
                    color: i % 2 === 0 ? '#fbbf24' : '#ffffff',
                    size: 4 + Math.random() * 6
                });
            }
        }

        // Dynamic speed increase
        const speedIncreaseInterval = (10 - (this.level - 1)) * 1000;
        this.timeSinceLastSpeedIncrease += dt;
        if (this.timeSinceLastSpeedIncrease > speedIncreaseInterval) {
            this.speedMultiplier += this.config.speedIncreaseRate;
            this.timeSinceLastSpeedIncrease = 0;
        }

        // Visual effects update
        if (this.levelUpEffect.active) {
            this.levelUpEffect.timer -= dt;
            if (this.levelUpEffect.timer <= 0) {
                this.levelUpEffect.active = false;
            } else {
                this.levelUpEffect.alpha = Math.abs(Math.sin(this.levelUpEffect.timer / 100));
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * (dt / 16);
            p.y += p.vy * (dt / 16);
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // World and player updates
        this.stageManager.update(dt, this.speedMultiplier, this.scrollSpeed);
        this.player.update(dt, this.speedMultiplier);

        // Gameplay context for collision resolution (Strategy pattern)
        const context: GamePlayContext = {
            addScore: (amount: number) => {
                this.score += amount;
            },
            modifySpeed: (delta: number, minSpeed: number = 0.5) => {
                this.speedMultiplier = Math.max(minSpeed, this.speedMultiplier + delta);
            },
            grantDoubleJump: () => {
                this.player.addDoubleJump();
            },
            incrementCollectedItem: (type: 'onigiri' | 'icecream' | 'star') => {
                this.collectedItems[type]++;
            }
        };

        const collisionResult = this.collisionSystem.checkAndResolve(
            this.player,
            this.stageManager.getElements(),
            dt,
            context
        );

        if (collisionResult.isGameOver) {
            this.gameOver();
            return;
        }

        // Score accumulation by distance travelled
        const currentDist = this.stageManager.getTotalDistance();
        while (currentDist - this.lastScoreDistance >= 100) {
            this.lastScoreDistance += 100;
            this.score += 3 + (this.level * this.speedMultiplier * 2);
        }

        if (this.speedMultiplier > this.maxSpeed) {
            this.maxSpeed = this.speedMultiplier;
        }

        // Check falling off screen
        if (this.player.position.y - this.player.size.height > LOGICAL_HEIGHT) {
            this.gameOver();
            return;
        }

        // Check test mode clear condition (no JSON.parse per frame)
        if (this.testFinishDistance !== null && !this.isGameOver) {
            if (this.stageManager.getTotalDistance() > this.testFinishDistance) {
                this.onTestClear();
            }
        }
    }

    private onTestClear(): void {
        this.isGameOver = true;
        if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
        this.assetManager.stopBgm();

        let currentSpeed = 1.0;
        try {
            currentSpeed = parseFloat(localStorage.getItem('testSpeed') || '1.0');
        } catch {
            currentSpeed = 1.0;
        }
        const nextSpeed = currentSpeed + 1.0;

        if (nextSpeed > 3.0) {
            alert("TEST CLEARED! You can now publish this stage.");
            try {
                localStorage.setItem('testCompleted', 'true');
            } catch {
                // Ignore storage errors
            }
            window.location.href = '/stagemaker.html';
        } else {
            alert(`SPEED ${currentSpeed.toFixed(1)} CLEARED! Next: ${nextSpeed.toFixed(1)}`);
            try {
                localStorage.setItem('testSpeed', nextSpeed.toFixed(1));
            } catch {
                // Ignore storage errors
            }
            window.location.reload();
        }
    }

    private draw(): void {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        this.ctx.beginPath();
        this.ctx.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        this.ctx.clip();

        // Draw background
        const bgPath = this.backgroundIndex === 1
            ? 'assets/background.png'
            : `assets/background${this.backgroundIndex}.png`;
        const bgImg = this.assetManager.getImage(bgPath);

        if (bgImg.complete) {
            this.ctx.drawImage(bgImg, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        } else {
            this.ctx.fillStyle = '#87CEEB';
            this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        }

        // Draw stage and player
        this.stageManager.draw(this.ctx);
        this.player.draw(this.ctx);

        // Draw HUD
        this.drawHUD();

        // Draw particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw level up effect overlay
        if (this.levelUpEffect.active) {
            this.ctx.save();
            this.ctx.globalAlpha = this.levelUpEffect.alpha;
            this.ctx.textAlign = 'center';
            this.ctx.lineWidth = 8;
            this.ctx.lineJoin = 'round';

            const startY = LOGICAL_HEIGHT / 2 - 20;
            this.ctx.font = '900 60px "Comic Sans MS", sans-serif';
            this.ctx.strokeStyle = 'black';
            this.ctx.fillStyle = 'white';
            const lvText = `LV.${this.level}`;
            this.ctx.strokeText(lvText, LOGICAL_WIDTH / 2, startY);
            this.ctx.fillText(lvText, LOGICAL_WIDTH / 2, startY);

            this.ctx.fillStyle = '#fbbf24';
            const spText = 'SPEED UP!!!';
            this.ctx.strokeText(spText, LOGICAL_WIDTH / 2, startY + 70);
            this.ctx.fillText(spText, LOGICAL_WIDTH / 2, startY + 70);

            this.ctx.restore();
        }

        this.ctx.restore();
    }

    private drawHUD(): void {
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 30px "Comic Sans MS", "Chalkboard SE", sans-serif';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 6;
        this.ctx.lineJoin = 'round';

        // Score
        const scoreText = `Score: ${Math.floor(this.score)}`;
        this.ctx.strokeText(scoreText, 20, 50);
        this.ctx.fillText(scoreText, 20, 50);

        // Speed & Level
        const statsText = `Speed: ${this.speedMultiplier.toFixed(2)}x   Lv.${this.level}`;
        this.ctx.font = 'bold 24px "Comic Sans MS", "Chalkboard SE", sans-serif';
        this.ctx.strokeText(statsText, 20, 85);
        this.ctx.fillText(statsText, 20, 85);

        // Double jump count
        if (this.player.doubleJumpCount > 0) {
            this.ctx.fillStyle = '#f6e05e';
            this.ctx.font = 'bold 24px "Comic Sans MS", sans-serif';
            const jumpText = `Double Jumps: ${this.player.doubleJumpCount}`;
            this.ctx.strokeText(jumpText, 20, 115);
            this.ctx.fillText(jumpText, 20, 115);
        }
    }

    private gameOver(): void {
        this.isGameOver = true;
        this.canReturnToTitle = false;

        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }

        this.assetManager.stopBgm();
        this.assetManager.playSfx('assets/sound/gameover.wav');

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test') {
            alert("TEST FAILED! Returning to editor...");
            window.location.href = '/stagemaker.html';
            return;
        }

        this.uiManager.hideMobileControls();

        const baseScore = Math.floor(this.score);
        const finalScore = this.uiManager.showGameOverScreen(
            baseScore,
            this.level,
            this.maxSpeed,
            this.player.doubleJumpCount,
            this.collectedItems,
            () => {
                if (this.isGameOver) {
                    this.canReturnToTitle = true;
                }
            }
        );

        const currentUser = this.authService.getCurrentUser();
        const playerName = this.inputManager.getPlayerName() || currentUser?.nickname || currentUser?.name || 'PLAYER';
        const discordUserId = (!currentUser || currentUser.is_guest) ? undefined : currentUser.discord_user_id;

        this.scoreRepository.saveProgress({
            high_score: finalScore,
            last_score: finalScore,
            level: this.level,
            max_speed: this.maxSpeed,
            items: { ...this.collectedItems },
            total_games_played: 1,
            user_name: playerName,
            updated_at: new Date().toISOString()
        }, discordUserId);
    }

    private returnToTitle(): void {
        this.assetManager.stopBgm();
        this.reset();
        this.uiManager.showStartScreen();

        if (this.authService.isAuthenticated()) {
            this.uiManager.renderUserBadge(this.authService.getCurrentUser());
            this.uiManager.showStartControls();
        } else {
            this.uiManager.renderUserBadge(null);
            this.uiManager.showAuthGate();
        }

        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }
    }

    public async showRankings(category?: RankingCategory): Promise<void> {
        const currentUser = this.authService.getCurrentUser();
        const discordUserId = (!currentUser || currentUser.is_guest) ? undefined : currentUser.discord_user_id;
        await this.uiManager.showRankings(this.isGameOver, Math.floor(this.score), category, discordUserId);
    }
}

