const OAuthController = require('./oauth-controller');
const PrivacyService = require('./privacy-service');

/**
 * ConsentController - Manages user consent preferences
 * Allows users to view and toggle consent for different purposes and attributes
 * 
 * Endpoints:
 *   GET /consent/management - Render consent management page
 *   GET /consent/state - Get current consent state (JSON)
 *   POST /consent/update - Update single consent (JSON)
 */
class ConsentController {
    constructor() {
        this.privacyService = new PrivacyService();
    }

    /**
     * GET /consent/management - Show consent management page
     * Displays two-column layout:
     *   Left: Marketing Communications consents
     *   Right: ITR Filing consents
     * Initializes toggle switches with current consent state
     */
    getConsentPage = async (req, res) => {
        try {
            // Ensure user is logged in
            if (!OAuthController.isLoggedIn(req)) {
                res.redirect('/login');
                return;
            }

            const jwt = require('jsonwebtoken');
            const authToken = OAuthController.getAuthToken(req);
            const userPayload = jwt.decode(authToken.id_token);

            // Get current consent state from Verify
            const auth = {
                accessToken: authToken.access_token,
            };

            try {
                // Pass subjectId so the Privacy SDK associates requests with this user
                const consents = await this.privacyService.getUserConsents(auth, userPayload.sub);

                // Get metadata for display
                const marketingMeta = this.privacyService.getConsentMetadata('MARKETING_COMMUNICATIONS');
                const itrMeta = this.privacyService.getConsentMetadata('ITR_FILING');

                // Build consent state for template
                const consentState = this._buildConsentState(consents);

                res.render('consent-management', {
                    title: 'Manage Your Consent',
                    user: userPayload,
                    consentState: consentState,
                    marketingMeta: marketingMeta,
                    itrMeta: itrMeta
                });
            } catch (privacyError) {
                console.error('[ConsentController] Error fetching consents:', privacyError);
                
                // If Privacy API fails, render with default state (no consents)
                const marketingMeta = this.privacyService.getConsentMetadata('MARKETING_COMMUNICATIONS');
                const itrMeta = this.privacyService.getConsentMetadata('ITR_FILING');

                res.render('consent-management', {
                    title: 'Manage Your Consent',
                    user: userPayload,
                    consentState: {},
                    marketingMeta: marketingMeta,
                    itrMeta: itrMeta,
                    apiError: 'Unable to load current consent state. Please try again later.'
                });
            }
        } catch (error) {
            console.error('[ConsentController] Error in getConsentPage:', error);
            res.status(500).send('An error occurred while loading consent management');
        }
    }

