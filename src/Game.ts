import type { GameConfig } from './types';
import { Player } from './Player';
import { StageManager } from './StageManager';
import { API_BASE_URL } from './config';

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private lastTime: number = 0;
    private isPlaying: boolean = false;
    private score: number = 0;
    private speedMultiplier: number = 1.0;

    private player: Player;
    private stageManager: StageManager;

    private config: GameConfig = {
        gravity: 0.5,
        jumpForce: -13,
        baseSpeed: 5,
        speedIncreaseRate: 0.001
    };

    private bgImage: HTMLImageElement;
    private scoreBgImage: HTMLImageElement;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.bgImage = new Image();
        this.bgImage.src = 'assets/background.png';

        this.scoreBgImage = new Image();
        this.scoreBgImage.src = 'assets/background_score.png';

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.player = new Player(this.config, 100, 300);
        this.stageManager = new StageManager(this.config);

        this.setupInputs();
    }

    private resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    private setupInputs() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (!this.isPlaying) {
                    // Start game handled by button
                } else {
                    this.player.jump();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && this.isPlaying) {
                this.player.stopJump();
            }
        });

        // Mobile Jump Support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling
            if (this.isPlaying) {
                this.player.jump();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.isPlaying) {
                this.player.stopJump();
            }
        }, { passive: false });

        const startBtn = document.getElementById('start-btn');
        startBtn?.addEventListener('click', () => this.start());

        const restartBtn = document.getElementById('restart-btn');
        restartBtn?.addEventListener('click', () => this.reset());

        const rankingsBtn = document.getElementById('rankings-btn');
        rankingsBtn?.addEventListener('click', () => this.showRankings());

        const closeRankingsBtn = document.getElementById('close-rankings-btn');
        closeRankingsBtn?.addEventListener('click', () => {
            document.getElementById('rankings-screen')?.classList.add('hidden');
        });

        const jumpBtn = document.getElementById('mobile-jump-btn');
        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.isPlaying) this.player.jump();
            });
            jumpBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (this.isPlaying) this.player.stopJump();
            });
        }
    }

    public start() {
        try {
            this.isPlaying = true;
            this.score = 0;
            this.speedMultiplier = 1.0;
            this.lastTime = performance.now();

            this.player = new Player(this.config, 100, 300);
            this.stageManager.reset();

            document.getElementById('start-screen')?.classList.add('hidden');
            document.getElementById('game-over-screen')?.classList.add('hidden');
            document.getElementById('mobile-controls')?.classList.remove('hidden');

            requestAnimationFrame((t) => this.loop(t));
        } catch (e) {
            console.error("Failed to start game:", e);
            alert("Failed to start game. Please try refreshing the page.");
            document.getElementById('start-screen')?.classList.remove('hidden');
        }
    }

    public reset() {
        this.start();
    }

    private loop(timestamp: number) {
        if (!this.isPlaying) return;

        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    private update(dt: number) {
        // Level-based speed: +0.1 every 1000 score
        this.speedMultiplier = 1.0 + Math.floor(this.score / 1000) * 0.1;

        // Update score
        this.score += (this.config.baseSpeed * this.speedMultiplier) * (dt / 16);

        // Update entities
        this.stageManager.update(dt, this.speedMultiplier, this.config.baseSpeed);
        this.player.update(dt, this.speedMultiplier);

        // Collision Detection
        this.checkCollisions();

        // Check Game Over
        if (this.player.position.y > this.canvas.height) {
            this.gameOver();
        }

        // Update UI
        this.updateUI();
    }

    private checkCollisions() {
        const playerRect = {
            x: this.player.position.x,
            y: this.player.position.y - this.player.size.height,
            width: this.player.size.width,
            height: this.player.size.height
        };

        const elements = this.stageManager.getElements();
        let onGround = false;

        for (const el of elements) {
            if (el.type === 'platform') {
                // Simple AABB collision
                if (
                    playerRect.x < el.x + el.width &&
                    playerRect.x + playerRect.width > el.x &&
                    playerRect.y < el.y + el.height &&
                    playerRect.y + playerRect.height > el.y
                ) {
                    // Collision detected
                    // Determine side
                    const overlapX = Math.min(playerRect.x + playerRect.width - el.x, el.x + el.width - playerRect.x);
                    const overlapY = Math.min(playerRect.y + playerRect.height - el.y, el.y + el.height - playerRect.y);

                    // Check if landing on top
                    // We are on top if our previous bottom was above the platform's top (with tolerance)
                    // AND we are falling or stationary
                    const wasAbove = playerRect.y + playerRect.height - this.player.velocity.y <= el.y + 20;

                    if (wasAbove && this.player.velocity.y >= 0) {
                        // Landing on top
                        this.player.position.y = el.y;
                        this.player.velocity.y = 0;
                        this.player.isGrounded = true;
                        onGround = true;
                    } else {
                        // Not landing on top
                        if (overlapY < overlapX) {
                            // Vertical collision (hitting head)
                            if (this.player.velocity.y < 0) {
                                this.player.position.y = el.y + el.height + this.player.size.height;
                                this.player.velocity.y = 0;
                            }
                        } else {
                            // Horizontal collision (Game Over)
                            this.gameOver();
                        }
                    }
                }
            }
        }

        if (!onGround) {
            this.player.isGrounded = false;
        }
    }

    private async gameOver() {
        this.isPlaying = false;
        document.getElementById('game-over-screen')?.classList.remove('hidden');
        document.getElementById('mobile-controls')?.classList.add('hidden');
        const finalScoreEl = document.getElementById('final-score');
        const finalScore = Math.floor(this.score);
        if (finalScoreEl) finalScoreEl.textContent = finalScore.toString();

        // Get player name from input (to be added)
        const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
        const playerName = nameInput?.value || "Player";

        // Submit score
        try {
            await fetch(`${API_BASE_URL}/scores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ score: finalScore, name: playerName })
            });

            // Fetch rankings
            const res = await fetch(`${API_BASE_URL}/scores`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const rankings = await res.json();
            this.displayRankings(rankings);
        } catch (e) {
            console.error("Failed to submit score or fetch rankings", e);
        }
    }

    private displayRankings(rankings: { name: string, score: number }[]) {
        // Create or update ranking list in DOM
        let rankingContainer = document.getElementById('ranking-container');
        if (!rankingContainer) {
            const gameOverScreen = document.getElementById('game-over-screen');
            const innerContainer = gameOverScreen?.firstElementChild; // The text-center div

            if (innerContainer) {
                rankingContainer = document.createElement('div');
                rankingContainer.id = 'ranking-container';
                rankingContainer.className = 'mt-4 text-left p-6 rounded-xl inline-block relative overflow-hidden border-4 border-yellow-400 shadow-lg';
                // Add background image via style
                rankingContainer.style.backgroundImage = "url('assets/background_score.png')";
                rankingContainer.style.backgroundSize = "cover";
                rankingContainer.style.backgroundPosition = "center";

                innerContainer.appendChild(rankingContainer);
            }
        }

        if (rankingContainer) {
            rankingContainer.innerHTML = `
                <h3 class="text-2xl font-black mb-4 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] text-center uppercase tracking-wider" style="font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif;">🏆 Top Scores 🏆</h3>
                <ol class="list-decimal list-inside space-y-2 text-white font-bold text-lg drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                    ${rankings.map(r => `<li>${r.name}: <span class="text-yellow-300">${r.score}</span></li>`).join('')}
                </ol>
            `;
        }
    }

    private async showRankings() {
        const screen = document.getElementById('rankings-screen');
        const list = document.getElementById('rankings-list');
        if (screen && list) {
            screen.classList.remove('hidden');
            list.innerHTML = '<p class="text-white text-4xl font-black animate-pulse">LOADING...</p>';

            try {
                const res = await fetch(`${API_BASE_URL}/scores`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                const rankings = await res.json();

                if (rankings.length === 0) {
                    list.innerHTML = '<p class="text-white text-4xl font-black">NO SCORES YET!</p>';
                    return;
                }

                list.innerHTML = '';

                const title = document.createElement('h2');
                title.className = "text-6xl md:text-8xl font-black text-yellow-400 mb-12 drop-shadow-[4px_4px_0_#000] -skew-x-6 tracking-widest";
                title.textContent = "TOP RANKINGS";
                list.appendChild(title);

                const ol = document.createElement('ol');
                ol.className = 'space-y-6 w-full max-w-2xl mx-auto';
                rankings.forEach((r: any, i: number) => {
                    const li = document.createElement('li');
                    // Anime style list items
                    const rankColor = i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-white';
                    const bgClass = i < 3 ? 'bg-black/40' : 'bg-black/20';

                    li.className = `flex items-center justify-between p-4 rounded-xl border-b-4 border-black ${bgClass} backdrop-blur-sm transform hover:scale-105 transition-transform`;
                    li.innerHTML = `
                        <div class="flex items-center gap-4">
                            <span class="text-4xl font-black ${rankColor} w-16 text-left">#${i + 1}</span>
                            <span class="text-3xl font-bold text-white uppercase tracking-wider drop-shadow-md">${r.name}</span>
                        </div>
                        <span class="text-4xl font-black text-pink-400 font-mono drop-shadow-[2px_2px_0_#000]">${r.score}</span>
                    `;
                    ol.appendChild(li);
                });
                list.appendChild(ol);
            } catch (e) {
                list.innerHTML = '<p class="text-red-500 text-4xl font-black">FAILED TO LOAD!</p>';
            }
        }
    }

    private draw() {
        // Clear screen
        if (this.bgImage.complete) {
            // Draw background covering the canvas
            // Calculate scale to cover
            const scale = Math.max(this.canvas.width / this.bgImage.width, this.canvas.height / this.bgImage.height);
            const w = this.bgImage.width * scale;
            const h = this.bgImage.height * scale;
            const x = (this.canvas.width - w) / 2;
            const y = (this.canvas.height - h) / 2;

            this.ctx.drawImage(this.bgImage, x, y, w, h);
        } else {
            this.ctx.fillStyle = '#1a202c'; // Gray-900
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Draw entities
        this.stageManager.draw(this.ctx);
        this.player.draw(this.ctx);
    }

    private updateUI() {
        const scoreEl = document.getElementById('score-display');
        if (scoreEl) scoreEl.textContent = Math.floor(this.score).toString().padStart(6, '0');

        const speedEl = document.getElementById('speed-display');
        if (speedEl) speedEl.textContent = this.speedMultiplier.toFixed(1) + 'x';
    }
}
