// import dependencies and initialize the express router
const express = require('express');
const ITRController = require('../controllers/itr-controller');
const OAuthController = require('../controllers/oauth-controller');

const itrController = new ITRController();
const router = express.Router();

/**
 * ITR Filing Routes - Handle ITR filing flow
 * 
 * POST /assess - Main action: assess consents and file ITR
 * GET /success - Show ITR filing success page
 * GET /blocked - Show consent required page (user needs to grant consents)
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

// Main ITR filing action - assess consents and file
router.post('/assess', itrController.assessAndFile);

// Success page - shown after successful ITR filing
router.get('/success', itrController.getSuccess);

// Blocked page - shown when user has insufficient consents
router.get('/blocked', itrController.getBlocked);

module.exports = router;
