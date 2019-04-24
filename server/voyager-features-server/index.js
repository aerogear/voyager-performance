const { AUDIT_LOGGING_ENABLED } = process.env;
const { KEYCLOAK_ENABLED } = process.env;
const { METRICS_ENABLED } = process.env;
const { DB_STORAGE_TYPE } = process.env;

const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const cors = require('cors');

// Include our server libraries
const { VoyagerServer } = require('@aerogear/voyager-server');
const { KeycloakSecurityService } = require('@aerogear/voyager-keycloak');

const keycloakConfigPath = process.env.KEYCLOAK_CONFIG || path.resolve(__dirname, './keycloak.json');

const { subscriptionServer } = require('./subscriptions');
const { typeDefs } = require('./schema');

let connect;
let resolvers;
let auditLogger;
let metrics;
let keycloakService;

if (DB_STORAGE_TYPE === 'postgres') {
  console.log('Postgres DB is used for storing data.');
  ({ resolvers, connect } = require('./schema').postgres);
} else if (DB_STORAGE_TYPE === 'mongodb') {
  console.log('MongoDB is used for storing data.');
  ({ resolvers, connect } = require('./schema').mongodb);
} else if (DB_STORAGE_TYPE === 'nedb') {
  console.log('NeDB is used for storing data.');
  ({ resolvers, connect } = require('./schema').nedb);
} else {
  console.log('No DB is used for storing data.');
  ({ resolvers, connect } = require('./schema').nodb);
}

if (AUDIT_LOGGING_ENABLED === 'true') {
  auditLogger = require('@aerogear/voyager-audit');
  console.log('Audit logging is enabled');
}

if (METRICS_ENABLED === 'true') {
  metrics = require('@aerogear/voyager-metrics');
  console.log('Metrics is enabled');
}

function readConfig(pathToConfig) {
  try {
    return JSON.parse(fs.readFileSync(pathToConfig, 'utf8'));
  } catch (e) {
    console.error(`Warning: couldn't find config at ${pathToConfig}`);
  }
  return null;
}

async function start() {
  // Connect the server to express
  const app = express();
  app.use(cors({ credentials: true }));
  const client = await connect();

  // Initialize the library with your Graphql information
  const server = VoyagerServer(
    {
      typeDefs,
      resolvers,
      context: async ({ req }) => ({
        req,
        db: client
      })
    },
    {
      securityService: keycloakService,
      metrics,
      auditLogger
    }
  );

  if (metrics) {
    metrics.applyMetricsMiddlewares(app, { path: '/metrics' });
  }

  if (KEYCLOAK_ENABLED === 'true') {
    console.log('Keycloak is enabled');
    const keycloakConfig = readConfig(keycloakConfigPath);
    if (keycloakConfig) {
      keycloakService = new KeycloakSecurityService(keycloakConfig);
      keycloakService.applyAuthMiddleware(app, { tokenEndpoint: true });
    }
  }

  server.applyMiddleware({ app });

  const httpServer = http.createServer(app);
  httpServer.listen(4000, () => {
    subscriptionServer(keycloakService, httpServer, server);
    console.log(`🚀 Server ready at http://localhost:4000/graphql`);
  });
}
start();
