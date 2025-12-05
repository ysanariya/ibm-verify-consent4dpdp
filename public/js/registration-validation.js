/**
 * registration-validation.js
 * Client-side validation for registration form
 * Validates email, mobile, passwords, Aadhaar, PAN formats
 */

const RegistrationValidator = (() => {
    
    /**
     * Step 1 Validation
     */
    const validateStep1 = () => {
        const form = document.getElementById('registrationForm');
        if (!form) return;

        const fullName = document.getElementById('fullName');
        const email = document.getElementById('email');
        const mobile = document.getElementById('mobile');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');

        // Real-time validation on blur
        if (fullName) fullName.addEventListener('blur', () => validateName(fullName));
        if (email) email.addEventListener('blur', () => validateEmail(email));
        if (mobile) mobile.addEventListener('blur', () => validateMobile(mobile));
        if (password) password.addEventListener('blur', () => validatePassword(password));
        if (confirmPassword) confirmPassword.addEventListener('blur', () => validatePasswordMatch(password, confirmPassword));

        // Form submit validation
        form.addEventListener('submit', (e) => {
            if (!isStep1Valid(fullName, email, mobile, password, confirmPassword)) {
                e.preventDefault();
            }
        });
    };

    const isStep1Valid = (fullName, email, mobile, password, confirmPassword) => {
        let valid = true;

        if (!validateName(fullName)) valid = false;
        if (!validateEmail(email)) valid = false;
        if (!validateMobile(mobile)) valid = false;
        if (!validatePassword(password)) valid = false;
        if (!validatePasswordMatch(password, confirmPassword)) valid = false;

        return valid;
    };

    const validateName = (input) => {
        const value = input.value.trim();
        if (value.length < 2) {
            showError(input, 'Full name must be at least 2 characters');
            return false;
        }
        clearError(input);
        return true;
    };

    const validateEmail = (input) => {
        const value = input.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            showError(input, 'Please enter a valid email address');
            return false;
        }
        clearError(input);
        return true;
    };

    const validateMobile = (input) => {
        const value = input.value.replace(/\D/g, '');
        if (value.length !== 10) {
            showError(input, 'Mobile number must be 10 digits');
            return false;
        }
        clearError(input);
        return true;
    };

    const validatePassword = (input) => {
        const value = input.value;
        if (value.length < 8) {
            showError(input, 'Password must be at least 8 characters');
            return false;
        }
        clearError(input);
        return true;
    };

    const validatePasswordMatch = (pwd, confirmPwd) => {
        if (pwd.value !== confirmPwd.value) {
            showError(confirmPwd, 'Passwords do not match');
            return false;
        }
        clearError(confirmPwd);
        return true;
    };

    /**
     * Step 2 Validation
     */
    const validateStep2 = () => {
        const form = document.getElementById('step2Form');
        if (!form) return;

        const aadhaar = document.getElementById('aadhaar');
        const pan = document.getElementById('pan');

        // Real-time validation
        if (aadhaar) aadhaar.addEventListener('blur', () => validateAadhaar(aadhaar));
        if (pan) pan.addEventListener('blur', () => validatePAN(pan));

        // Auto-format input
        if (aadhaar) {
            aadhaar.addEventListener('input', (e) => {
                e.target.value = formatAadhaar(e.target.value);
            });
        }

        if (pan) {
            pan.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }

        form.addEventListener('submit', (e) => {
            if (!isStep2Valid(aadhaar, pan)) {
                e.preventDefault();
            }
        });
    };

    const isStep2Valid = (aadhaar, pan) => {
        let valid = true;

        if (!validateAadhaar(aadhaar)) valid = false;
        if (!validatePAN(pan)) valid = false;

        return valid;
    };

    const validateAadhaar = (input) => {
        const value = input.value.replace(/\s/g, '');
        const aadhaarRegex = /^\d{12}$/;
        
        if (!aadhaarRegex.test(value)) {
            showError(input, 'Aadhaar must be 12 digits');
            return false;
        }
        clearError(input);
        return true;
    };

    const validatePAN = (input) => {
        const value = input.value.toUpperCase();
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        
        if (!panRegex.test(value)) {
            showError(input, 'PAN format: ABCDE1234F (5 letters, 4 digits, 1 letter)');
            return false;
        }
        clearError(input);
        return true;
    };

    const formatAadhaar = (value) => {
        // Remove non-digits and format as XXXX XXXX XXXX
        const clean = value.replace(/\D/g, '').substring(0, 12);
        return clean
            .replace(/(\d{4})/g, '$1 ')
            .trim();
    };

    /**
     * Step 3 Validation
     */
    const validateStep3 = () => {
        const form = document.getElementById('step3Form');
        if (!form) return;

        const aadhaarConsent = document.getElementById('aadhaarConsent');
        const panConsent = document.getElementById('panConsent');

        form.addEventListener('submit', (e) => {
            if (!aadhaarConsent.checked) {
                showError(aadhaarConsent, 'Aadhaar consent is required');
                e.preventDefault();
            } else {
                clearError(aadhaarConsent);
            }

            if (!panConsent.checked) {
                showError(panConsent, 'PAN consent is required');
                e.preventDefault();
            } else {
                clearError(panConsent);
            }
        });
    };

    /**
     * UI Helpers
     */
    const showError = (input, message) => {
        input.classList.add('invalid');
        input.classList.remove('valid');
        
        const errorElement = document.getElementById(`${input.id}Error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    };

    const clearError = (input) => {
        input.classList.remove('invalid');
        input.classList.add('valid');
        
        const errorElement = document.getElementById(`${input.id}Error`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('show');
        }
    };

    // Public API
    return {
        validateStep1: validateStep1,
        validateStep2: validateStep2,
        validateStep3: validateStep3
    };
})();

// Export for use in HTML
window.RegistrationValidator = RegistrationValidator;
