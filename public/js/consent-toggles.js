/**
 * consent-toggles.js
 * Handles AJAX consent toggle updates and initialization
 * Communicates with backend endpoints:
 *   GET /consent/state - Fetch current consent state
 *   POST /consent/update - Update single consent
 */

const ConsentManager = (() => {
    const API_BASE = '';

    /**
     * Initialize consent manager
     * Fetch current consent state and attach event listeners
     */
    let listenersAttached = false;

    const init = async () => {
        console.log('[ConsentManager] Initializing...');
        
        // Fetch current consent state from server
        try {
            const state = await fetchConsentState();
            console.log('[ConsentManager] Current state:', state);
            // Apply fetched state to all toggles
            applyStateToToggles(state);
        } catch (error) {
            console.error('[ConsentManager] Error fetching initial state:', error);
        }

        // Attach event listeners to all consent toggles (only once)
        const toggles = document.querySelectorAll('.consent-toggle');
        if (!listenersAttached) {
            toggles.forEach(toggle => {
                toggle.addEventListener('change', handleToggleChange);
            });
            listenersAttached = true;
        }

        console.log(`[ConsentManager] Initialized ${toggles.length} consent toggles`);
    };

    /**
     * Apply consent state object to toggle controls on the page
     * @param {Object} state - consentState returned from server
     */
    const applyStateToToggles = (state) => {
        if (!state) return;

        const toggles = document.querySelectorAll('.consent-toggle');
        toggles.forEach(toggle => {
            const purpose = toggle.dataset.purpose;
            const attribute = toggle.dataset.attribute;
            try {
                const val = state[purpose] && state[purpose][attribute];
                toggle.checked = val === true;
            } catch (e) {
                // if anything goes wrong, leave toggle as-is
            }
        });
    };

    /**
     * Fetch current consent state from server
     * Returns: { MARKETING_COMMUNICATIONS: { name: true, ... }, ITR_FILING: { ... } }
     */
    const fetchConsentState = async () => {
        const response = await fetch(`${API_BASE}/consent/state`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.consentState;
    };

    /**
     * Handle consent toggle change
     * Called when user clicks a consent toggle switch
     * Sends update to backend via AJAX
     */
    const handleToggleChange = async (event) => {
        const toggle = event.target;
        const purposeId = toggle.dataset.purpose;
        const attributeId = toggle.dataset.attribute;
        const isChecked = toggle.checked;

        console.log(`[ConsentManager] Toggle changed - Purpose: ${purposeId}, Attribute: ${attributeId}, Checked: ${isChecked}`);

        // Show loading state
        const toggleLabel = toggle.closest('.toggle-switch');
        if (toggleLabel) {
            toggleLabel.style.opacity = '0.6';
            toggleLabel.style.pointerEvents = 'none';
        }

        try {
            // Send update to server
            const response = await fetch(`${API_BASE}/consent/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    purposeId: purposeId,
                    attributeId: attributeId,
                    state: isChecked ? 1 : 2
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Success
                console.log(`[ConsentManager] Consent updated successfully`);
                showToast(`Consent updated for ${attributeId}`, 'success');
            } else {
                // Error from server
                console.error('[ConsentManager] Server error:', data.error);
                showToast(data.error || 'Failed to update consent', 'error');
                // Revert toggle
                toggle.checked = !isChecked;
            }
        } catch (error) {
            // Network error
            console.error('[ConsentManager] Network error:', error);
            showToast('Network error. Please try again.', 'error');
            // Revert toggle
            toggle.checked = !isChecked;
        } finally {
            // Remove loading state
            if (toggleLabel) {
                toggleLabel.style.opacity = '1';
                toggleLabel.style.pointerEvents = 'auto';
            }
        }
    };

    /**
     * Show toast notification
     * @param {String} message - Message to display
     * @param {String} type - Type: 'success', 'error', 'warning', 'info'
     */
    const showToast = (message, type = 'info') => {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast toast-${type}`;
        toast.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    };

    // Public API
    return {
        init: init,
        fetchConsentState: fetchConsentState,
        showToast: showToast
    };
})();

// Export for use in HTML
window.ConsentManager = ConsentManager;

// Ensure the toggles are refreshed when the page is restored from bfcache
window.addEventListener('pageshow', async (event) => {
    try {
        if (window.ConsentManager) {
            const state = await window.ConsentManager.fetchConsentState();
            // apply state without re-attaching listeners
            const toggles = document.querySelectorAll('.consent-toggle');
            toggles.forEach(toggle => {
                const purpose = toggle.dataset.purpose;
                const attribute = toggle.dataset.attribute;
                try {
                    const val = state && state[purpose] && state[purpose][attribute];
                    toggle.checked = val === true;
                } catch (e) {}
            });
        }
    } catch (e) {
        console.error('[ConsentManager] pageshow refresh failed', e);
    }
});
