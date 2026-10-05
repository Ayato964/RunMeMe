export const MOFFY_API_BASE_URL: string =
    import.meta.env.VITE_MOFFY_API_BASE_URL || 'https://moffy-profile-287701603412.asia-northeast1.run.app';

export const MOFFY_API_KEY: string =
    import.meta.env.VITE_MOFFY_API_KEY || '';

export const AUTH_URL: string =
    import.meta.env.VITE_AUTH_URL || 'https://googleaistudentambassador.github.io/IdentityLogInsystem/oauth.html';

export const GAME_ID = 'run-me-me';

// Legacy fallback
export const API_BASE_URL = MOFFY_API_BASE_URL;

export const LOGICAL_HEIGHT = 800; // 8 blocks * 100px
export const LOGICAL_WIDTH = 1422; // 16:9 aspect ratio (800 * 16 / 9)
