export function getMode(): "dev" | "prod" {
    return import.meta.env.MODE === 'development' ? 'dev' : 'prod'
}