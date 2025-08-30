import { JWTService } from './index.js';
// Create singleton instances with environment-based configuration
let jwtServiceInstance = null;
let jwtRefreshServiceInstance = null;
export function getJWTService() {
    if (!jwtServiceInstance) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET environment variable is required');
        }
        jwtServiceInstance = new JWTService(secret);
    }
    return jwtServiceInstance;
}
export function getJWTRefreshService() {
    if (!jwtRefreshServiceInstance) {
        const secret = process.env.JWT_REFRESH_SECRET;
        if (!secret) {
            throw new Error('JWT_REFRESH_SECRET environment variable is required');
        }
        jwtRefreshServiceInstance = new JWTService(secret);
    }
    return jwtRefreshServiceInstance;
}
export function getJWTExpiry() {
    return process.env.JWT_EXPIRY || '15m';
}
export function getJWTRefreshExpiry() {
    return process.env.JWT_REFRESH_EXPIRY || '7d';
}
//# sourceMappingURL=service.js.map