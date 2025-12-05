const Privacy = require('verify-privacy-sdk-js');
const config = require('./config').Config;

/**
 * PrivacyService - Wrapper around Verify Privacy SDK
 * Handles all consent management and privacy-related operations
 * Interacts with IBM Verify's Privacy API for consent records
 * 
 * Example Verify API Endpoints Used:
 *   GET /privacy/v1/consents - Get user consents
 *   POST /privacy/v1/consents - Create/Update consent
 *   GET /privacy/v1/purposes - Get available purposes
 */
class PrivacyService {
    constructor() {}

    /**
     * Initialize Privacy SDK client
     * Requires: auth token from OIDC session
     * @param {Object} auth - Auth object with accessToken
     * @returns {Object} Privacy SDK client instance
     */
    _getPrivacyClient(auth, subjectId) {
        // The verify-privacy-sdk-js expects a config object with a `tenantUrl`
        // property (e.g. { tenantUrl: 'https://your-tenant.verify.ibm.com' }).
        // Our app's `config` uses `verifyPrivacyBaseUrl` / `verifyTenantUrl` from .env,
        // so map to the expected property name here.
        const sdkConfig = {
            tenantUrl: config.verifyPrivacyBaseUrl || config.verifyTenantUrl || config.verifyTenantUrl
        };

        // Build context for the Privacy SDK. If a subjectId is provided, include it
        // so that consent operations are associated with the specific user.
        const context = {};
        if (subjectId) {
            context.subjectId = subjectId;
        }

        return new Privacy(sdkConfig, auth, context);
    }

    /**
     * Get current consent state for a user
     * Queries Verify Privacy API: GET /privacy/v1/consents
     * @param {Object} auth - Auth object with accessToken
     * @param {String} userId - Optional: user ID (can be extracted from token if not provided)
     * @returns {Promise<Array>} Array of consent records
     */
    async getUserConsents(auth, userId) {
        try {
            const dpcmClient = this._getPrivacyClient(auth, userId);
            const result = await dpcmClient.getUserConsents();
            console.log(`[PrivacyService] Retrieved consents for user: ${JSON.stringify(result)}`);
            return result.consents || [];
        } catch (error) {
            console.error(`[PrivacyService] Error retrieving consents: ${error}`);
            throw error;
        }
    }

    /**
     * Get consent state for a specific purpose
     * Filters user consents to find consents for a given purpose
     * @param {Object} auth - Auth object with accessToken
     * @param {String} purposeId - Purpose identifier (e.g., 'MARKETING_COMMUNICATIONS', 'ITR_FILING')
     * @returns {Promise<Object>} Consent object for the purpose or null
     */
    async getConsentForPurpose(auth, purposeId) {
        try {
            const consents = await this.getUserConsents(auth);
            // Return all consent records that match the purposeId (there may be
            // multiple consent entries, one per attribute). Previously this
            // returned only the first matching consent which caused checks to
            // miss other attribute consents.
            const purposeConsents = consents.filter(c => c.purposeId === purposeId);
            console.log(`[PrivacyService] Found ${purposeConsents.length} consent entries for purpose ${purposeId}`);
            return purposeConsents; // may be empty array
        } catch (error) {
            console.error(`[PrivacyService] Error getting consent for purpose ${purposeId}: ${error}`);
            throw error;
        }
    }

