// load contents of .env into process.env
require('dotenv').config();

/**
 * Configuration object for IBM Verify integration and ITR filing demo
 * All VERIFY_* variables correspond to IBM Security Verify settings
 * See .env.example for detailed documentation
 */
exports.Config = {
    // OIDC Configuration - Required for authentication
    verifyTenantUrl    : process.env.VERIFY_TENANT_URL,
    verifyDiscoveryUrl : process.env.VERIFY_DISCOVERY_URL,
    verifyOidcClientId     : process.env.VERIFY_OIDC_CLIENT_ID,
    verifyOidcClientSecret : process.env.VERIFY_OIDC_CLIENT_SECRET,
    verifyOidcRedirectUri  : process.env.VERIFY_OIDC_REDIRECT_URI,
    verifyOidcScope        : process.env.VERIFY_OIDC_SCOPE,
    
    // API Configuration - Required for Users and Privacy APIs
    verifyApiClientId     : process.env.VERIFY_API_CLIENT_ID,
    verifyApiClientSecret : process.env.VERIFY_API_CLIENT_SECRET,
    
    // Privacy API Configuration
    verifyPrivacyBaseUrl : process.env.VERIFY_PRIVACY_BASE_URL,
    
    // Application Configuration
    appBaseUrl    : process.env.APP_BASE_URL,
    sessionSecret : process.env.SESSION_SECRET,
};