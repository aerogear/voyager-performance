const Datastore = require('nedb');
const fs = require('fs');
const { conflictHandler } = require('@aerogear/voyager-conflicts');
const { pubSub } = require('../../../subscriptions');
const { customResolutionStrategy } = require('../../conflicts');

const { CONFLICTS_RESOLUTION_TYPE } = process.env;

const files = [];

const dbQuery = {
  allTasks: db =>
    new Promise((resolve, reject) => {
      db.find({}, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  getTask: (db, task) =>
    new Promise((resolve, reject) => {
      db.findOne(task, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  createTask: (db, task) =>
    new Promise((resolve, reject) => {
      db.insert(task, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  updateTask: (db, taskToUpdate, updatedTask) =>
    new Promise((resolve, reject) => {
      db.update(taskToUpdate, updatedTask, {}, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  deleteTask: (db, task) =>
    new Promise((resolve, reject) => {
      db.remove(task, {}, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  deleteAllTasks: db =>
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
    allTasks: async (obj, args, context) => {
      const allTasks = await dbQuery.allTasks(context.db);
      return allTasks;
    }
  },
  Mutation: {
    createTask: async (obj, args, context, info) => {
      const allTasks = await dbQuery.allTasks(context.db);
      args.id = allTasks.length + 1;
      args.version = 1;
      await dbQuery.createTask(context.db, args);
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
      const taskToUpdate = await dbQuery.getTask(context.db, { id: args.id });

      if (CONFLICTS_RESOLUTION_TYPE !== undefined) {
        if (conflictHandler.hasConflict(taskToUpdate, args)) {
          if (CONFLICTS_RESOLUTION_TYPE === 'server') {
            const { resolvedState, response } = await conflictHandler.resolveOnServer(
              customResolutionStrategy,
              taskToUpdate,
              args
            );
            await dbQuery.updateTask(context.db, taskToUpdate, resolvedState);
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
      await dbQuery.updateTask(context.db, taskToUpdate, args);
      return args;
    },
    deleteTask: async (obj, clientData, context, info) => {
      const id = Number(clientData.id);
      await dbQuery.deleteTask(context.db, { id });
      return id;
    },
    deleteAllTasks: async (obj, clientData, context) => {
      await dbQuery.deleteAllTasks(context.db);
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
  return new Datastore();
}

module.exports = {
  resolvers,
  connect
};
