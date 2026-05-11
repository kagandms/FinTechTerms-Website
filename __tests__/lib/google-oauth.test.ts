import { buildGoogleOAuthStartPath } from '@/lib/auth/google-oauth';

describe('google oauth start path', () => {
    it('starts Google OAuth through the server route with profile completion as the default target', () => {
        // Arrange
        const expectedPath = '/api/auth/oauth/google?redirectTo=%2Fprofile%3Fcomplete%3D1';

        // Act
        const path = buildGoogleOAuthStartPath();

        // Assert
        expect(path).toBe(expectedPath);
    });

    it('rejects external redirect targets before building the OAuth start path', () => {
        // Arrange
        const externalTarget = 'https://attacker.example/callback';

        // Act
        const path = buildGoogleOAuthStartPath({ redirectTo: externalTarget });

        // Assert
        expect(path).toBe('/api/auth/oauth/google?redirectTo=%2Fprofile%3Fcomplete%3D1');
    });
});
