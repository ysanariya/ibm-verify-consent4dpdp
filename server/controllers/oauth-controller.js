const config = require('./config').Config;
const Issuer = require('openid-client').Issuer
const { uuid } = require('uuidv4');

/**
 * OAuthController handles OIDC authentication with IBM Verify
 * Manages login, callback, and logout flows
 */
class OAuthController {

    constructor(scope) {
        this._scope = scope;
    }

    /**
     * Authorize - Initiates the OIDC login flow
     * Redirects user to IBM Verify login page
     */
    authorize = async (req, res) => {
        // Discover OIDC provider metadata from IBM Verify
        // This includes token endpoint, authorization endpoint, etc.
        try {
            this._oidcIssuer = await Issuer.discover(config.verifyDiscoveryUrl);
            console.log('Discovered issuer %s %O', this._oidcIssuer.issuer, this._oidcIssuer.metadata);
        } catch (err) {
            // The openid-client library expects a JSON response from the discovery URL.
            // If the tenant URL or discovery path is incorrect it often returns an HTML
            // login page which triggers a JSON.parse error (Unexpected token '<').
            console.error('OIDC discovery failed for URL:', config.verifyDiscoveryUrl);
            console.error('Discovery error:', err && err.message ? err.message : err);
            if (err && err.stack) console.error(err.stack);

            // Provide a helpful response to the browser and stop the flow.
            res.status(500).send('OIDC discovery failed. Check VERIFY_DISCOVERY_URL in your .env and ensure the discovery endpoint returns JSON (openid-configuration). See server logs for details.');
            return;
        }

        // Create OIDC client with Verify app credentials
        this._client = new this._oidcIssuer.Client({
            client_id: config.verifyOidcClientId,
            client_secret: config.verifyOidcClientSecret,
            redirect_uris: [config.verifyOidcRedirectUri],
            response_types: ['code'],
            token_endpoint_auth_method: 'client_secret_post'
        });
    
        let url = this._client.authorizationUrl({
            scope: this._scope,
            state: uuid(),
        });

        console.log(`Authorize URL: ${url}`)

        res.redirect(url)
    }

    /**
     * AznCallback - Handles OIDC callback from IBM Verify
     * Exchanges authorization code for tokens and creates session
     */
    aznCallback = async (req, res) => {

        const params = this._client.callbackParams(req);
        var clientAssertionPayload = null
        // Exchange code for tokens with IBM Verify
        const tokenSet = await this._client.callback(config.verifyOidcRedirectUri, params, {
            state: params.state
        }, {
            clientAssertionPayload: clientAssertionPayload,
        });
        console.log(`received and validated tokens\n${JSON.stringify(tokenSet, null, 2)}\n`);

        // Store tokens in session for later use
        req.session.authToken = tokenSet;
        req.session.token = tokenSet;
        req.session.save();

        // Extract redirect URL from querystring
        let targetUrl = req.session.targetUrl;
        if (!targetUrl || targetUrl == "") {
            targetUrl = "/";
        }

        // redirect to authenticated page
        res.redirect(targetUrl);
    }

    /**
     * Logout - Clears session and redirects to IBM Verify logout endpoint
     */
    logout = (req, res) => {

        if (!OAuthController.isLoggedIn(req)) {
            res.redirect('/')
            return;
        }

        req.session.destroy();
        const proxyHost = req.headers["x-forwarded-host"];
        const host = proxyHost ? proxyHost : req.headers.host;
        // Redirect to Verify logout endpoint
        // Note: themeId is no longer used in new config
        res.redirect(config.verifyTenantUrl + '/idaas/mtfim/sps/idaas/logout?redirectUrl=' + encodeURIComponent(req.protocol + '://' + host));
    }

    /**
     * Check if user is currently logged in (has valid auth token in session)
     */
    static isLoggedIn(req) {
        return req.session != null && req.session.authToken != null && req.session.authToken != "";
    }

    /**
     * Get auth token from session
     * Returns the OIDC token set (contains id_token, access_token, refresh_token)
     */
    static getAuthToken = (req) => {
        if (req.session) {
            return req.session.authToken
        }
    
        return null;
    }
}

module.exports = OAuthController;