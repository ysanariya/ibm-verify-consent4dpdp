# myITReturn Demo - DPDP-Compliant ITR Filing with IBM Verify

A demonstration application showcasing **Digital Personal Data Protection (DPDP) Act, 2023** compliance through secure, consent-driven Income Tax Return (ITR) filing. Built with Node.js, IBM Security Verify OIDC authentication, and the Verify Privacy SDK.

## Overview

This application demonstrates how to build a modern, privacy-first web application that:

- **Complies with DPDP regulations** - Explicit consent capture, transparent data usage, user control
- **Integrates IBM Security Verify** - Enterprise-grade identity management and consent handling
- **Manages user consents** - Purpose-based consent for different data uses
- **Implements secure registration** - Multi-step registration with tax identity verification
- **Files ITR securely** - Gated behind proper consent checks
- **Audits all operations** - Consent changes logged for transparency

### Key Features

✓ **OpenID Connect (OIDC) Authentication** - Users authenticate securely with IBM Verify  
✓ **Multi-Step Registration** - Account → Tax ID → Consent Confirmation  
✓ **Consent Management** - Users can grant/revoke consent for marketing and ITR filing  
✓ **ITR Filing Gating** - ITR filing only allowed when all required consents are granted  
✓ **Responsive UI** - Modern, clean design compatible with desktop and mobile  
✓ **DPDP Notices** - Privacy notices displayed during registration and consent changes  

## Architecture

```
┌─────────────┐        ┌──────────────────┐        ┌──────────────┐
│   Browser   │◄──────►│   Node.js App    │◄──────►│ IBM Verify   │
│  (User UI)  │        │  (Express.js)    │        │  (OIDC + API)│
└─────────────┘        └──────────────────┘        └──────────────┘
      │                        │                          │
      │  Register/Login        │  Create User             │
      │◄───────────────────────│─ (SCIM API)─────────────►│
      │                        │                          │
      │  File ITR              │  Check Consents          │
      │◄───────────────────────│─ (Privacy API)──────────►│
      │                        │                          │
      │  Update Consent        │  Store Consent           │
      │◄───────────────────────│─ (Privacy API)──────────►│
      │                        │                          │
```

## Prerequisites

