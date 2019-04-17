const Datastore = require('nedb');
const fs = require('fs');
const { gql } = require('@aerogear/voyager-server');
const { conflictHandler } = require('@aerogear/voyager-conflicts');
const { pubSub } = require('../../subscriptions');

const db = new Datastore();
const { CONFLICTS_RESOLUTION_TYPE } = process.env;

const files = [];

function customResolutionStrategy(serverState, clientState) {
  return {
    id: clientState.id,
    title: `updated after conflict. title: ${serverState.title}-${clientState.title}`
  };
}

const typeDefs = gql`
  type Query {
    hello: String
    uploads: [File]
    allTasks: [Task]
  }
  type Mutation {
    createTask(title: String!, description: String): Task
    updateTask(id: ID!, title: String!, description: String, version: Int!): Task
    singleUpload(file: Upload!): File!
    deleteTask(id: ID!): ID
    deleteAllTasks: String
  }
  type File {
    filename: String!
    mimetype: String!
    encoding: String!
  }
  type Task {
    id: ID
    title: String
    description: String
    version: Int
  }
  type Subscription {
    taskCreated: Task
  }
`;

const dbQuery = {
  allTasks: () =>
    new Promise((resolve, reject) => {
      db.find({}, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  getTask: task =>
    new Promise((resolve, reject) => {
      db.findOne(task, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  createTask: task =>
    new Promise((resolve, reject) => {
      db.insert(task, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  updateTask: (taskToUpdate, updatedTask) =>
    new Promise((resolve, reject) => {
      db.update(taskToUpdate, updatedTask, {}, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  deleteTask: task =>
    new Promise((resolve, reject) => {
      db.remove(task, {}, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  deleteAllTasks: () =>
    new Promise((resolve, reject) => {
      db.remove({}, { multi: true }, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    })
};
// Create the resolvers for your schema
const resolvers = {
  Query: {
    hello: () => `Hello world`,
    uploads: () => files,
    allTasks: async () => {
      const allTasks = await dbQuery.allTasks();
      return allTasks;
    }
  },
  Mutation: {
    createTask: async (obj, args, context, info) => {
      const allTasks = await dbQuery.allTasks();
      args.id = allTasks.length;
      args.version = 1;
      await dbQuery.createTask(args);
      const result = {
        ...args,
        id: args.id.toString()
      };
      pubSub.publish('taskCreated', {
        taskCreated: result
      });
      return result;
    },
    updateTask: async (obj, clientData, context, info) => {
      const args = {
        id: Number(clientData.id),
        title: clientData.title,
        description: clientData.description,
        version: clientData.version
      };
      const taskToUpdate = await dbQuery.getTask({ id: args.id });

      if (CONFLICTS_RESOLUTION_TYPE !== undefined) {
        if (conflictHandler.hasConflict(taskToUpdate, args)) {
          if (CONFLICTS_RESOLUTION_TYPE === 'server') {
            const { resolvedState, response } = await conflictHandler.resolveOnServer(
              customResolutionStrategy,
              taskToUpdate,
              args
            );
            await dbQuery.updateTask(taskToUpdate, resolvedState);
            return response;
          }

          if (CONFLICTS_RESOLUTION_TYPE === 'client') {
            const { response } = conflictHandler.resolveOnClient(taskToUpdate, args);
            return response;
          }
        }
        conflictHandler.nextState(args);
      }
      // Persist the update to the database and return it to the client
      await dbQuery.updateTask(taskToUpdate, args);
      return args;
    },
    deleteTask: async (obj, clientData, context, info) => {
      const id = Number(clientData.id);
      await dbQuery.deleteTask({ id });
      return id;
    },
    deleteAllTasks: async () => {
      await dbQuery.deleteAllTasks();
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

module.exports = {
  resolvers,
  typeDefs
};
