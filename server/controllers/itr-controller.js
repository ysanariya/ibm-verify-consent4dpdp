const OAuthController = require('./oauth-controller');
const PrivacyService = require('./privacy-service');

/**
 * ITRController - Handles ITR filing flow
 * Main action: Assess user's consent state and allow/block ITR filing
 * 
 * Flow:
 *   User clicks "File ITR" → POST /itr/assess
 *   → Check if all required consents are granted
 *   → If yes → Redirect to /itr/success
 *   → If no → Redirect to /itr/blocked → Show consent mgmt page
 */
class ITRController {
    constructor() {
        this.privacyService = new PrivacyService();
    }

    /**
     * POST /itr/assess - Assess consent and file ITR if allowed
     * Checks if user has granted all required consents for ITR_FILING purpose
     * Required attributes: name, email, mobile_number, aadhar_id, pan_id
     */
    assessAndFile = async (req, res) => {
        try {
            // Ensure user is logged in
            if (!OAuthController.isLoggedIn(req)) {
                res.redirect('/login');
                return;
            }

            const auth = {
                accessToken: OAuthController.getAuthToken(req).access_token
            };

            // Check if user has all required consents for ITR filing
            const requiredAttributes = ['name', 'email', 'mobile_number', 'aadhar_id', 'pan_id'];
            const canFile = await this.privacyService.hasRequiredConsents(
                auth,
                'ITR_FILING',
                requiredAttributes
            );

            if (canFile) {
                console.log('[ITRController] User has all required consents, allowing ITR filing');
                // In production: Call actual ITR filing service
                // For demo: Just show success page
                res.redirect('/itr/success');
            } else {
                console.log('[ITRController] User missing required consents, blocking ITR filing');

                // Compute which attributes are missing so we can inform the user
                const missing = await this.privacyService.getMissingRequiredConsents(auth, 'ITR_FILING', requiredAttributes);
                const meta = this.privacyService.getConsentMetadata('ITR_FILING') || { attributes: [] };
                const attrLabel = id => {
                    const found = meta.attributes.find(a => a.id === id);
                    return found ? found.label : id;
                };
                const missingLabels = (missing || []).map(attr => attrLabel(attr));

                // Render blocked page with details about which consents are missing
                const jwt = require('jsonwebtoken');
                const authToken = OAuthController.getAuthToken(req);
                const userPayload = jwt.decode(authToken.id_token);

                return res.status(403).render('itr-blocked', {
                    title: 'Consent Required',
                    user: userPayload,
                    missingConsents: missing,
                    missingConsentsLabels: missingLabels
                });
            }
        } catch (error) {
            console.error('[ITRController] Error in assessAndFile:', error);
            res.status(500).render('itr-blocked', {
                title: 'Error',
                error: 'An error occurred while checking your consent status. Please try again.',
                user: {
                    name: req.session.userPayload?.name || 'User'
                }
            });
        }
    }

    /**
     * GET /itr/success - Show ITR filing success page
     * Displays confirmation message and next steps
     * This is a demo - in production, would show actual filing receipt/reference
     */
    getSuccess = (req, res) => {
        if (!OAuthController.isLoggedIn(req)) {
            res.redirect('/login');
            return;
        }

        const jwt = require('jsonwebtoken');
        const authToken = OAuthController.getAuthToken(req);
        const userPayload = jwt.decode(authToken.id_token);

        res.render('itr-success', {
            title: 'ITR Filed Successfully',
            user: userPayload,
            referenceId: this._generateReferenceId()
        });
    }

    /**
     * GET /itr/blocked - Show ITR filing blocked page
     * Displays banner explaining missing consents
     * Provides link to consent management page
     */
    getBlocked = (req, res) => {
        if (!OAuthController.isLoggedIn(req)) {
            res.redirect('/login');
            return;
        }

        const jwt = require('jsonwebtoken');
        const authToken = OAuthController.getAuthToken(req);
        const userPayload = jwt.decode(authToken.id_token);

        res.render('itr-blocked', {
            title: 'Consent Required',
            user: userPayload,
            message: 'You must grant all required consents before filing your ITR'
        });
    }

    /**
     * Generate a reference ID for demo purposes
     * In production, this would come from the actual filing system
     */
    _generateReferenceId() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `ITR-${timestamp}-${random}`;
    }
}

module.exports = ITRController;