- **Node.js** (v14+) and npm
- **IBM Verify Tenant** - [Sign up for free trial](https://docs.verify.ibm.com/verify/docs/signing-up-for-a-free-trial)
- **Git** for cloning this repository
- Modern web browser (Chrome, Firefox, Safari, Edge)

## IBM Verify Configuration

### Step 1: Create Custom Attributes

1. Login to IBM Verify admin console: `https://your-tenant.verify.ibm.com/ui/admin`

2. Navigate to **Configuration → Attributes**

3. Create the following custom attributes:

| Attribute ID | Display Name | Type |
|---|---|---|
| `mobile_number` | Mobile Number | String |
| `aadhar_id` | Aadhaar Number | String (masked) |
| `pan_id` | PAN Number | String |

### Step 2: Create Purposes

1. Navigate to **Data Privacy & Consent → Purposes**

2. **Create Purpose 1: Marketing Communications**
   - **ID:** `MARKETING_COMMUNICATIONS`
   - **Name:** Marketing Communications
   - **Description:** Send marketing emails and SMS notifications
   - **Linked Attributes:** name, email, mobile_number
   - **Access Type:** default
   - Click **Save**

3. **Create Purpose 2: ITR Filing**
   - **ID:** `ITR_FILING`
   - **Name:** ITR Filing Services
   - **Description:** Use personal data for income tax return filing
   - **Linked Attributes:** name, email, mobile_number, aadhar_id, pan_id
   - **Access Type:** default
   - Click **Save**

### Step 3: Create OIDC Application

1. Navigate to **Applications** in the admin console

2. Click **Add Application** and select **OpenID Connect**

3. Fill in:
   - **Application Name:** myITReturn Demo
   - **Application URL:** `http://localhost:3000` (or your domain)
   - **Grant Type:** Authorization Code
   - **PKCE:** Uncheck "Require proof key for code exchange"

4. In the **Sign On** tab, add **Redirect URI:** `http://localhost:3000/auth/callback`

5. In **API Access**, enable and grant these permissions:
   - ☑ Check for data usage approval
   - ☑ Create privacy consent records
   - ☑ Manage your privacy consents
   - ☑ Read your privacy consents
   - ☑ Retrieve privacy purposes and associated user's consent

6. In **Entitlements**, set **Automatic access for all users and groups**

7. In **Privacy**, add both purposes: `MARKETING_COMMUNICATIONS` and `ITR_FILING`

8. **Save** the application

9. Copy the **Client ID** and **Client Secret** (you'll need these)

### Step 4: Create API Client (for backend)

1. Navigate to **Integration → API Clients**

2. Click **Add API Client** and enter:
   - **Client Name:** myITReturn API
   - **Client Type:** Confidential

3. Grant the same permissions as above

4. Copy the **Client ID** and **Client Secret**

## Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/vivshankar/dune-privacy-demo.git
cd dune-privacy-demo
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in values from IBM Verify:

```dotenv
# OIDC Configuration
VERIFY_TENANT_URL=https://your-tenant.verify.ibm.com
VERIFY_DISCOVERY_URL=https://your-tenant.verify.ibm.com/oidc/.well-known/openid-configuration
VERIFY_OIDC_CLIENT_ID=<your-oidc-client-id>
VERIFY_OIDC_CLIENT_SECRET=<your-oidc-client-secret>
VERIFY_OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
VERIFY_OIDC_SCOPE=openid profile email

# API Client Configuration (for backend operations)
VERIFY_API_CLIENT_ID=<your-api-client-id>
VERIFY_API_CLIENT_SECRET=<your-api-client-secret>
VERIFY_PRIVACY_BASE_URL=https://your-tenant.verify.ibm.com

# Application Settings
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=your-random-secret-key-here
PORT=3000
NODE_ENV=development
```

### 3. Run the Application

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Server will start on `http://localhost:3000`

## User Workflows

### Registration Flow (3 Steps)

**Step 1: Account Information**
- User enters: Full Name, Email, Mobile Number, Password
- **Consent Capture:** Explicit toggles for marketing communications and ITR filing
- DPDP notices displayed explaining data usage

**Step 2: Tax Identity**
- User enters: Aadhaar Number (12 digits), PAN Number (10 alphanumeric)
- Format validation with helpful error messages
- **Security Note:** Demo stores in session only; production would encrypt

**Step 3: Confirmation**
- Review all entered information
- **Explicit consent required:** Must check boxes for Aadhaar and PAN use
- Creates user in Verify + stores consent records

**After Registration:** Redirects to login page

### ITR Filing Flow

1. User logs in to dashboard
2. Clicks "File ITR" button
3. **Consent Check:** Backend validates all required consents are granted
   - ✓ Name, Email, Mobile (basic info)
   - ✓ Aadhaar & PAN (tax identity)
4. **If all consents granted:** Show success page with reference ID
5. **If consents missing:** Redirect to consent management page

### Consent Management

- **URL:** `/consent/management`
- **Layout:** Two-column design
  - Left: Marketing Communications toggles
  - Right: ITR Filing toggles
- **Real-time Updates:** AJAX calls to `/consent/update`
- **DPDP Notices:** Purpose descriptions and attribute details

## Project Structure

```
dune-privacy-demo/
├── server/
│   ├── server.js                    # Express app initialization
│   ├── controllers/
│   │   ├── config.js                # Configuration loader
│   │   ├── oauth-controller.js      # OIDC authentication (login/logout)
│   │   ├── users-controller.js      # Dashboard and profile views
│   │   ├── privacy-service.js       # Privacy API wrapper
│   │   ├── registration-controller.js  # Multi-step registration
│   │   ├── itr-controller.js        # ITR filing logic
│   │   └── consent-controller.js    # Consent management
│   └── routes/
│       ├── session-route.js         # Auth routes (login/logout)
│       ├── users-route.js           # Dashboard routes
│       ├── registration-route.js    # Registration flow
│       ├── itr-route.js             # ITR filing
│       └── consent-route.js         # Consent management
├── views/
│   ├── layouts/
│   │   └── default.hbs              # Main layout (nav, footer)
│   ├── landing.hbs                  # Landing page with pricing
│   ├── register-step1.hbs           # Account info + marketing consents
│   ├── register-step2.hbs           # Tax identity (Aadhaar, PAN)
│   ├── register-step3.hbs           # Confirmation + explicit consent
│   ├── dashboard.hbs                # Post-login dashboard
│   ├── consent-management.hbs       # Two-column consent toggles
│   ├── itr-success.hbs              # ITR filing success
│   └── itr-blocked.hbs              # Consent required banner
├── public/
│   ├── styles/
│   │   └── main.css                 # Modern design system
│   └── js/
│       ├── consent-toggles.js       # AJAX consent updates
│       └── registration-validation.js # Client-side validation
├── .env.example                     # Environment template
├── package.json                     # Dependencies
└── README.md                        # This file
```

## Key Technologies

- **Backend:** Express.js, Node.js
- **Frontend:** Handlebars templating, vanilla JavaScript, modern CSS
- **Authentication:** OpenID Connect (via openid-client library)
- **Consent Management:** IBM Verify Privacy API
- **Session Management:** express-session
- **HTTP Parsing:** body-parser

## API Endpoints

### Authentication Routes
- `GET /login` - Initiate OIDC login
- `GET /auth/callback` - OIDC callback handler
- `GET /logout` - Clear session and logout

### Registration Routes
- `GET /register/step1` - Account info form
- `POST /register/step1` - Submit step 1
- `GET /register/step2` - Tax identity form
- `POST /register/step2` - Submit step 2
- `GET /register/step3` - Confirmation form
- `POST /register/step3` - Complete registration

### Dashboard Routes
- `GET /users` - Dashboard (requires auth)
- `GET /users/profile` - User profile

### ITR Filing Routes
- `POST /itr/assess` - Check consents and file ITR
- `GET /itr/success` - Filing success page
- `GET /itr/blocked` - Consent required page

### Consent Management Routes
- `GET /consent/management` - Consent management UI
- `GET /consent/state` - Get current consent state (JSON)
- `POST /consent/update` - Update consent (AJAX)

## DPDP Compliance

This application demonstrates DPDP Act, 2023 compliance in several ways:

### Consent Management
- **Explicit Consent:** Users must actively grant consent (no pre-checked boxes)
- **Granular Control:** Separate toggles for each attribute and purpose
- **Withdrawal:** Users can withdraw consent anytime

### Transparency
- **Privacy Notices:** Clear notices explain what data is used and why
- **Purpose Linking:** Consents explicitly tied to purposes (marketing vs. ITR filing)
- **Data Control:** Users can see and change their consent preferences

### Security
- **Encrypted Transport:** All communication uses HTTPS in production
- **Session Security:** Session tokens encrypted, httpOnly cookies
- **API Authentication:** OAuth token validation on all protected endpoints

### Audit & Accountability
- **Logging:** Consent changes logged with timestamps
- **Record Keeping:** Consent records maintained in Verify
- **DPO Contact:** Data Protection Officer contact provided in footer

## Limitations & Next Steps

This is a **demonstration application**. Production deployments should:

### Security
- [ ] Use HTTPS everywhere (set `secure: true` for cookies in production)
- [ ] Implement CSRF protection
- [ ] Add rate limiting and brute force protection
- [ ] Encrypt sensitive data in transit and at rest
- [ ] Regular security audits and penetration testing

### Data Handling
- [ ] Encrypt Aadhaar and PAN before storing (currently session-only for demo)
- [ ] Implement proper data retention policies
- [ ] Integrate with actual ITR filing service (TDS, income tax authority APIs)
- [ ] Add audit logging for all data access

### Compliance
- [ ] Conduct DPDP impact assessment
- [ ] Document data flows and retention periods
- [ ] Implement data subject rights (access, deletion, portability)
- [ ] Set up Breach Notification process

### Operations
- [ ] Add comprehensive error handling and monitoring
- [ ] Implement request logging and tracing
- [ ] Set up alerting for security events
- [ ] Automate testing and deployment

## Troubleshooting

### "Cannot find module 'verify-privacy-sdk-js'"
This SDK is hosted on GitHub. Ensure you can access GitHub or update the dependency in `package.json`.

### OIDC Discovery Fails
- Verify the `VERIFY_DISCOVERY_URL` is correct
- Check that the tenant is accessible from your network
- Verify credentials are correct in `.env`

### Consent Not Saving
- Verify `VERIFY_API_CLIENT_ID` and `VERIFY_API_CLIENT_SECRET` are correct
- Check that the API client has the required permissions
- Look for error logs in console

### User Not Logging In
- Clear browser cookies and session storage
- Verify OIDC application redirect URI matches exactly
- Check OIDC client ID and secret are correct
- Review IBM Verify logs for authentication failures

## Support & Resources

- **IBM Verify Documentation:** https://docs.verify.ibm.com/
- **DPDP Act, 2023:** https://www.meity.gov.in/
- **OAuth 2.0 & OIDC:** https://openid.net/
- **Project Repository:** https://github.com/vivshankar/dune-privacy-demo

## License

Apache License 2.0 - See LICENSE file for details

## Authors & Contributors

- Original concept: Privacy-aware OAuth and consent management
- DPDP Enhancement: ITR filing demo with DPDP compliance
- IBM Verify Integration: Enterprise identity and consent platform

---

**Disclaimer:** This is a demonstration application. It is not production-ready and should not be used to handle real personal data without significant security hardening and compliance review.

