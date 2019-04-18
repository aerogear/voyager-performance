const knex = require('knex');
const { pubSub } = require('../../../subscriptions');
const { conflictHandler } = require('@aerogear/voyager-conflicts');
const { customResolutionStrategy } = require('../../conflicts');

const { CONFLICTS_RESOLUTION_TYPE } = process.env;

const options = {
  database: process.env.DB_NAME || 'tasks',
  user: process.env.DB_USERNAME || 'test',
  password: process.env.DB_PASSWORD || 'test',
  host: process.env.DB_HOSTNAME || '127.0.0.1',
  port: process.env.DB_PORT || '5432'
};

async function createTasksTables(db) {
  const tasksExists = await db.schema.hasTable('tasks');
  if (!tasksExists) {
    await db.schema.createTable('tasks', table => {
      table.string('title');
      table.string('description');
      table.integer('version');
      table.increments('id');
    });
  }
}

async function connect() {
  const db = knex({
    client: 'pg',
    connection: options
  });
  await createTasksTables(db);
  return db;
}

const resolvers = {
  Query: {
    allTasks: async (obj, args, context) => {
      const result = context.db.select().from('tasks');
      if (args.first && args.after) {
        result.limit(args.first);
        result.offset(args.after);
      } else if (args.first) {
        result.limit(args.first);
      }
      return result;
    }
    // getTask: async (obj, args, context, info) => {
    //   const result = await context.db
    //     .select()
    //     .from('tasks')
    //     .where('id', args.id)
    //     .then(rows => rows[0]);
    //   return result;
    // }
  },

  Mutation: {
    createTask: async (obj, args, context, info) => {
      const result = await context
        .db('tasks')
        .insert({
          ...args,
          version: 1
        })
        .returning('*')
        .then(rows => rows[0]);
      return result;
    },
    updateTask: async (obj, clientData, context, info) => {
      const task = await context
        .db('tasks')
        .select()
        .where('id', clientData.id)
        .then(rows => rows[0]);
      if (!task) {
        throw new Error(`Invalid ID for task object: ${clientData.id}`);
      }

      if (CONFLICTS_RESOLUTION_TYPE !== undefined) {
        if (conflictHandler.hasConflict(task, clientData)) {
          if (CONFLICTS_RESOLUTION_TYPE === 'server') {
            const { resolvedState, response } = await conflictHandler.resolveOnServer(
              customResolutionStrategy,
              task,
              clientData
            );
            await context
              .db('tasks')
              .update(resolvedState)
              .where({
                id: clientData.id
              })
              .returning('*')
              .then(rows => rows[0]);
            return response;
          }

          if (CONFLICTS_RESOLUTION_TYPE === 'client') {
            const { response } = conflictHandler.resolveOnClient(task, clientData);
            return response;
          }
        }
        conflictHandler.nextState(clientData);
      }

      const update = await context
        .db('tasks')
        .update(clientData)
        .where({
          id: clientData.id
        })
        .returning('*')
        .then(rows => rows[0]);
      return update;
    },
    deleteTask: async (obj, args, context, info) => {
      const result = await context
        .db('tasks')
        .delete()
        .where('id', args.id)
        .returning('*')
        .then(rows => {
          if (rows[0]) {
            const deletedId = rows[0].id;
            return deletedId;
          }
          throw new Error(`Cannot delete object ${args.id}`);
        });
      return result;
    },
    deleteAllTasks: async (obj, args, context) => {
      await context
        .db('tasks')
        .delete()
        .returning('*')
        .then(rows => rows);
      return 'All tasks are successfully deleted';
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
