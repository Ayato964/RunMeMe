export interface IAssetManager {
    preloadAll(): Promise<void>;
    getImage(path: string): HTMLImageElement;
    playSfx(path: string): void;
    playRandomBgm(): void;
    stopBgm(): void;
}

export class AssetManager implements IAssetManager {
    private images: Map<string, HTMLImageElement> = new Map();
    private audioCache: Map<string, HTMLAudioElement> = new Map();
    private currentBgm: HTMLAudioElement | null = null;
    private bgmTracks: string[] = [
        'assets/sound/stage1.mp3',
        'assets/sound/stage2.mp3',
        'assets/sound/stage3.mp3',
        'assets/sound/stage4.mp3'
    ];

    private static readonly IMAGE_PATHS = [
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

    private static readonly AUDIO_PATHS = [
        'assets/sound/Jump.wav',
        'assets/sound/item_get.wav',
        'assets/sound/gameover.wav',
        'assets/sound/stage1.mp3',
        'assets/sound/stage2.mp3',
        'assets/sound/stage3.mp3',
        'assets/sound/stage4.mp3'
    ];

    public getImage(path: string): HTMLImageElement {
        let img = this.images.get(path);
        if (!img) {
            img = new Image();
            img.src = path;
            this.images.set(path, img);
        }
        return img;
    }

    public getAudio(path: string): HTMLAudioElement {
        let audio = this.audioCache.get(path);
        if (!audio) {
            audio = new Audio(path);
            this.audioCache.set(path, audio);
        }
        return audio;
    }

    public playSfx(path: string): void {
        const audio = this.getAudio(path);
        audio.currentTime = 0;
        audio.play().catch(() => {
            // Browser autoplay policy might block if no interaction yet
        });
    }

    public playRandomBgm(): void {
        this.stopBgm();

        const randomTrack = this.bgmTracks[Math.floor(Math.random() * this.bgmTracks.length)];
        const bgm = new Audio(randomTrack);
        bgm.volume = 0.5;

        bgm.addEventListener('ended', () => {
            this.playRandomBgm();
        });

        bgm.play().catch(e => {
            console.warn("BGM autoplay prevented or failed:", e);
        });

        this.currentBgm = bgm;
    }

    public stopBgm(): void {
        if (this.currentBgm) {
            this.currentBgm.pause();
            this.currentBgm.currentTime = 0;
            this.currentBgm = null;
        }
    }

    public async preloadAll(): Promise<void> {
        const imagePromises = AssetManager.IMAGE_PATHS.map(src => {
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images.set(src, img);
                    resolve();
                };
                img.onerror = () => {
                    this.images.set(src, img);
                    resolve();
                };
                img.src = src;
            });
        });

        const audioPromises = AssetManager.AUDIO_PATHS.map(src => {
            return new Promise<void>((resolve) => {
                const aud = new Audio();
                aud.oncanplaythrough = () => {
                    this.audioCache.set(src, aud);
                    resolve();
                };
                aud.onerror = () => {
                    this.audioCache.set(src, aud);
                    resolve();
                };
                aud.src = src;
                setTimeout(resolve, 500); // Fail-safe timeout
            });
        });

        await Promise.all([
            Promise.all(imagePromises),
            Promise.all(audioPromises),
            new Promise(resolve => setTimeout(resolve, 1000)) // Min loading presentation
        ]);
    }
}
