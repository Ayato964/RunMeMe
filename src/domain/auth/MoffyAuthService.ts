import type { AuthUser, IAuthService } from './IAuthService';
import { AUTH_URL } from '../../config';

const STORAGE_SESSION_KEY = 'runmeme_auth_session';
const STORAGE_CSRF_KEY = 'runmeme_oauth_csrf_state';

interface StoredSession {
    token: string;
    user: AuthUser;
    expiresAt?: number;
    savedAt: string;
}

export class MoffyAuthService implements IAuthService {
    private inMemoryUser: AuthUser | null = null;
    private inMemoryToken: string | null = null;

    constructor() {
        this.loadSessionFromStorage();
    }

    private loadSessionFromStorage(): void {
        try {
            const raw = localStorage.getItem(STORAGE_SESSION_KEY);
            if (!raw) return;

            const session: StoredSession = JSON.parse(raw);
            if (session && session.user) {
                // If token has expiry, verify it
                if (session.expiresAt && Date.now() >= session.expiresAt) {
                    console.warn('[MoffyAuthService] Session expired, purging.');
                    this.logout();
                    return;
                }
                this.inMemoryUser = session.user;
                this.inMemoryToken = session.token;
            }
        } catch (e) {
            console.warn('[MoffyAuthService] Failed to parse stored session:', e);
            this.logout();
        }
    }

    public isAuthenticated(): boolean {
        return this.inMemoryUser !== null;
    }

    public isGuest(): boolean {
        return this.inMemoryUser !== null && this.inMemoryUser.is_guest;
    }

    public getCurrentUser(): AuthUser | null {
        return this.inMemoryUser;
    }

    public getToken(): string | null {
        return this.inMemoryToken;
    }

    public login(): void {
        if (typeof window === 'undefined') return;

        // Generate cryptographically secure state for CSRF protection
        const state = this.generateRandomState(32);
        try {
            sessionStorage.setItem(STORAGE_CSRF_KEY, state);
        } catch (e) {
            console.warn('Failed to save CSRF state to sessionStorage:', e);
        }

        const redirectUri = window.location.href.split('#')[0];
        const authEndpoint = new URL(AUTH_URL, window.location.href);

        authEndpoint.searchParams.set('client_id', 'run-me-me');
        authEndpoint.searchParams.set('redirect_uri', redirectUri);
        authEndpoint.searchParams.set('response_type', 'token');
        authEndpoint.searchParams.set('state', state);
        authEndpoint.searchParams.set('scope', 'profile');

        window.location.href = authEndpoint.toString();
    }

    public loginAsGuest(): void {
        const guestUser: AuthUser = {
            discord_user_id: 'guest_' + Math.random().toString(36).substring(2, 9),
            name: 'Guest Player',
            nickname: 'Guest',
            photo_url: null,
            is_ambassador: false,
            is_guest: true
        };

        const session: StoredSession = {
            token: 'guest_token',
            user: guestUser,
            savedAt: new Date().toISOString()
        };

        this.inMemoryUser = guestUser;
        this.inMemoryToken = session.token;

        try {
            localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
        } catch (e) {
            console.warn('Failed to save guest session to localStorage:', e);
        }
    }

    public logout(): void {
        this.inMemoryUser = null;
        this.inMemoryToken = null;
        try {
            localStorage.removeItem(STORAGE_SESSION_KEY);
            sessionStorage.removeItem(STORAGE_CSRF_KEY);
        } catch {
            // Ignore storage errors
        }
    }

    public handleCallback(): boolean {
        if (typeof window === 'undefined') return false;

        const hash = window.location.hash.substring(1);
        if (!hash || !hash.includes('access_token')) {
            return false;
        }

        // Clean browser address bar immediately to prevent token and profile leakage
        try {
            const cleanUrl = window.location.pathname + window.location.search;
            window.history.replaceState(null, '', cleanUrl);
        } catch {
            // ignore
        }

        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const state = params.get('state');

        if (!accessToken) {
            return false;
        }

        // Verify CSRF state
        let savedState: string | null = null;
        try {
            savedState = sessionStorage.getItem(STORAGE_CSRF_KEY);
            sessionStorage.removeItem(STORAGE_CSRF_KEY);
        } catch {
            // ignore
        }

        if (!savedState || !state || savedState !== state) {
            console.error('[MoffyAuthService] CSRF state mismatch or missing state. Aborting authentication.');
            return false;
        }

        const discordUserId = params.get('discord_user_id');
        if (!discordUserId) {
            console.error('[MoffyAuthService] No discord_user_id found in auth callback fragment.');
            return false;
        }

        const rawName = params.get('nickname') || params.get('name') || discordUserId;
        const photoUrl = params.get('photo_url') || params.get('default_photo_url') || null;
        const isAmbassador = params.get('is_ambassador') === 'true';

        const user: AuthUser = {
            discord_user_id: discordUserId,
            name: params.get('name') || discordUserId,
            nickname: params.get('nickname') || rawName,
            photo_url: photoUrl,
            is_ambassador: isAmbassador,
            is_guest: false
        };

        const session: StoredSession = {
            token: accessToken,
            user,
            savedAt: new Date().toISOString()
        };

        this.inMemoryUser = user;
        this.inMemoryToken = accessToken;

        try {
            localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
        } catch (e) {
            console.warn('[MoffyAuthService] Failed to persist session to localStorage:', e);
        }

        return true;
    }

    private generateRandomState(length: number = 32): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[array[i] % chars.length];
        }
        return result;
    }
}
