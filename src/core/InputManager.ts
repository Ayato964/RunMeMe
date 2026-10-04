export interface InputCallbacks {
    onJump: () => void;
    onStartGame: (playerName: string) => void;
    onReturnToTitle: () => void;
    onShowRankings: () => void;
    onCloseRankings: () => void;
}

export class InputManager {
    private canvas: HTMLCanvasElement;
    private callbacks: InputCallbacks;
    private isGameOverState: () => boolean;
    private canReturnToTitleState: () => boolean;
    private isStartScreenActive: () => boolean;

    constructor(
        canvas: HTMLCanvasElement,
        callbacks: InputCallbacks,
        isGameOverState: () => boolean,
        canReturnToTitleState: () => boolean,
        isStartScreenActive: () => boolean
    ) {
        this.canvas = canvas;
        this.callbacks = callbacks;
        this.isGameOverState = isGameOverState;
        this.canReturnToTitleState = canReturnToTitleState;
        this.isStartScreenActive = isStartScreenActive;

        this.setupKeyboard();
        this.setupTouch();
        this.setupButtons();
    }

    private setupKeyboard(): void {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                const target = e.target as HTMLElement | null;
                // Never intercept space when user is typing in an input field
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                    return;
                }

                e.preventDefault();
                if (this.isGameOverState()) {
                    if (this.canReturnToTitleState()) {
                        this.callbacks.onReturnToTitle();
                    }
                } else if (this.isStartScreenActive()) {
                    const name = this.getPlayerName();
                    if (name === '[STAGEMAKER]') {
                        window.location.href = '/stagemaker.html';
                        return;
                    }
                    this.callbacks.onStartGame(name);
                } else {
                    this.callbacks.onJump();
                }
            }
        });
    }

    private setupTouch(): void {
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.isGameOverState()) {
                if (this.canReturnToTitleState()) {
                    this.callbacks.onReturnToTitle();
                }
            } else if (!this.isStartScreenActive()) {
                this.callbacks.onJump();
            }
        }, { passive: false });

        const jumpBtn = document.getElementById('mobile-jump-btn');
        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!this.isGameOverState()) {
                    this.callbacks.onJump();
                }
            }, { passive: false });

            jumpBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.isGameOverState()) {
                    this.callbacks.onJump();
                }
            });
        }
    }

    private setupButtons(): void {
        const startBtn = document.getElementById('start-btn');
        const nameInput = document.getElementById('player-name-input') as HTMLInputElement;

        const handleStart = () => {
            const name = this.getPlayerName();
            if (name === '[STAGEMAKER]') {
                window.location.href = '/stagemaker.html';
                return;
            }
            this.callbacks.onStartGame(name);
        };

        startBtn?.addEventListener('click', handleStart);
        nameInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleStart();
        });

        document.getElementById('rankings-btn-start')?.addEventListener('click', () => {
            this.callbacks.onShowRankings();
        });

        document.getElementById('rankings-btn-gameover')?.addEventListener('click', () => {
            this.callbacks.onShowRankings();
        });

        document.getElementById('close-rankings-btn')?.addEventListener('click', () => {
            this.callbacks.onCloseRankings();
        });

        document.getElementById('return-title-btn')?.addEventListener('click', () => {
            this.callbacks.onReturnToTitle();
        });
    }

    public getPlayerName(): string {
        const input = document.getElementById('player-name-input') as HTMLInputElement | null;
        return (input?.value.trim().toUpperCase()) || 'PLAYER';
    }
}
