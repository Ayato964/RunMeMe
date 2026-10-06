export interface InputCallbacks {
    onJump: () => void;
    onStartGame: (playerName: string) => void;
    onReturnToTitle: () => void;
    onShowRankings: () => void;
    onCloseRankings: () => void;
    onShowTutorial?: () => void;
    onCloseTutorial?: () => void;
    onLinkAccount?: () => void;
    onGuestLogin?: () => void;
    onLogout?: () => void;
}

export class InputManager {
    private canvas: HTMLCanvasElement;
    private callbacks: InputCallbacks;
    private isGameOverState: () => boolean;
    private canReturnToTitleState: () => boolean;
    private isStartScreenActive: () => boolean;
    private isAuthGateActive?: () => boolean;
    private isModalActive?: () => boolean;

    constructor(
        canvas: HTMLCanvasElement,
        callbacks: InputCallbacks,
        isGameOverState: () => boolean,
        canReturnToTitleState: () => boolean,
        isStartScreenActive: () => boolean,
        isAuthGateActive?: () => boolean,
        isModalActive?: () => boolean
    ) {
        this.canvas = canvas;
        this.callbacks = callbacks;
        this.isGameOverState = isGameOverState;
        this.canReturnToTitleState = canReturnToTitleState;
        this.isStartScreenActive = isStartScreenActive;
        this.isAuthGateActive = isAuthGateActive;
        this.isModalActive = isModalActive;

        this.setupKeyboard();
        this.setupTouch();
        this.setupButtons();
    }

    private setupKeyboard(): void {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.callbacks.onCloseTutorial?.();
                this.callbacks.onCloseRankings();
                return;
            }

            if (e.code === 'Space') {
                const target = e.target as HTMLElement | null;
                // Never intercept space when user is typing in an input field
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                    return;
                }

                // Never intercept space or start game if a modal (tutorial or rankings) is open!
                if (this.isModalActive && this.isModalActive()) {
                    return;
                }

                e.preventDefault();
                if (this.isGameOverState()) {
                    if (this.canReturnToTitleState()) {
                        this.callbacks.onReturnToTitle();
                    }
                } else if (this.isStartScreenActive()) {
                    // Do not auto-start game if auth gate is still active
                    if (this.isAuthGateActive && this.isAuthGateActive()) {
                        return;
                    }

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
        const jumpBtn = document.getElementById('mobile-jump-btn');
        if (jumpBtn) {
            jumpBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.callbacks.onJump();
            }, { passive: false });
        }

        // Tap on canvas for mobile jump during gameplay
        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.isGameOverState() && !this.isStartScreenActive()) {
                e.preventDefault();
                this.callbacks.onJump();
            }
        }, { passive: false });
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

        document.getElementById('link-account-btn')?.addEventListener('click', () => {
            this.callbacks.onLinkAccount?.();
        });

        document.getElementById('guest-login-btn')?.addEventListener('click', () => {
            this.callbacks.onGuestLogin?.();
        });

        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.callbacks.onLogout?.();
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

        // Tutorial modal buttons
        document.getElementById('tutorial-btn')?.addEventListener('click', () => {
            this.callbacks.onShowTutorial?.();
        });

        document.getElementById('close-tutorial-x-btn')?.addEventListener('click', () => {
            this.callbacks.onCloseTutorial?.();
        });

        document.getElementById('close-tutorial-bottom-btn')?.addEventListener('click', () => {
            this.callbacks.onCloseTutorial?.();
        });
    }

    public getPlayerName(): string {
        const input = document.getElementById('player-name-input') as HTMLInputElement | null;
        return (input?.value.trim().toUpperCase()) || 'PLAYER';
    }
}

