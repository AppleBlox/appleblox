/** Detects if the app is ran in dev mode or production */
export function getMode(): "dev" | "prod" {
    return import.meta.env.MODE === 'development' ? 'dev' : 'prod'
}