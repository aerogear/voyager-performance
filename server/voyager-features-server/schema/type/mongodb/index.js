const { MongoClient } = require('mongodb');
const fs = require('fs');
const { conflictHandler } = require('@aerogear/voyager-conflicts');
const { pubSub } = require('../../../subscriptions');
const { customResolutionStrategy } = require('../../conflicts');

const { CONFLICTS_RESOLUTION_TYPE } = process.env;

const files = [];

const opt = {
  database: process.env.DB_NAME || 'tasks',
  user: process.env.MONGODB_USER || 'test',
  password: process.env.MONGODB_PASSWORD || 'test',
  host: process.env.DB_HOSTNAME || '127.0.0.1',
  port: process.env.DB_PORT || '27017'
};

async function connect() {
  const MONGO_URL = `mongodb://${opt.user}:${opt.password}@${opt.host}:${opt.port}/${opt.database}`;
  const db = await MongoClient.connect(MONGO_URL, { useNewUrlParser: true }).then(client => client.db('tasks'));
  return db.collection('tasks');
}

const dbQuery = {
  allTasks: db =>
    new Promise((resolve, reject) => {
      db.find({}).toArray((err, doc) => {
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
      db.insertOne(task, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  updateTask: (db, taskToUpdate, updatedTask) =>
    new Promise((resolve, reject) => {
      updatedTask = { $set: updatedTask };
      db.updateOne(taskToUpdate, updatedTask, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  deleteTask: (db, task) =>
    new Promise((resolve, reject) => {
      db.deleteOne(task, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    }),
  deleteAllTasks: db =>
    new Promise((resolve, reject) => {
      db.deleteMany({}, (err, doc) => {
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

module.exports = {
  resolvers,
  connect
};
