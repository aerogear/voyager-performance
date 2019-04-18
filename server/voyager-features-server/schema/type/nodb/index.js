const fs = require('fs');
const { pubSub } = require('../../../subscriptions');
const { conflictHandler } = require('@aerogear/voyager-conflicts');
const { customResolutionStrategy } = require('../../conflicts');

const { CONFLICTS_RESOLUTION_TYPE } = process.env;

let tasks = [];
let files;

// Create the resolvers for your schema
const resolvers = {
  Query: {
    hello: () => `Hello world`,
    uploads: () => files,
    allTasks: () => tasks.map((task, index) => ({ ...task, id: index.toString() }))
  },
  Mutation: {
    createTask: async (obj, args, context, info) => {
      args.version = 1;
      tasks.push(args);
      const result = {
        ...args,
        id: (tasks.length - 1).toString()
      };
      pubSub.publish('taskCreated', {
        taskCreated: result
      });
      return result;
    },
    updateTask: async (obj, clientData, context, info) => {
      const args = {
        id: clientData.id,
        title: clientData.title,
        description: clientData.description,
        version: clientData.version
      };
      const id = Number(clientData.id);
      const task = { ...tasks[id], id: clientData.id };

      if (CONFLICTS_RESOLUTION_TYPE !== undefined) {
        if (conflictHandler.hasConflict(task, args)) {
          if (CONFLICTS_RESOLUTION_TYPE === 'server') {
            const { resolvedState, response } = await conflictHandler.resolveOnServer(
              customResolutionStrategy,
              task,
              args
            );
            delete resolvedState.id;
            tasks[id] = resolvedState;
            return response;
          }

          if (CONFLICTS_RESOLUTION_TYPE === 'client') {
            const { response } = conflictHandler.resolveOnClient(task, args);
            return response;
          }
        }
        conflictHandler.nextState(args);
      }
      // 4. Persist the update to the database and return it to the client
      tasks[id] = { ...args };
      delete tasks[id].id;

      return args;
    },
    deleteTask: async (obj, clientData, context, info) => {
      const id = Number(clientData.id);
      delete tasks[id];
      return id;
    },
    deleteAllTasks: async () => {
      tasks = [];
      return 'All tasks are successfully deleted';
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
  }
};

async function connect() {
  return null;
}

module.exports = {
  resolvers,
  connect
};
