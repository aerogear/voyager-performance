const express = require('express')
const fs = require('fs');
const http = require('http')
const path = require('path');
const cors = require('cors')
const { PubSub } = require('graphql-subscriptions');
const { SubscriptionServer } = require('subscriptions-transport-ws')
const { execute, subscribe } = require('graphql');
//Include our server libraries
const { VoyagerServer, gql } = require('@aerogear/voyager-server')
const { conflictHandler, strategies } = require('@aerogear/voyager-conflicts')
const { KeycloakSecurityService } = require('@aerogear/voyager-keycloak')

const keycloakConfigPath = process.env.KEYCLOAK_CONFIG || path.resolve(__dirname, './keycloak.json')

let auditLogger, metrics, keycloakService;

const AUDIT_LOGGING_ENABLED = process.env.AUDIT_LOGGING_ENABLED
const CONFLICTS_RESOLUTION_TYPE = process.env.CONFLICTS_RESOLUTION_TYPE
const KEYCLOAK_ENABLED = process.env.KEYCLOAK_ENABLED
const METRICS_ENABLED = process.env.METRICS_ENABLED

if (AUDIT_LOGGING_ENABLED === "true") {
    auditLogger = require('@aerogear/voyager-audit')
    console.log("Audit logging is enabled")
}

if (METRICS_ENABLED === "true") {
    metrics = require('@aerogear/voyager-metrics')
    console.log("Metrics is enabled")
}

function readConfig(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
  } catch (e) {
    console.error(`Warning: couldn't find config at ${path}`)
  }
}

const pubSub = new PubSub();

//Provide your graphql schema
const typeDefs = gql`
  type Query {
    hello: String
    uploads: [File]
    getTasks: [Task]
  }
  type Mutation {
    createTask(title: String!): Task
    updateTask(id: ID!, title: String!, version: Int!): Task
    singleUpload(file: Upload!): File!
  }
  type File {
    filename: String!
    mimetype: String!
    encoding: String!
  }
  type Task {
    id: ID
    title: String
    version: Int
  }
  type Subscription {
    taskCreated: Task
  }
`

const tasks = [{
  title: 'aaa',
  version: 1
}];

const files = [];

function customResolutionStrategy(serverState, clientState) {
  return {
    id: clientState.id,
    title: `updated after conflict. title: ${clientState.title}`
  }
}

//Create the resolvers for your schema
const resolvers = {
  Query: {
    hello: (obj, args, context, info) => {
      return `Hello world`
    },
    uploads: (obj, args, context, info) => {
      return files
    },
    getTasks: (obj, args, context, info) => {
      return tasks.map((task, index) => ({...task, id: index.toString()}))
    },
  },
  Mutation: {
    createTask: async (obj, args, context, info) => {
      args.version = 1;
      tasks.push(args)
      const result = {
        ...args,
        id: (tasks.length - 1).toString()
      };
      pubSub.publish('taskCreated', {
          taskCreated: result
        });
      return result
    },
    updateTask: async (obj, clientData, context, info) => {
      const args = {
        id: clientData.id,
        title: clientData.title,
        version: clientData.version
      }
      const id = Number(clientData.id)
      const task = { ...tasks[id], id: clientData.id };

      if (CONFLICTS_RESOLUTION_TYPE !== undefined) {
        if (conflictHandler.hasConflict(task, args)) {
          if (CONFLICTS_RESOLUTION_TYPE === "server") {
            const { resolvedState, response } = await conflictHandler.resolveOnServer(customResolutionStrategy, task, args)
            tasks[id] = resolvedState;
            delete tasks[id].id;
            return response
          }

          if (CONFLICTS_RESOLUTION_TYPE === "client") {
            const { response } = conflictHandler.resolveOnClient(task, args)
            return response
          }
        }
        conflictHandler.nextState(args)
      }
      // 4. Persist the update to the database and return it to the client
      tasks[id] = { ...args };
      delete tasks[id].id;
  
      return args;
    },
    singleUpload: async (parent, { file }) => {
      const { stream, filename, mimetype, encoding } = await file;
      // Save file and return required metadata
      const writeStream = fs.createWriteStream(filename);
      stream.pipe(writeStream);
      const fileRecord = {
        filename,
        mimetype,
        encoding
      };
      files.push(fileRecord);
      return fileRecord;
    }
  },
  Subscription: {
    taskCreated: {
        subscribe: () => pubSub.asyncIterator('taskCreated')
    }
  },
}

//Connect the server to express
const app = express()
app.use(cors({credentials: true}))

//Initialize the library with your Graphql information
const server = VoyagerServer({
  typeDefs,
  resolvers
}, {
  securityService: keycloakService,
  metrics,
  auditLogger
})

server.applyMiddleware({ app })

if (metrics) {
    metrics.applyMetricsMiddlewares(app, { path: '/metrics' })
}

if (KEYCLOAK_ENABLED === "true") {
    console.log("Keycloak is enabled")
    const keycloakConfig = readConfig(keycloakConfigPath)
    if (keycloakConfig) {
        keycloakService = new KeycloakSecurityService(keycloakConfig)
        keycloakService.applyAuthMiddleware(app, { tokenEndpoint: true })
    }
}

const httpServer = http.createServer(app)

httpServer.listen(4000, () => {
  new SubscriptionServer ({
    execute,
    subscribe,
    onConnect: async connectionParams => {
      if (keycloakService) {
        return await keycloakService.validateToken(connectionParams)
      } else {
        return true;
      }
    },
    schema: server.schema
  }, {
    server: httpServer,
    path: '/graphql'
  })
  console.log(`🚀 Server ready at http://localhost:4000/graphql`)
})