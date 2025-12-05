// import dependencies and initialize the express router
const express = require('express');
const OAuthController = require('../controllers/oauth-controller');
const config = require('../controllers/config').Config;

const oauthController = new OAuthController(config.verifyOidcScope);
const router = express.Router();

/**
 * Session Routes - Handle authentication and landing page
 * GET / - Landing page (public)
 * GET /login - Initiate OIDC login flow
 * GET /logout - Clear session and logout
 * GET /auth/callback - OIDC callback from IBM Verify
 */

// Landing page - public
router.get('/',  (req, res) => {
    if (OAuthController.isLoggedIn(req)) {
        // User already logged in, redirect to dashboard
        res.redirect('/dashboard');
    } else {
        // Show landing page with pricing cards and login/signup buttons
        // For now, render index.hbs (will be replaced with landing.hbs later)
        res.render('index', {
            title: 'myITReturn Demo - DPDP-Compliant ITR Filing'
        })
    }
});

// Dashboard friendly URL - redirect to users route which renders the actual dashboard
router.get('/dashboard', (req, res) => {
    if (OAuthController.isLoggedIn(req)) {
        res.redirect('/users');
    } else {
        // Not logged in - send user to landing/login
        res.redirect('/');
    }
});

// Initiate OIDC login
router.get('/login', oauthController.authorize);

// Logout
router.get('/logout', oauthController.logout)

// OIDC callback from IBM Verify
router.get('/auth/callback', oauthController.aznCallback);

module.exports = router;