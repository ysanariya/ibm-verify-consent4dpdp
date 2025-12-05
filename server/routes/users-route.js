// import dependencies and initialize the express router
const express = require('express');
const bodyParser = require('body-parser');
const UserController = require('../controllers/users-controller');
const CartController = require('../controllers/cart-controller');
const userController = new UserController();
const cartController = new CartController();

const router = express.Router();
const jsonParser = bodyParser.json();

/**
 * Users Routes - Handle authenticated user pages
 * GET / - Dashboard (renamed from users, shows user info and actions)
 * GET /profile - User profile information
 * GET /consents - User consent management (legacy, will be replaced)
 * POST /consents - Store consent updates (legacy, will be replaced)
 * GET /cart - ITR assessment flow (legacy, will be replaced)
 */

// Dashboard - main authenticated page
router.get('/', userController.getUsersIndex);

// User profile page
router.get('/profile', userController.getProfile);

// Consents page - shows current consent state
router.get('/consents', userController.getConsents);

// Legacy routes - will be refactored or removed
router.post('/consents', jsonParser, cartController.storeConsents);
router.get('/cart', cartController.assess);

module.exports = router;