const jwt = require('jsonwebtoken')
const OAuthController = require('./oauth-controller');
const Privacy = require('verify-privacy-sdk-js');
const config = require('./config').Config;

/**
 * UsersController handles post-login user-related routes
 * Manages dashboard, profile, and consent views
 */
class UsersController {

    constructor() {}

    /**
     * Extract user information from the OIDC ID token
     */
    getUserPayload = (req) => {
        let authToken = OAuthController.getAuthToken(req);
        let decoded = jwt.decode(authToken.id_token);
        return decoded;
    }

    /**
     * Dashboard - Main page for authenticated users
     * Displays user info and actions (File ITR, Manage Consent)
     * Renamed from getUsersIndex
     */
    getDashboard = (req, res) => {
        if (!OAuthController.isLoggedIn(req)) {
            res.redirect('/');
            return null;
        }

        // Render dashboard with user info
        res.render('dashboard', { user: this.getUserPayload(req), title: 'ITR Filing Dashboard' });
    }

    /**
     * Kept for backward compatibility
     * Redirects to dashboard
     */
    getUsersIndex = (req, res) => {
        this.getDashboard(req, res);
    }

    /**
     * Profile page - Shows detailed user information
     */
    getProfile = (req, res) => {
        if (!OAuthController.isLoggedIn(req)) {
            res.redirect('/');
            return;
        }

        let idTokenPayload = this.getUserPayload(req);
        res.render('profile', { user: idTokenPayload, fullJson: JSON.stringify(idTokenPayload, null, 4), title: 'Profile Information' });
    }

    /**
     * Consents page - Shows user's current consent state with Verify Privacy API
     */
    getConsents = (req, res) => {
        if (!OAuthController.isLoggedIn(req)) {
            res.redirect('/');
            return;
        }

        let idTokenPayload = this.getUserPayload(req);
        let auth = {
            accessToken: OAuthController.getAuthToken(req).access_token
        }

        // Create Privacy SDK client and query user's consents from Verify
        let dpcmClient = new Privacy(config, auth, {})
        dpcmClient.getUserConsents(auth).then(result => {
            res.render('consents', { user: idTokenPayload, consents: result.consents, title: 'My Consents' });
        }).catch(err => {
            console.log("Error=" + err);
            res.render('consents', { user: idTokenPayload, consents: null, title: 'No consents found' });
        })
    }
}

module.exports = UsersController;