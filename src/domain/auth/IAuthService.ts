export interface AuthUser {
    discord_user_id: string;
    name: string | null;
    nickname: string | null;
    photo_url: string | null;
    is_ambassador?: boolean;
    is_guest: boolean;
}

export interface IAuthService {
    /**
     * Checks if the user is authenticated either via OAuth account or as a guest.
     */
    isAuthenticated(): boolean;

    /**
     * Checks if the active session is a guest session.
     */
    isGuest(): boolean;

    /**
     * Returns the currently authenticated user profile, or null if unauthenticated.
     */
    getCurrentUser(): AuthUser | null;

    /**
     * Redirects to the OAuth authorization endpoint (IdentityLoginSystem).
     */
    login(): void;

    /**
     * Initiates a guest session.
     */
    loginAsGuest(): void;

    /**
     * Clears the current session and logs out.
     */
    logout(): void;

    /**
     * Inspects the URL fragment for OAuth callback parameters, parses user data,
     * stores the session, and purges the fragment from browser address bar.
     * Returns true if a valid callback was processed.
     */
    handleCallback(): boolean;
}