    /**
     * Check if user has granted all required consents for a purpose
     * @param {Object} auth - Auth object with accessToken
     * @param {String} purposeId - Purpose identifier
     * @param {Array<String>} requiredAttributes - Array of attribute IDs that must be consented
     * @returns {Promise<Boolean>} True if all required attributes are consented
     */
    async hasRequiredConsents(auth, purposeId, requiredAttributes = []) {
        try {
            const consent = await this.getConsentForPurpose(auth, purposeId);

            if (!consent || consent.length === 0) {
                console.log(`[PrivacyService] No consent found for purpose ${purposeId}`);
                return false;
            }

            // If no specific attributes required, just check if purpose consent exists
            if (requiredAttributes.length === 0) {
                return true;
            }

            // Normalize consented attributes to logical ids using metadata
            // Flatten all consent entries for the purpose into an attributes array
            const consentedAttributes = [];
            consent.forEach(entry => {
                if (entry.attributeId) {
                    consentedAttributes.push({ attributeId: entry.attributeId, attributeName: entry.attributeName, state: entry.state });
                } else if (Array.isArray(entry.attributes) && entry.attributes.length > 0) {
                    entry.attributes.forEach(a => consentedAttributes.push({ attributeId: a.attributeId || a.id, attributeName: a.attributeName || a.label || a.name, state: a.state }));
                }
            });

            const meta = this.getConsentMetadata(purposeId);
            const metaIds = (meta && meta.attributes) ? meta.attributes.map(a => a.id) : [];

            const findLogicalId = (attrId, attrName) => {
                if (attrId && metaIds.indexOf(attrId) !== -1) return attrId;
                if (attrName && meta && meta.attributes) {
                    const lowerName = attrName.toLowerCase().trim();
                    const exact = meta.attributes.find(a => a.label && a.label.toLowerCase() === lowerName);
                    if (exact) return exact.id;
                    const partial = meta.attributes.find(a => a.label && (a.label.toLowerCase().includes(lowerName) || lowerName.includes(a.label.toLowerCase())));
                    if (partial) return partial.id;
                    if (lowerName.includes('email')) return metaIds.find(id => id.includes('email')) || 'email';
                    if (lowerName.includes('mobile')) return metaIds.find(id => id.includes('mobile')) || 'mobile_number';
                    if (lowerName.includes('name')) return metaIds.find(id => id === 'name') || metaIds.find(id => id.includes('name')) || 'name';
                    if (lowerName.includes('pan')) return metaIds.find(id => id.includes('pan')) || 'pan_id';
                    if (lowerName.includes('aadhaar') || lowerName.includes('aadhar')) return metaIds.find(id => id.includes('aadhar') || id.includes('aadhaar')) || 'aadhar_id';
                }
                return attrId;
            };

            const consentedLogical = consentedAttributes.map(ca => ({ logicalId: findLogicalId(ca.attributeId, ca.attributeName), state: ca.state }));

            const hasAll = requiredAttributes.every(reqAttr => consentedLogical.some(ca => ca.logicalId === reqAttr && ca.state === 1));

            console.log(`[PrivacyService] Checking required attributes for ${purposeId}: ${hasAll}`);
            return hasAll;
        } catch (error) {
            console.error(`[PrivacyService] Error checking required consents: ${error}`);
            return false;
        }
    }

