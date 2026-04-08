export const getSupabaseServerCookieOptions = () => ({
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
});
