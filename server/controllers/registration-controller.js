const OAuthController = require('./oauth-controller');
const PrivacyService = require('./privacy-service');

/**
 * RegistrationController - Handles multi-step registration flow for ITR filing
 * Step 1: Collect name, email, mobile, password + DPDP consent capture
 * Step 2: Collect Aadhaar and PAN (stored in session only - demo limitation)
 * Step 3: Review and confirm consent for ITR filing
 * 
 * Data Flow:
 *   Step 1 -> Create user in Verify, store temp data in session
 *   Step 2 -> Validate Aadhaar/PAN format, store in session
 *   Step 3 -> Create consent records in Verify, clear session, redirect to login
 */
class RegistrationController {
    constructor() {
        this.privacyService = new PrivacyService();
    }

    /**
     * GET /register/step1 - Show registration step 1 form
     * Displays: name, email, mobile, password fields + DPDP consent notices
     */
    getStep1 = (req, res) => {
        // If user already logged in, redirect to dashboard
        if (OAuthController.isLoggedIn(req)) {
            res.redirect('/dashboard');
            return;
        }

        res.render('register-step1', {
            title: 'Create Account',
            step: 1,
            totalSteps: 3
        });
    }

    /**
     * POST /register/step1 - Process registration step 1
     * Creates user in Verify, stores temp data in session
     * Validates: email, password match, mobile format
     * Creates consent records in Verify for marketing communications
     */
    postStep1 = async (req, res) => {
        try {
            const { fullName, email, mobile, password, confirmPassword } = req.body;

            // Validation
            if (!fullName || fullName.trim().length < 2) {
                return res.status(400).render('register-step1', {
                    title: 'Create Account',
                    step: 1,
                    error: 'Full name must be at least 2 characters',
                    formData: req.body
                });
            }

            if (!this._validateEmail(email)) {
                return res.status(400).render('register-step1', {
                    title: 'Create Account',
                    step: 1,
                    error: 'Please enter a valid email address',
                    formData: req.body
                });
            }

            if (!this._validateMobile(mobile)) {
                return res.status(400).render('register-step1', {
                    title: 'Create Account',
                    step: 1,
                    error: 'Please enter a valid 10-digit mobile number',
                    formData: req.body
                });
            }

            if (!password || password.length < 8) {
                return res.status(400).render('register-step1', {
                    title: 'Create Account',
                    step: 1,
                    error: 'Password must be at least 8 characters',
                    formData: req.body
                });
            }

            if (password !== confirmPassword) {
                return res.status(400).render('register-step1', {
                    title: 'Create Account',
                    step: 1,
                    error: 'Passwords do not match',
                    formData: req.body
                });
            }

            // TODO: In production, create user in Verify using Users API
            // POST /v1/Users with SCIM format
            // Example:
            // const newUser = await verifyUsersAPI.createUser({
            //     name: { givenName: fullName.split(' ')[0], familyName: fullName.split(' ')[1] },
            //     emails: [{ value: email }],
            //     attributes: { mobile_number: mobile }
            // });

            // For demo, store in session
            req.session.tempUser = {
                fullName,
                email,
                mobile,
                password,
                marketingConsents: {
                    name: req.body['marketing-name'] === 'on',
                    email: req.body['marketing-email'] === 'on',
                    mobile: req.body['marketing-mobile'] === 'on'
                }
            };

            console.log('[RegistrationController] Step 1 complete, moving to Step 2');
            req.session.save();

            res.redirect('/register/step2');
        } catch (error) {
            console.error('[RegistrationController] Step 1 error:', error);
            res.status(500).render('register-step1', {
                title: 'Create Account',
                step: 1,
                error: 'An error occurred. Please try again.',
                formData: req.body
            });
        }
    }

    /**
     * GET /register/step2 - Show registration step 2 form
     * Displays: Aadhaar number, PAN number fields
     * Note: In production, these must be encrypted and stored securely
     *       This demo stores them in session only for proof-of-concept
     */
    getStep2 = (req, res) => {
        if (OAuthController.isLoggedIn(req)) {
            res.redirect('/dashboard');
            return;
        }

        if (!req.session.tempUser) {
            res.redirect('/register/step1');
            return;
        }

        res.render('register-step2', {
            title: 'Provide Tax Identity Information',
            step: 2,
            totalSteps: 3,
            user: req.session.tempUser
        });
    }

    /**
     * POST /register/step2 - Process registration step 2
     * Validates Aadhaar and PAN format
     * Stores in session (DEMO ONLY - not for production)
     * 
     * SECURITY WARNING: In production:
     *   - Encrypt Aadhaar/PAN before storing
     *   - Use secure key management
     *   - Store in encrypted database, not session
     *   - Implement audit logging
     *   - Comply with local data protection regulations
     */
    postStep2 = async (req, res) => {
        try {
            if (!req.session.tempUser) {
                res.redirect('/register/step1');
                return;
            }

            const { aadhaar, pan } = req.body;

            // Validation
            if (!this._validateAadhaar(aadhaar)) {
                return res.status(400).render('register-step2', {
                    title: 'Provide Tax Identity Information',
                    step: 2,
                    error: 'Please enter a valid 12-digit Aadhaar number',
                    user: req.session.tempUser,
                    formData: req.body
                });
            }

            if (!this._validatePAN(pan)) {
                return res.status(400).render('register-step2', {
                    title: 'Provide Tax Identity Information',
                    step: 2,
                    error: 'Please enter a valid 10-character PAN number',
                    user: req.session.tempUser,
                    formData: req.body
                });
            }

            // Store in session temporarily
            // DEMO ONLY: In production, this would be encrypted and handled differently
            req.session.tempUser.aadhaar = this._maskAadhaar(aadhaar);
            req.session.tempUser.aadhaarFull = aadhaar; // Keep full version for consent processing
            req.session.tempUser.pan = this._maskPAN(pan);
            req.session.tempUser.panFull = pan; // Keep full version for consent processing

            console.log('[RegistrationController] Step 2 complete, moving to Step 3');
            req.session.save();

            res.redirect('/register/step3');
        } catch (error) {
            console.error('[RegistrationController] Step 2 error:', error);
            res.status(500).render('register-step2', {
                title: 'Provide Tax Identity Information',
                step: 2,
                error: 'An error occurred. Please try again.',
                user: req.session.tempUser,
                formData: req.body
            });
        }
    }

