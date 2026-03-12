import '@testing-library/jest-dom'

jest.mock('@sentry/nextjs', () => ({
    init: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    captureRequestError: jest.fn(),
    captureRouterTransitionStart: jest.fn(),
    withScope: (callback) => callback({
        setLevel: jest.fn(),
        setTag: jest.fn(),
        setUser: jest.fn(),
        setExtra: jest.fn(),
    }),
}))