    /**
     * Create or update a consent record in Verify
     * Calls Verify Privacy API: POST /privacy/v1/consents
     * @param {Object} auth - Auth object with accessToken
     * @param {String} purposeId - Purpose identifier
     * @param {String} attributeId - Attribute identifier
     * @param {Number} state - Consent state (1=allow, 2=deny, 3=opt-in, 4=opt-out)
     * @returns {Promise<Object>} Updated consent object
     */
    async updateConsent(auth, purposeId, attributeId, state = 1) {
        try {
            console.log(`[PrivacyService] Updating consent - Purpose: ${purposeId}, Attribute: ${attributeId}, State: ${state}`);
            
            const dpcmClient = this._getPrivacyClient(auth, auth.subjectId || null);
            // Build consent value expected by Verify DPCM API.
            // The SDK expects each "value" to be an object with fields like
            // purposeId, attributeId, accessTypeId and state (and optional times).
            const consentValue = {
                purposeId: purposeId,
                attributeId: attributeId,
                accessTypeId: 'default',
                state: state // 1 = consent, 2 = no consent
                // Do not set startTime explicitly. Let the DPCM API default to
                // the current time. Some purposes may validate startTime and
                // reject values that don't align with purpose activation windows.
            };

            // Call SDK to store consents. The SDK will wrap the value in the
            // required operation object (op: 'add', value: ...)
            // Before storing, verify that the requested attribute belongs to the purpose
            try {
                const metaResp = await dpcmClient.getConsentMetadata([purposeId]);
                // metaResp.purposes may contain purpose definitions
                const purposeDef = metaResp && metaResp.purposes && metaResp.purposes[purposeId];
                if (purposeDef) {
                    const attributes = purposeDef.attributes || [];
                    const attrIds = attributes.map(a => a.id);
                    if (attrIds.indexOf(attributeId) === -1) {
                        const err = new Error(`Attribute '${attributeId}' is not defined for purpose '${purposeId}'. Please configure this attribute in Verify.`);
                        err.code = 'ATTRIBUTE_NOT_IN_PURPOSE';
                        throw err;
                    }
                }
            } catch (metaErr) {
                // If metadata fetch fails, log and proceed to call storeConsents —
                // the API will still validate. If metaErr is our ATTRIBUTE_NOT_IN_PURPOSE,
                // rethrow so caller gets a clear message.
                if (metaErr && metaErr.code === 'ATTRIBUTE_NOT_IN_PURPOSE') {
                    console.error('[PrivacyService] Attribute not part of purpose:', metaErr.message);
                    throw metaErr;
                }
                console.warn('[PrivacyService] Could not validate purpose metadata before storing consent:', metaErr && metaErr.message ? metaErr.message : metaErr);
            }

            const result = await dpcmClient.storeConsents([consentValue]);
            console.log(`[PrivacyService] Consent updated successfully: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            console.error(`[PrivacyService] Error updating consent: ${error}`);
            throw error;
        }
    }

    /**
     * Create multiple consents at once (for registration flow)
     * @param {Object} auth - Auth object with accessToken
     * @param {Array<Object>} consents - Array of {purposeId, attributes: [{attributeId, state}]}
     * @returns {Promise<Array>} Array of created consent objects
     */
    async createConsents(auth, consents) {
        try {
            console.log(`[PrivacyService] Creating ${consents.length} consent records`);
            
            const results = [];
            for (const consent of consents) {
                const result = await this.updateConsent(auth, consent.purposeId, consent.attributeId, consent.state);
                results.push(result);
            }

            console.log(`[PrivacyService] Successfully created ${results.length} consent records`);
            return results;
        } catch (error) {
            console.error(`[PrivacyService] Error creating consents: ${error}`);
            throw error;
        }
    }

    /**
     * Get consent metadata for display
     * Returns human-readable descriptions of purposes and attributes
     * In production, this would query Verify's purpose/attribute definitions
     * @param {String} purposeId - Purpose identifier
     * @returns {Object} Purpose metadata with description and attributes
     */
    getConsentMetadata(purposeId) {
        // Define consent metadata for this demo
        const metadata = {
            MARKETING_COMMUNICATIONS: {
                name: 'Marketing Communications',
                description: 'Send you marketing emails and promotional offers',
                notice: 'We will use your personal data to send you relevant marketing communications. You can withdraw this consent at any time.',
                attributes: [
                    {
                        id: 'name',
                        label: 'Full Name',
                        description: 'Used to personalize communications'
                    },
                    {
                        id: 'email',
                        label: 'Email Address',
                        description: 'Used to send marketing emails'
                    },
                    {
                        id: 'mobile_number',
                        label: 'Mobile Number',
                        description: 'Used to send SMS notifications'
                    }
                ]
            },
            ITR_FILING: {
                name: 'ITR Filing Services',
                description: 'File your Income Tax Return using our secure platform',
                notice: 'We will use your personal and tax-related data to assist with your ITR filing in compliance with DPDP regulations. Your data is encrypted and protected.',
                attributes: [
                    {
                        id: 'name',
                        label: 'Full Name',
                        description: 'Required for ITR filing'
                    },
                    {
                        id: 'email',
                        label: 'Email Address',
                        description: 'For filing confirmations and updates'
                    },
                    {
                        id: 'mobile_number',
                        label: 'Mobile Number',
                        description: 'For OTP and two-factor authentication'
                    },
                    {
                        id: 'aadhar_id',
                        label: 'Aadhaar Number',
                        description: 'Required for ITR filing verification'
                    },
                    {
                        id: 'pan_id',
                        label: 'PAN Number',
                        description: 'Required for ITR filing identification'
                    }
                ]
            }
        };

        return metadata[purposeId] || null;
    }

    /**
     * Check if all attributes for ITR filing are consented
     * @param {Object} auth - Auth object with accessToken
     * @returns {Promise<Boolean>} True if user can file ITR
     */
    async canFileITR(auth) {
        const requiredAttributes = ['name', 'email', 'mobile_number', 'aadhar_id', 'pan_id'];
        return this.hasRequiredConsents(auth, 'ITR_FILING', requiredAttributes);
    }

    /**
     * Return which required attributes are missing consent for a purpose
     * @param {Object} auth
     * @param {String} purposeId
     * @param {Array<String>} requiredAttributes
     * @returns {Promise<Array<String>>} Array of logical attribute ids that are missing
     */
    async getMissingRequiredConsents(auth, purposeId, requiredAttributes = []) {
        try {
            const consent = await this.getConsentForPurpose(auth, purposeId);

            if (!consent || consent.length === 0) {
                return requiredAttributes.slice();
            }

            if (requiredAttributes.length === 0) return [];

            // Flatten all consent entries for the purpose into an attributes array
            const consentedAttributes = [];
            consent.forEach(entry => {
                if (entry.attributeId) {
                    consentedAttributes.push({ attributeId: entry.attributeId, attributeName: entry.attributeName, state: entry.state });
                } else if (Array.isArray(entry.attributes) && entry.attributes.length > 0) {
                    entry.attributes.forEach(a => consentedAttributes.push({ attributeId: a.attributeId || a.id, attributeName: a.attributeName || a.label || a.name, state: a.state }));
                }
            });

            const meta = this.getConsentMetadata(purposeId);
            const metaIds = (meta && meta.attributes) ? meta.attributes.map(a => a.id) : [];

            const findLogicalId = (attrId, attrName) => {
                if (attrId && metaIds.indexOf(attrId) !== -1) return attrId;
                if (attrName && meta && meta.attributes) {
                    const lowerName = attrName.toLowerCase().trim();
                    const exact = meta.attributes.find(a => a.label && a.label.toLowerCase() === lowerName);
                    if (exact) return exact.id;
                    const partial = meta.attributes.find(a => a.label && (a.label.toLowerCase().includes(lowerName) || lowerName.includes(a.label.toLowerCase())));
                    if (partial) return partial.id;
                    if (lowerName.includes('email')) return metaIds.find(id => id.includes('email')) || 'email';
                    if (lowerName.includes('mobile')) return metaIds.find(id => id.includes('mobile')) || 'mobile_number';
                    if (lowerName.includes('name')) return metaIds.find(id => id === 'name') || metaIds.find(id => id.includes('name')) || 'name';
                    if (lowerName.includes('pan')) return metaIds.find(id => id.includes('pan')) || 'pan_id';
                    if (lowerName.includes('aadhaar') || lowerName.includes('aadhar')) return metaIds.find(id => id.includes('aadhar') || id.includes('aadhaar')) || 'aadhar_id';
                }
                return attrId;
            };

            const consentedLogical = consentedAttributes.map(ca => ({ logicalId: findLogicalId(ca.attributeId, ca.attributeName), state: ca.state }));

            const missing = requiredAttributes.filter(reqAttr => !consentedLogical.some(ca => ca.logicalId === reqAttr && ca.state === 1));
            return missing;
        } catch (error) {
            console.error('[PrivacyService] Error computing missing required consents:', error);
            return requiredAttributes.slice();
        }
    }

    /**
     * Format consent state for display
     * @param {Number} state - Consent state code (1, 2, 3, 4, 5)
     * @returns {String} Human-readable state
     */
    formatConsentState(state) {
        const stateMap = {
            1: 'Granted',
            2: 'Denied',
            3: 'Opt-in',
            4: 'Opt-out',
            5: 'Transparent'
        };
        return stateMap[state] || 'Unknown';
    }
}

module.exports = PrivacyService;
