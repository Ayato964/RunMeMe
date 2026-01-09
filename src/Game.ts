import { StageManager } from './StageManager';
import { Player } from './Player';
import { API_BASE_URL, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './config';
import type { GameConfig } from './types';

import MESSAGES from './game_over_messages.json';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private stageManager!: StageManager;
    private player!: Player;
    private lastTime: number = 0;
    private gameLoopId: number | null = null;
    private isGameOver: boolean = false;
    private score: number = 0;
    // private scoreOffset: number = 0; // Removed in favor of direct score manipulation
    private lastScoreDistance: number = 0;
    private maxSpeed: number = 0;

    private collectedItems = {
        onigiri: 0,
        icecream: 0,
        star: 0
    };

    private speedMultiplier: number = 1.0;
    private scrollSpeed: number = 6; // pixels per frame (approx 60fps)

    private canReturnToTitle: boolean = false;

    private backgroundImage!: HTMLImageElement;
    private backgroundScoreImage!: HTMLImageElement;

    private jumpSound!: HTMLAudioElement;
    private itemGetSound!: HTMLAudioElement;
    private gameOverSound!: HTMLAudioElement;

    // Scaling properties
    private scale: number = 1;
    private offsetX: number = 0;
    private offsetY: number = 0;

    private readonly config: GameConfig = {
        gravity: 0.6, // Reasonable gravity
        jumpForce: -15, // Jump force
        baseSpeed: 6, // Base speed
        speedIncreaseRate: 0.1 // Slower speed increase
    };

    private loadingAnimationId: number | null = null;

    // Level & Visuals
    private level: number = 1;
    private levelUpEffect = {
        active: false,
        timer: 0,
        textScale: 1,
        alpha: 1
    };
    private particles: Array<{
        x: number;
        y: number;
        vx: number;
        vy: number;
        life: number;
        color: string;
        size: number;
    }> = [];

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        // Determine if we need to load assets or if this is a hot reload
        // For simplicity, we always assume a load sequence on constructor init
        this.initGame();
    }

    private async initGame() {
        this.startLoadingAnimation();

        // Initialize objects but don't start yet
        this.backgroundImage = new Image();
        this.backgroundImage.src = 'assets/background.png';
        this.backgroundScoreImage = new Image();
        this.backgroundScoreImage.src = 'assets/background_score.png';

        this.jumpSound = new Audio('assets/sound/Jump.wav');
        this.itemGetSound = new Audio('assets/sound/item_get.wav');
        this.gameOverSound = new Audio('assets/sound/gameover.wav');

        this.stageManager = new StageManager(this.config);
        this.player = new Player(this.config, 100, LOGICAL_HEIGHT - 300);

        // Preload Assets
        await this.preloadAssets();

        // Asset Loading Complete
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.setupInputs();

        // Hide Loading Screen
        this.stopLoadingAnimation();
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('opacity-0');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }

        // Show Start Screen (if not test mode)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test') {
            this.start();
        }
    }

    private setupInputs() {
        // Input handling
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (this.isGameOver) {
                    if (this.canReturnToTitle) {
                        this.returnToTitle();
                    }
                } else {
                    const startScreen = document.getElementById('start-screen');
                    if (startScreen && startScreen.style.display !== 'none') {
                        document.getElementById('start-btn')?.click();
                    } else {
                        if (this.player.jump()) {
                            this.jumpSound.currentTime = 0;
                            this.jumpSound.play().catch(() => { });
                        }
                    }
                }
            }
        });

        // Touch handling
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            if (this.isGameOver) {
                this.start();
            } else {
                if (this.player.jump()) {
                    this.jumpSound.currentTime = 0;
                    this.jumpSound.play().catch(() => { });
                }
            }
        }, { passive: false });

        // UI Event Listeners
        const startBtn = document.getElementById('start-btn');
        const nameInput = document.getElementById('player-name-input') as HTMLInputElement;

        const startGame = () => {
            const name = nameInput?.value.trim().toUpperCase();
            if (name === '[STAGEMAKER]') {
                window.location.href = '/stagemaker.html';
                return;
            }

            // Show loading screen for Start Game
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'flex';
                // Trigger reflow
                void loadingScreen.offsetWidth;
                loadingScreen.classList.remove('opacity-0');
                this.startLoadingAnimation();
            }

            // Small delay to let loading screen appear
            setTimeout(() => {
                this.start().then(() => {
                    // Hide loading screen after start is done
                    this.stopLoadingAnimation();
                    if (loadingScreen) {
                        loadingScreen.classList.add('opacity-0');
                        setTimeout(() => {
                            loadingScreen.style.display = 'none';
                        }, 500);
                    }
                });
            }, 500);
        };

        if (startBtn) {
            startBtn.addEventListener('click', startGame);
        }

        if (nameInput) {
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    startGame();
                }
            });
        }

        // Rankings Buttons
        const rankingsBtnStart = document.getElementById('rankings-btn-start');
        if (rankingsBtnStart) {
            rankingsBtnStart.addEventListener('click', () => this.showRankings());
        }
        const rankingsBtnGameOver = document.getElementById('rankings-btn-gameover');
        if (rankingsBtnGameOver) {
            rankingsBtnGameOver.addEventListener('click', () => this.showRankings());
        }

        const closeRankingsBtn = document.getElementById('close-rankings-btn');
        if (closeRankingsBtn) {
            closeRankingsBtn.addEventListener('click', () => {
                const rankingsScreen = document.getElementById('rankings-screen');
                if (rankingsScreen) rankingsScreen.classList.add('hidden');
            });
        }

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.reset());
        }

        const returnTitleBtn = document.getElementById('return-title-btn');
        if (returnTitleBtn) {
            returnTitleBtn.addEventListener('click', () => this.returnToTitle());
        }

        // Mobile Jump Button
        const jumpBtn = document.getElementById('mobile-jump-btn');
        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.isGameOver) {
                    this.start();
                } else {
                    if (this.player.jump()) {
                        this.jumpSound.currentTime = 0;
                        this.jumpSound.play().catch(() => { });
                    }
                }
            }, { passive: false });

            // Also handle click for testing on desktop
            jumpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.isGameOver) {
                    this.start();
                } else {
                    if (this.player.jump()) {
                        this.player.jump(); // Sound played inside jump? No, logic above duplicated.
                        // Correcting logic from original file
                        this.jumpSound.currentTime = 0;
                        this.jumpSound.play().catch(() => { });
                    }
                }
            });
        }
    }

    private startLoadingAnimation() {
        if (this.loadingAnimationId !== null) return;

        let frame = 1;
        const charaImg = document.getElementById('loading-chara') as HTMLImageElement;

        const updateFrame = () => {
            if (charaImg) {
                charaImg.src = frame === 1 ? 'assets/chara_run_1.png' : 'assets/chara_run_2.png';
                frame = frame === 1 ? 2 : 1;
            }
        };

        // Initial update
        updateFrame();
        // Run interval
        this.loadingAnimationId = window.setInterval(updateFrame, 200);
    }

    private stopLoadingAnimation() {
        if (this.loadingAnimationId !== null) {
            clearInterval(this.loadingAnimationId);
            this.loadingAnimationId = null;
        }
    }

    private async preloadAssets(): Promise<void> {
        const images = [
            'assets/background.png',
            'assets/background2.png',
            'assets/background3.png',
            'assets/background4.png',
            'assets/background5.png',
            'assets/background_score.png',
            'assets/chara_run_1.png',
            'assets/chara_run_2.png',
            'assets/chara_stop.png',
            'assets/plant.png',
            'assets/soil.png',
            'assets/stone.png',
            'assets/flower.png',
            'assets/onigiri.png',
            'assets/icecream.png',
            'assets/star.png',
            'assets/thorn.png',
            'assets/title.png'
        ];

        const audio = [
            'assets/sound/Jump.wav',
            'assets/sound/item_get.wav',
            'assets/sound/gameover.wav',
            'assets/sound/stage1.mp3',
            'assets/sound/stage2.mp3',
            'assets/sound/stage3.mp3',
            'assets/sound/stage4.mp3'
        ];

        const loadImage = (src: string) => {
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve(); // Don't block on error
                img.src = src;
            });
        };

        const loadAudio = (src: string) => {
            return new Promise<void>((resolve) => {
                const aud = new Audio();
                aud.oncanplaythrough = () => resolve();
                aud.onerror = () => resolve();
                // Audio might assume user interaction, so simple load might timeout or fail.
                // Just setting src might be enough to trigger cache.
                aud.src = src;
                // Timeout fallback
                setTimeout(resolve, 500);
            });
        };

        const promises = [
            ...images.map(loadImage),
            ...audio.map(loadAudio)
        ];

        // Wait for all, but at least show loading screen for a bit
        await Promise.all([
            Promise.all(promises),
            new Promise(resolve => setTimeout(resolve, 1500)) // Minimum 1.5s loading
        ]);
    }

    private resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Calculate scale to fit 16:9 aspect ratio within the window
        const scaleX = this.canvas.width / LOGICAL_WIDTH;
        const scaleY = this.canvas.height / LOGICAL_HEIGHT;
        this.scale = Math.min(scaleX, scaleY);

        this.offsetX = (this.canvas.width - LOGICAL_WIDTH * this.scale) / 2;
        this.offsetY = (this.canvas.height - LOGICAL_HEIGHT * this.scale) / 2;
    }

    private currentBgm: HTMLAudioElement | null = null;

    public async start() {
        try {
            this.reset();
            this.playRandomBGM();
            if (!this.gameLoopId) {
                this.loop(performance.now());
            }
        } catch (error) {
            console.error("Game start error:", error);
            alert("Failed to start game. Please refresh.");
        }
    }

    private playRandomBGM() {
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm = null;
        }

        const tracks = ['assets/sound/stage1.mp3', 'assets/sound/stage2.mp3', 'assets/sound/stage3.mp3', 'assets/sound/stage4.mp3'];
        const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];

        this.currentBgm = new Audio(randomTrack);
        this.currentBgm.volume = 0.5; // Reasonable volume
        this.currentBgm.play().catch(e => console.error("BGM Play failed:", e));

        this.currentBgm.addEventListener('ended', () => {
            this.playRandomBGM(); // Play next random track
        });
    }

    private reset() {
        console.log("Game Reset called");
        this.canReturnToTitle = false;

        // Stop BGM
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm = null;
        }

        this.isGameOver = false;
        this.score = 0;
        // this.scoreOffset = 0;
        this.lastScoreDistance = 0;
        this.maxSpeed = 1.0;
        this.collectedItems = { onigiri: 0, icecream: 0, star: 0 };
        this.speedMultiplier = 1.0;
        this.timeSinceLastSpeedIncrease = 0;
        this.totalPlayTime = 0;

        this.level = 1;
        this.particles = [];
        this.levelUpEffect.active = false;
        this.stageManager.reset();
        this.player = new Player(this.config, 100, LOGICAL_HEIGHT - 300);

        // Hide rankings
        const rankingsEl = document.getElementById('rankings-screen');
        if (rankingsEl) rankingsEl.classList.add('hidden');

        // Hide start screen
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'none';

        // Hide Game Over screen
        const gameOverScreen = document.getElementById('game-over-screen');
        if (gameOverScreen) gameOverScreen.classList.add('hidden');

        // Show mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'flex';

        this.lastTime = performance.now();

        // Check for Test Mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test') {
            console.log("Game Reset: Test Mode detected");
            const testStageStr = localStorage.getItem('testStage');
            const testSpeedStr = localStorage.getItem('testSpeed');
            console.log("Game Reset: testStage from LS:", testStageStr ? "Found" : "Null");

            if (testStageStr) {
                const testStage = JSON.parse(testStageStr);
                console.log("Game Reset: Setting test stage", testStage);
                this.stageManager.setTestStage(testStage);


                if (testSpeedStr) {
                    this.speedMultiplier = parseFloat(testSpeedStr);
                    this.config.speedIncreaseRate = 0;
                }

                // Show Test Mode UI
                const scoreEl = document.createElement('div');
                scoreEl.className = "absolute top-4 right-4 text-white font-bold text-2xl drop-shadow-md z-50";
                scoreEl.innerText = `TEST MODE - SPEED: ${this.speedMultiplier.toFixed(1)}`;
                document.body.appendChild(scoreEl);
            }
        }

        // Randomize Background
        const bgNum = Math.floor(Math.random() * 5) + 1; // 1 to 5
        const bgPath = bgNum === 1 ? 'assets/background.png' : `assets/background${bgNum}.png`;
        if (this.backgroundImage) {
            this.backgroundImage.src = bgPath;
        }
    }

    private loop(timestamp: number) {
        if (this.isGameOver) return;

        let dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Cap dt to prevent huge jumps (e.g. tab switching)
        if (dt > 50) dt = 50;

        // Update
        this.update(dt);

        // Draw
        this.draw();

        this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
    }

    private timeSinceLastSpeedIncrease: number = 0;
    private totalPlayTime: number = 0;

    private update(dt: number) {
        this.totalPlayTime += dt;

        // Calculate Level (1 to 8, increases every 35 seconds)
        const newLevel = Math.min(8, Math.floor(this.totalPlayTime / 35000) + 1);

        if (newLevel > this.level) {
            this.level = newLevel;
            // Trigger Level Up Effect
            this.levelUpEffect.active = true;
            this.levelUpEffect.timer = 3000;
            this.levelUpEffect.alpha = 1;

            // Spawn Particles
            for (let i = 0; i < 30; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 5;
                this.particles.push({
                    x: LOGICAL_WIDTH / 2,
                    y: LOGICAL_HEIGHT / 2,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1000 + Math.random() * 1500,
                    color: i % 2 === 0 ? '#fbbf24' : '#ffffff', // Yellow and White
                    size: 4 + Math.random() * 6
                });
            }
        }

        // Calculate Interval (10s base, -1s per level)
        // Level 1: 10s, Level 2: 9s, ..., Level 5: 6s
        const speedIncreaseInterval = (10 - (this.level - 1)) * 1000;

        // Increase speed based on dynamic interval
        this.timeSinceLastSpeedIncrease += dt;
        if (this.timeSinceLastSpeedIncrease > speedIncreaseInterval) {
            this.speedMultiplier += this.config.speedIncreaseRate;
            this.timeSinceLastSpeedIncrease = 0;
        }

        // Update Level Up Effect
        if (this.levelUpEffect.active) {
            this.levelUpEffect.timer -= dt;
            if (this.levelUpEffect.timer <= 0) {
                this.levelUpEffect.active = false;
            } else {
                // Flash effect or pulse
                // const progress = this.levelUpEffect.timer / 3000; // Unused
                this.levelUpEffect.alpha = Math.abs(Math.sin(this.levelUpEffect.timer / 100)); // Flash 
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * (dt / 16);
            p.y += p.vy * (dt / 16);
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        this.stageManager.update(dt, this.speedMultiplier, this.scrollSpeed);
        this.player.update(dt, this.speedMultiplier);

        // Collision detection
        const elements = this.stageManager.getElements();
        const playerRect = this.player.getRect();

        // Check for ground collision
        let onGround = false;
        for (const el of elements) {
            if (el.type === 'platform') {
                if (
                    playerRect.x < el.x + el.width &&
                    playerRect.x + playerRect.width > el.x &&
                    playerRect.y + playerRect.height > el.y &&
                    playerRect.y < el.y + el.height
                ) {
                    // Collision
                    // Simple resolution: if falling and above, land
                    // Increased tolerance to 20 to prevent falling through seams
                    if (this.player.velocity.y >= 0 && playerRect.y + playerRect.height - (this.player.velocity.y * (dt / 16)) <= el.y + 20) {
                        this.player.land(el.y);
                        onGround = true;
                    }
                    // Side collision (death)
                    // Only trigger if we are significantly below the top of the platform (not just skimming the edge)
                    // Increased tolerance from 15 to 22 to fix "flat ground death" bug where small offsets caused death
                    else if (playerRect.x + playerRect.width > el.x + 10 && playerRect.y + playerRect.height > el.y + 22) {
                        // Check if it's a head collision (hitting bottom while jumping)
                        // If moving up AND player top is close to platform bottom
                        const isHeadCollision = this.player.velocity.y < 0 && playerRect.y > el.y + el.height - 30;

                        if (isHeadCollision) {
                            // Bonk! Stop upward movement and push out
                            this.player.velocity.y = 0;
                            this.player.position.y = el.y + el.height + this.player.size.height;
                        } else {
                            this.gameOver();
                        }
                    }
                }
            } else if (el.type === 'item') {
                // Check collision with item
                if (
                    playerRect.x < el.x + el.width &&
                    playerRect.x + playerRect.width > el.x &&
                    playerRect.y + playerRect.height > el.y &&
                    playerRect.y < el.y + el.height
                ) {
                    // Item collected
                    if (el.subtype === 'onigiri' || el.subtype === 'icecream' || el.subtype === 'star') {
                        this.collectedItems[el.subtype]++;
                    }

                    if (el.subtype === 'onigiri') {
                        this.speedMultiplier = Math.max(0.5, this.speedMultiplier - 0.5);
                    } else if (el.subtype === 'icecream') {
                        this.score += 500;
                    } else if (el.subtype === 'star') {
                        this.player.addDoubleJump();
                    }

                    this.itemGetSound.currentTime = 0;
                    this.itemGetSound.play().catch(() => { });

                    // Remove item
                    const index = this.stageManager.getElements().indexOf(el);
                    if (index > -1) {
                        this.stageManager.getElements().splice(index, 1);
                    }
                }
            } else if (el.type === 'thorn') {
                // Check collision with thorn
                // Hitbox: 50% width, 50% height, bottom aligned
                const hitWidth = el.width * 0.5;
                const paddingX = (el.width - hitWidth) / 2;
                const hitX = el.x + paddingX;

                const hitHeight = el.height * 0.5;
                const paddingY = el.height - hitHeight;
                const hitY = el.y + paddingY;

                if (
                    playerRect.x < hitX + hitWidth &&
                    playerRect.x + playerRect.width > hitX &&
                    playerRect.y + playerRect.height > hitY &&
                    playerRect.y < hitY + hitHeight
                ) {
                    this.gameOver();
                }
            }
        }

        if (!onGround) {
            this.player.setGrounded(false);
        }

        // Score update (Cumulative based on distance chunks)
        const currentTotalDist = this.stageManager.getTotalDistance();
        // Check how many 100px chunks we've passed since last update
        while (currentTotalDist - this.lastScoreDistance >= 100) {
            this.lastScoreDistance += 100;

            let points = 5;
            // Level 3+ Speed Bonus: Score = Score + 5 + (1 + Speed * 2)
            if (this.level >= 3) {
                points += (1 + this.speedMultiplier * 2);
            }
            this.score += points;
        }

        // Apply any one-time offsets (legacy support for items if needed, though items add directly now?)
        // Actually, we should just add scoreOffset directly to score when item is collected, 
        // but since scoreOffset was a separate variable, we can just merge it.
        // For now, let's keep score purely cumulative and add the offset at display/Game Over time or just merge it here.
        // Easier: Modify item collection to add directly to this.score and remove scoreOffset usage?
        // The original code: this.score = Math.floor(dist/100)*5 + this.scoreOffset;
        // So offset was additive. We can just keep adding to this.score.

        // Track Max Speed
        if (this.speedMultiplier > this.maxSpeed) {
            this.maxSpeed = this.speedMultiplier;
        }

        // Check fall off
        // Game Over when player is no longer visible (top of player matches or exceeds bottom of screen)
        if (this.player.position.y - this.player.size.height > LOGICAL_HEIGHT) {
            this.gameOver();
        }

        // Check Test Clear Condition
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test' && !this.isGameOver) {
            // Check if player passed the stage
            const testStageStr = localStorage.getItem('testStage');
            if (testStageStr) {
                const testStage = JSON.parse(testStageStr);
                const finishDistance = 2400 + testStage.width;

                if (this.stageManager.getTotalDistance() > finishDistance) {
                    this.onTestClear();
                }
            }
        }
    }

    private onTestClear() {
        this.isGameOver = true;
        cancelAnimationFrame(this.gameLoopId!);

        // Stop BGM
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm = null;
        }

        const currentSpeed = parseFloat(localStorage.getItem('testSpeed') || '1.0');
        let nextSpeed = currentSpeed + 1.0;

        if (nextSpeed > 3.0) {
            // All cleared!
            alert("TEST CLEARED! You can now publish this stage.");
            localStorage.setItem('testCompleted', 'true');
            window.location.href = '/stagemaker.html';
        } else {
            alert(`SPEED ${currentSpeed.toFixed(1)} CLEARED! Next: ${nextSpeed.toFixed(1)}`);
            localStorage.setItem('testSpeed', nextSpeed.toFixed(1));
            window.location.reload();
        }
    }

    private draw() {
        // Clear screen with black (for letterboxing)
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        // Apply scaling and centering
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Clip to logical area to prevent drawing outside
        this.ctx.beginPath();
        this.ctx.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        this.ctx.clip();

        // Draw Background
        if (this.backgroundImage.complete) {
            // Draw background to cover the logical area
            this.ctx.drawImage(this.backgroundImage, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        } else {
            this.ctx.fillStyle = '#87CEEB'; // Sky blue fallback
            this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        }

        this.stageManager.draw(this.ctx);
        this.player.draw(this.ctx);

        // Draw HUD
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 30px "Comic Sans MS", "Chalkboard SE", sans-serif';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 6;
        this.ctx.lineJoin = 'round';

        // Score
        const scoreText = `Score: ${Math.floor(this.score)}`;
        this.ctx.strokeText(scoreText, 20, 50);
        this.ctx.fillText(scoreText, 20, 50);

        // Speed & Level (Below Score)
        const statsText = `Speed: ${this.speedMultiplier.toFixed(2)}x   Lv.${this.level}`;
        this.ctx.font = 'bold 24px "Comic Sans MS", "Chalkboard SE", sans-serif';
        this.ctx.strokeText(statsText, 20, 85);
        this.ctx.fillText(statsText, 20, 85);

        // Double Jump Count
        if (this.player.doubleJumpCount > 0) {
            this.ctx.fillStyle = '#f6e05e'; // Yellow-400
            this.ctx.font = 'bold 24px "Comic Sans MS", sans-serif';
            this.ctx.strokeText(`Double Jumps: ${this.player.doubleJumpCount}`, 20, 115);
            this.ctx.fillText(`Double Jumps: ${this.player.doubleJumpCount}`, 20, 115);
        }

        // Particles
        for (const p of this.particles) {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Level Up Overlay
        if (this.levelUpEffect.active) {
            this.ctx.save();
            this.ctx.globalAlpha = this.levelUpEffect.alpha;
            this.ctx.textAlign = 'center';
            this.ctx.lineWidth = 8;
            this.ctx.lineJoin = 'round';

            const startY = LOGICAL_HEIGHT / 2 - 20;

            // Level Text
            this.ctx.font = '900 60px "Comic Sans MS", sans-serif';
            this.ctx.strokeStyle = 'black';
            this.ctx.fillStyle = 'white';
            const lvText = `LV.${this.level}`;
            this.ctx.strokeText(lvText, LOGICAL_WIDTH / 2, startY);
            this.ctx.fillText(lvText, LOGICAL_WIDTH / 2, startY);

            // Speed Up Text
            this.ctx.fillStyle = '#fbbf24'; // Yellow
            const spText = 'SPEED UP!!!';
            this.ctx.strokeText(spText, LOGICAL_WIDTH / 2, startY + 70);
            this.ctx.fillText(spText, LOGICAL_WIDTH / 2, startY + 70);

            this.ctx.restore();
        }

        this.ctx.restore();
    }

    private gameOver() {
        this.isGameOver = true;
        this.canReturnToTitle = false;

        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
        }

        // Stop BGM
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm = null;
        }

        this.gameOverSound.currentTime = 0;
        this.gameOverSound.play().catch(() => { });

        // Check Test Mode Failure
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'test') {
            alert("TEST FAILED! Returning to editor...");
            window.location.href = '/stagemaker.html';
            return;
        }

        // Hide mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'none';

        // Prepare Score Screen
        const gameOverScreen = document.getElementById('game-over-screen');
        const finalScoreEl = document.getElementById('final-score');
        const returnBtn = document.getElementById('return-title-btn');

        if (gameOverScreen && finalScoreEl) {
            // Calculate Scores
            const baseScore = Math.floor(this.score);
            const stars = this.player.doubleJumpCount;
            const starBonus = stars * 200;
            const finalScore = baseScore + starBonus;

            // Random Message
            const randomMsg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
            const msgEl = document.getElementById('game-over-message');
            if (msgEl) msgEl.innerText = randomMsg;

            // DOM Updates
            finalScoreEl.innerText = finalScore.toString();

            const baseScoreEl = document.getElementById('base-score');
            if (baseScoreEl) baseScoreEl.innerText = baseScore.toString();

            const levelEl = document.getElementById('result-level');
            if (levelEl) levelEl.innerText = this.level.toString();

            const maxSpeedEl = document.getElementById('result-max-speed');
            if (maxSpeedEl) maxSpeedEl.innerText = this.maxSpeed.toFixed(2) + 'x';

            // Detailed Items
            const onigiriEl = document.getElementById('count-onigiri');
            if (onigiriEl) onigiriEl.innerText = this.collectedItems.onigiri.toString();

            const icecreamEl = document.getElementById('count-icecream');
            if (icecreamEl) icecreamEl.innerText = this.collectedItems.icecream.toString();

            const starEl = document.getElementById('count-star');
            if (starEl) starEl.innerText = this.collectedItems.star.toString();

            const starCountEl = document.getElementById('star-count');
            if (starCountEl) starCountEl.innerText = stars.toString();

            const starBonusEl = document.getElementById('star-bonus');
            if (starBonusEl) starBonusEl.innerText = '+' + starBonus.toString();

            gameOverScreen.classList.remove('hidden');

            // Hide return button initially
            if (returnBtn) returnBtn.classList.add('hidden');

            // Override this.score with final score so rankings use it or submission uses it
            // Actually, best to keep this.score as base and just submit final
            this.submitScore(finalScore);
        }

        // 3 Seconds Delay before showing Title button
        setTimeout(() => {
            if (this.isGameOver) {
                this.canReturnToTitle = true;
                if (returnBtn) {
                    returnBtn.classList.remove('hidden');
                    returnBtn.classList.add('animate-bounce'); // Add visual cue
                }
            }
        }, 3000);
    }

    private submitScore(score: number) {
        // Get player name from input (entered at start)
        const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
        const playerName = nameInput?.value || "Player";

        fetch(`${API_BASE_URL}/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                score: score,
                name: playerName,
                max_speed: this.maxSpeed,
                level: this.level,
                items: this.collectedItems
            })
        }).catch(err => console.error("Failed to submit score:", err));
    }

    private returnToTitle() {
        this.reset();

        // Show start screen (Must be after reset() as reset() hides it)
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'flex'; // Restore flex display

        // Also ensure Rankings are hidden (reset does this)

        // Ensure Title Button is reset/hidden
        const returnBtn = document.getElementById('return-title-btn');
        if (returnBtn) {
            returnBtn.classList.add('hidden');
            returnBtn.classList.remove('animate-bounce');
        }

        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }
    }

    public async showRankings(isGameOver: boolean = false, score?: number) {
        const rankingsEl = document.getElementById('rankings-screen');
        const rankingsList = document.getElementById('rankings-list');

        if (rankingsEl && rankingsList) {
            rankingsList.innerHTML = '<div class="text-4xl font-black text-white animate-pulse">LOADING...</div>';
            rankingsEl.classList.remove('hidden');

            // Add Game Over title if applicable
            if (isGameOver) {
                const title = document.createElement('h2');
                title.className = "text-6xl font-black text-red-500 mb-4 drop-shadow-[4px_4px_0_#000] transform -rotate-3";
                title.innerText = "GAME OVER";
                rankingsList.innerHTML = '';
                rankingsList.appendChild(title);

                const scoreDisplay = document.createElement('div');
                scoreDisplay.className = "text-4xl font-bold text-white mb-8 drop-shadow-[2px_2px_0_#000]";
                scoreDisplay.innerText = `SCORE: ${score !== undefined ? score : Math.floor(this.score)}`;
                rankingsList.appendChild(scoreDisplay);
            } else {
                rankingsList.innerHTML = '<h2 class="text-6xl font-black text-yellow-400 mb-8 drop-shadow-[4px_4px_0_#000] transform -rotate-3">RANKING</h2>';
            }

            try {
                const res = await fetch(`${API_BASE_URL}/scores`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                const scores = await res.json();

                const listContainer = document.createElement('div');
                listContainer.className = "w-full max-w-2xl bg-white/90 border-4 border-black rounded-xl p-6 shadow-[8px_8px_0_#000] transform rotate-1";

                listContainer.innerHTML = scores.map((s: any, i: number) => `
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

                rankingsList.appendChild(listContainer);

            } catch (err) {
                rankingsList.innerHTML += '<div class="text-2xl text-red-500 font-bold mt-4">Failed to load rankings.</div>';
            }
        }
    }

    // Helper to restore rankings view if closed
    public displayRankings() {
        this.showRankings();
    }
}