    /**
     * GET /register/step3 - Show registration step 3 (consent summary)
     * Displays: User info, Aadhaar/PAN (masked), consent confirmation toggles
     * Requires explicit opt-in for Aadhaar and PAN use in ITR filing
     */
    getStep3 = (req, res) => {
        if (OAuthController.isLoggedIn(req)) {
            res.redirect('/dashboard');
            return;
        }

        if (!req.session.tempUser || !req.session.tempUser.aadhaar) {
            res.redirect('/register/step2');
            return;
        }

        res.render('register-step3', {
            title: 'Review Your Information',
            step: 3,
            totalSteps: 3,
            user: req.session.tempUser
        });
    }

    /**
     * POST /register/step3 - Complete registration
     * Creates consent records in Verify for all collected data
     * Finalizes user registration by storing consents in Verify Privacy API
     * Clears session temp data
     * Redirects to login page
     */
    postStep3 = async (req, res) => {
        try {
            if (!req.session.tempUser) {
                res.redirect('/register/step1');
                return;
            }

            const { aadhaarConsent, panConsent } = req.body;

            // Validate that both Aadhaar and PAN consents are given
            if (aadhaarConsent !== 'on' || panConsent !== 'on') {
                return res.status(400).render('register-step3', {
                    title: 'Review Your Information',
                    step: 3,
                    error: 'You must consent to Aadhaar and PAN use for ITR filing',
                    user: req.session.tempUser
                });
            }

            // TODO: Create user in Verify if not already created in Step 1
            // TODO: Call Verify Privacy API to create consent records
            
            // For demo, build consent payload
            const consents = [
                // Marketing communications consents
                {
                    purposeId: 'MARKETING_COMMUNICATIONS',
                    attributeId: 'name',
                    state: req.session.tempUser.marketingConsents.name ? 1 : 2
                },
                {
                    purposeId: 'MARKETING_COMMUNICATIONS',
                    attributeId: 'email',
                    state: req.session.tempUser.marketingConsents.email ? 1 : 2
                },
                {
                    purposeId: 'MARKETING_COMMUNICATIONS',
                    attributeId: 'mobile_number',
                    state: req.session.tempUser.marketingConsents.mobile ? 1 : 2
                },
                // ITR filing consents
                {
                    purposeId: 'ITR_FILING',
                    attributeId: 'name',
                    state: 1 // Required for ITR filing
                },
                {
                    purposeId: 'ITR_FILING',
                    attributeId: 'email',
                    state: 1 // Required for ITR filing
                },
                {
                    purposeId: 'ITR_FILING',
                    attributeId: 'mobile_number',
                    state: 1 // Required for ITR filing
                },
                {
                    purposeId: 'ITR_FILING',
                    attributeId: 'aadhar_id',
                    state: 1 // Explicitly consented by user
                },
                {
                    purposeId: 'ITR_FILING',
                    attributeId: 'pan_id',
                    state: 1 // Explicitly consented by user
                }
            ];

            console.log('[RegistrationController] Creating consent records:', consents);

            // TODO: Call Privacy API to create these consents
            // await this.privacyService.createConsents(auth, consents);

            // Clear session temp data after successful registration
            req.session.tempUser = null;
            req.session.save();

            console.log('[RegistrationController] Registration complete, redirecting to login');

            // Redirect to login with success message
            // In production, might auto-login the user
            res.redirect('/login?registered=true');

        } catch (error) {
            console.error('[RegistrationController] Step 3 error:', error);
            res.status(500).render('register-step3', {
                title: 'Review Your Information',
                step: 3,
                error: 'An error occurred during registration. Please try again.',
                user: req.session.tempUser
            });
        }
    }

    /**
     * Validation Helpers
     */

    _validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return email && emailRegex.test(email);
    }

    _validatePassword(password) {
        // Min 8 chars, mix of upper, lower, numbers, special chars (optional for demo)
        return password && password.length >= 8;
    }

    _validateMobile(mobile) {
        // Simple validation for 10-digit Indian phone number
        const mobileRegex = /^\d{10}$/;
        return mobile && mobileRegex.test(mobile.replace(/\D/g, ''));
    }

    _validateAadhaar(aadhaar) {
        // Aadhaar is 12 digits
        // In production, use Aadhaar validation algorithm (Verhoef algorithm)
        const aadhaarRegex = /^\d{12}$/;
        return aadhaar && aadhaarRegex.test(aadhaar.replace(/\s/g, ''));
    }

    _validatePAN(pan) {
        // PAN format: 10 alphanumeric, specific pattern
        // Example: ABCDE1234F
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return pan && panRegex.test(pan.toUpperCase());
    }

    /**
     * Masking helpers for display
     */

    _maskAadhaar(aadhaar) {
        if (!aadhaar) return '';
        const clean = aadhaar.replace(/\D/g, '');
        return `${'*'.repeat(8)}${clean.slice(-4)}`;
    }

    _maskPAN(pan) {
        if (!pan) return '';
        const clean = pan.toUpperCase();
        return `${clean.slice(0, 5)}${'*'.repeat(4)}${clean.slice(-1)}`;
    }
}

module.exports = RegistrationController;
