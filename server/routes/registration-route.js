// import dependencies and initialize the express router
const express = require('express');
const RegistrationController = require('../controllers/registration-controller');

const registrationController = new RegistrationController();
const router = express.Router();

/**
 * Registration Routes - Multi-step registration flow for ITR filing
 * 
 * GET/POST /step1 - Account information + Marketing consents
 * GET/POST /step2 - Tax identity (Aadhaar, PAN)
 * GET/POST /step3 - Consent confirmation + Complete registration
 * 
 * Redirects flow:
 *   Step 1 -> Step 2 -> Step 3 -> Login
 * Or if not on valid step, redirects to previous step
 */

// Step 1: Account information and marketing consents
router.get('/step1', registrationController.getStep1);
router.post('/step1', registrationController.postStep1);

// Step 2: Tax identity information
router.get('/step2', registrationController.getStep2);
router.post('/step2', registrationController.postStep2);

// Step 3: Consent confirmation and complete registration
router.get('/step3', registrationController.getStep3);
router.post('/step3', registrationController.postStep3);

// Default to step 1 if no specific step requested
router.get('/', (req, res) => {
    res.redirect('/register/step1');
});

module.exports = router;
