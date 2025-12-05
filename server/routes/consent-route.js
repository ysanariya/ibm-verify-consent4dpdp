// import dependencies and initialize the express router
const express = require('express');
const bodyParser = require('body-parser');
const ConsentController = require('../controllers/consent-controller');
const OAuthController = require('../controllers/oauth-controller');

const consentController = new ConsentController();
const router = express.Router();
const jsonParser = bodyParser.json();

/**
 * Consent Management Routes - Handle user consent preferences
 * 
 * GET /management - Render consent management page (two-column layout)
 * GET /state - Get current consent state as JSON (for frontend initialization)
 * POST /update - Update a single consent toggle (AJAX endpoint)
 * 
 * All routes require authentication
 */

// Middleware: Ensure user is logged in
router.use((req, res, next) => {
    if (!OAuthController.isLoggedIn(req)) {
        res.redirect('/login');
        return;
    }
    next();
});

// Consent management page - main UI for toggling consents
router.get('/management', consentController.getConsentPage);

// Get current consent state as JSON
// Used by frontend JavaScript to initialize toggle switches
router.get('/state', consentController.getConsentState);

// Update a single consent via AJAX
// Request body: { purposeId, attributeId, state }
router.post('/update', jsonParser, consentController.updateConsentToggle);

module.exports = router;
