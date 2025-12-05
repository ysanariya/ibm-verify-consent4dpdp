const PORT = process.env.PORT || 3000;

// Load configuration
const { Config } = require('./controllers/config');

// initialize libraries
const express = require('express');
const session = require('express-session')
const handlebars = require('express-handlebars');
const sessionRoutes = require('./routes/session-route');
const usersRoutes = require('./routes/users-route');

// Load optional routes with error handling
let registrationRoutes, itrRoutes, consentRoutes;
try {
    registrationRoutes = require('./routes/registration-route');
} catch (e) {
    console.warn('[Warning] registration-route.js not found, skipping registration routes');
    registrationRoutes = null;
}

try {
    itrRoutes = require('./routes/itr-route');
} catch (e) {
    console.warn('[Warning] itr-route.js not found, skipping ITR routes');
    itrRoutes = null;
}

try {
    consentRoutes = require('./routes/consent-route');
} catch (e) {
    console.warn('[Warning] consent-route.js not found, skipping consent routes');
    consentRoutes = null;
}

// initialize handlebars
var hbs = handlebars.create({
    helpers: {
        formatPurpose: function(purposeName, version) {
            if (purposeName == 'ibm-oauth-scope') {
                return 'OAuth Scope';
            }

            return `${purposeName} (Version ${version})`
        },
        formatDate: function (badDate) {
            var dMod = new Date(badDate * 1000);
            return dMod.toLocaleDateString();
        },
        formatState: function (state) {
            var stateOpt = {
                1: "Consent allow",
                2: "Consent deny",
                3: "Opt-in",
                4: "Opt-out",
                5: "Transparent"
            }
            return stateOpt[state];
        },
        formatAccessType: function (accessType) {
            if (accessType == "default") {
                return "";
            }
            return accessType;
        },
        formatAttribute: function (attribute) {
            if (attribute == "") {
                return "–";
            }
            else {
                return attribute;
            }
        },
        'json': function(context) {
            return JSON.stringify(context);
        },
        'concat': function(str, suffix) {
            if (typeof str === 'string' && typeof suffix === 'string') {
                return str + suffix;
            }
            return str;
        },
    },
    layoutsDir: __dirname + '/../views/layouts',
    partialsDir: __dirname + '/../views/partials',
    extname: 'hbs',
    defaultLayout: 'default',
});

// initialize the app
const app = express();
app.set('view engine', 'hbs');
app.engine('hbs', hbs.engine)

app.use(session({
    secret: Config.sessionSecret || 'demo-session-secret-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        path: '/', 
        maxAge: 30 * 60 * 1000, 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}))

// define routes
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// define routes
app.use(express.static(__dirname + '/../public'))
app.use('/', sessionRoutes);
app.use('/users', usersRoutes);

// Register optional routes only if they exist
if (registrationRoutes) {
    app.use('/register', registrationRoutes);
}
if (itrRoutes) {
    app.use('/itr', itrRoutes);
}
if (consentRoutes) {
    app.use('/consent', consentRoutes);
}

// Development helper: list all registered routes for easier inspection
if (process.env.NODE_ENV !== 'production') {
    app.get('/__routes', (req, res) => {
        const routes = [];
        app._router.stack.forEach(middleware => {
            if (!middleware.route) return; // skip non-route handlers
            const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());
            routes.push({ path: middleware.route.path, methods });
        });
        res.json({ routes });
    });
}

app.listen(PORT, () => {
    console.log(`Server started and listening on port ${PORT}`);
});