    /**
     * GET /consent/state - Get current consent state as JSON
     * Used by frontend JavaScript to initialize toggle switches
     * Returns: { marketing: { name: true, email: false, ... }, itr: { ... } }
     */
    getConsentState = async (req, res) => {
        try {
            if (!OAuthController.isLoggedIn(req)) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const authToken = OAuthController.getAuthToken(req);
            const jwt = require('jsonwebtoken');
            const userPayload = jwt.decode(authToken.id_token);
            const auth = {
                accessToken: authToken.access_token,
                subjectId: userPayload && userPayload.sub ? userPayload.sub : null
            };

            try {
                const consents = await this.privacyService.getUserConsents(auth, auth.subjectId);
                const consentState = this._buildConsentState(consents);
                
                res.json({
                    success: true,
                    consentState: consentState,
                    timestamp: new Date().toISOString()
                });
            } catch (privacyError) {
                console.error('[ConsentController] Privacy API error:', privacyError);
                res.json({
                    success: true,
                    consentState: {},
                    timestamp: new Date().toISOString(),
                    warning: 'Could not fetch latest consent state'
                });
            }
        } catch (error) {
            console.error('[ConsentController] Error in getConsentState:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    /**
     * POST /consent/update - Update a single consent toggle
     * Request body: { purposeId, attributeId, state }
     * state: true/false or 1/2 (1=grant, 2=deny)
     * 
     * This is called via AJAX from frontend when user toggles a switch
     */
    updateConsentToggle = async (req, res) => {
        try {
            if (!OAuthController.isLoggedIn(req)) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const { purposeId, attributeId, state } = req.body;

            // Validate input
            if (!purposeId || !attributeId) {
                return res.status(400).json({
                    error: 'Missing required fields: purposeId, attributeId'
                });
            }

            // Convert state to Verify format (1 = grant, 2 = deny)
            const consentState = state === true || state === 1 ? 1 : 2;

            const authToken = OAuthController.getAuthToken(req);
            const jwt = require('jsonwebtoken');
            const userPayload = jwt.decode(authToken.id_token);
            const auth = {
                accessToken: authToken.access_token,
                subjectId: userPayload && userPayload.sub ? userPayload.sub : null
            };

            console.log(`[ConsentController] Updating consent - Purpose: ${purposeId}, Attribute: ${attributeId}, State: ${consentState}`);

            try {
                // Call Privacy Service to update consent in Verify
                const result = await this.privacyService.updateConsent(
                    auth,
                    purposeId,
                    attributeId,
                    consentState
                );

                // The SDK returns an object like { status: 'success'|'fail', results: [...] }
                // If the SDK reports failure, surface that to the caller instead of
                // returning success unconditionally.
                if (!result || result.status !== 'success') {
                    console.error('[ConsentController] Privacy API reported failure:', JSON.stringify(result));
                    return res.status(500).json({
                        success: false,
                        error: 'Privacy API failed to update consent',
                        detail: result
                    });
                }

                // Log for audit trail (demo only - in production, use proper audit logging)
                console.log(`[ConsentController] Consent updated successfully for user`);

                res.json({
                    success: true,
                    message: `Consent updated for ${attributeId}`,
                    purposeId: purposeId,
                    attributeId: attributeId,
                    state: consentState,
                    timestamp: new Date().toISOString()
                });
            } catch (privacyError) {
                console.error('[ConsentController] Privacy API error during update:', privacyError);
                res.status(500).json({
                    error: 'Failed to update consent. Please try again.',
                    detail: privacyError.message
                });
            }
        } catch (error) {
            console.error('[ConsentController] Error in updateConsentToggle:', error);
            res.status(500).json({
                error: 'Server error while updating consent'
            });
        }
    }

    /**
     * Helper: Build consent state object from Verify API response
     * Converts list of consent records into nested object by purpose and attribute
     * @param {Array} consents - Array of consent objects from Verify
     * @returns {Object} { purposeId: { attributeId: boolean } }
     */
    _buildConsentState(consents) {
        const state = {
            MARKETING_COMMUNICATIONS: {},
            ITR_FILING: {}
        };

        if (!consents || consents.length === 0) {
            // Default: all attributes unconsented
            ['name', 'email', 'mobile_number'].forEach(attr => {
                state.MARKETING_COMMUNICATIONS[attr] = false;
            });
            ['name', 'email', 'mobile_number', 'aadhar_id', 'pan_id'].forEach(attr => {
                state.ITR_FILING[attr] = false;
            });
            return state;
        }

        // Build metadata lookup for attribute label -> logical id mapping
        const purposeMeta = {
            MARKETING_COMMUNICATIONS: this.privacyService.getConsentMetadata('MARKETING_COMMUNICATIONS'),
            ITR_FILING: this.privacyService.getConsentMetadata('ITR_FILING')
        };

        const findLogicalId = (purposeId, attrId, attrName) => {
            const meta = purposeMeta[purposeId];
            if (!meta || !meta.attributes) {
                return attrId || (attrName && attrName.toLowerCase().replace(/\s+/g, '_')) || null;
            }

            // if attrId already matches a logical id in metadata, return it
            const metaIds = meta.attributes.map(a => a.id);
            if (attrId && metaIds.indexOf(attrId) !== -1) {
                return attrId;
            }

            // Try matching by attributeName label
            if (attrName) {
                const lowerName = attrName.toLowerCase().trim();
                // Exact label match
                const exact = meta.attributes.find(a => a.label && a.label.toLowerCase() === lowerName);
                if (exact) return exact.id;

                // Partial match: check if label contains a token from attrName or vice-versa
                const partial = meta.attributes.find(a => a.label && (a.label.toLowerCase().includes(lowerName) || lowerName.includes(a.label.toLowerCase())));
                if (partial) return partial.id;

                // Token heuristics: look for keywords
                if (lowerName.includes('email')) return metaIds.find(id => id.includes('email')) || 'email';
                if (lowerName.includes('mobile')) return metaIds.find(id => id.includes('mobile')) || 'mobile_number';
                if (lowerName.includes('name')) return metaIds.find(id => id === 'name') || metaIds.find(id => id.includes('name')) || 'name';
                if (lowerName.includes('pan')) return metaIds.find(id => id.includes('pan')) || 'pan_id';
                if (lowerName.includes('aadhaar') || lowerName.includes('aadhar')) return metaIds.find(id => id.includes('aadhar') || id.includes('aadhaar')) || 'aadhar_id';
            }

            // Fallback: return attrId as-is (could be numeric tenant id)
            return attrId;
        };

        // Process consents from Verify
        consents.forEach(consent => {
            const purposeId = consent.purposeId;

            if (!state[purposeId]) {
                state[purposeId] = {};
            }

            // The SDK may return attribute information either as a top-level
            // `attributeId` on the consent object, or as an `attributes` array.
            if (consent.attributeId) {
                const logical = findLogicalId(purposeId, consent.attributeId, consent.attributeName);
                state[purposeId][logical] = (consent.state === 1);
            } else {
                const attributes = Array.isArray(consent.attributes)
                    ? consent.attributes
                    : Object.values(consent.attributes || {});

                attributes.forEach(attr => {
                    const attrId = attr.attributeId || attr.id;
                    const logical = findLogicalId(purposeId, attrId, attr.attributeName || attr.label || attr.name);
                    state[purposeId][logical] = (attr.state === 1);
                });
            }
        });

        return state;
    }

    /**
     * Helper: Check if all required consents are granted
     * @param {Object} consentState - Consent state object
     * @param {String} purposeId - Purpose to check
     * @param {Array<String>} requiredAttributes - Attributes that must be granted
     * @returns {Boolean} True if all required attributes are granted
     */
    _hasAllRequired(consentState, purposeId, requiredAttributes) {
        const purposeConsents = consentState[purposeId] || {};
        return requiredAttributes.every(attr => purposeConsents[attr] === true);
    }
}

module.exports = ConsentController;
