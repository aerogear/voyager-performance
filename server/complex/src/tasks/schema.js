const { pubSub } = require('../subscriptions')
const { gql } = require('apollo-server')
const { conflictHandler } = require("@aerogear/voyager-conflicts")
const { TASKS_SUBSCRIPTION_KEY } = require("./subscriptions")
const _ = require('lodash');

const typeDefs = `
type Task {
  id: ID!
  version: Int
  title: String!
  description: String!
  status: TaskStatus
  ${_.range(25).map(i => `test${i}: String`).join('\n')}
  ${_.range(25, 50).map(i => `test${i}: Int`).join('\n')}
  ${_.range(50, 75).map(i => `test${i}: Float`).join('\n')}
  ${_.range(75, 100).map(i => `test${i}: Boolean`).join('\n')}
  ${_.range(100, 125).map(i => `test${i}: Nested`).join('\n')}
}

enum TaskStatus {
  OPEN
  ASSIGNED
  COMPLETE
}

type Nested {
  test1: String
  test2: Int
  test3: Float
  test4: Boolean
}

type Query {
  allTasks(first: Int, after: String): [Task],
  getTask(id: ID!): Task
}

type Mutation {
  createTask(task: CreateTaskInput!): Task
  updateTask(task: UpdateTaskInput!): Task
  deleteTask(id: ID!): ID

  deleteAll: Boolean
}

input NestedInput {
  test1: String
  test2: Int
  test3: Float
  test4: Boolean
}

input CreateTaskInput {
  title: String!
  description: String!
  status: TaskStatus
  ${_.range(25).map(i => `test${i}: String`).join('\n')}
  ${_.range(25, 50).map(i => `test${i}: Int`).join('\n')}
  ${_.range(50, 75).map(i => `test${i}: Float`).join('\n')}
  ${_.range(75, 100).map(i => `test${i}: Boolean`).join('\n')}
  ${_.range(100, 125).map(i => `test${i}: NestedInput`).join('\n')}
}

input UpdateTaskInput {
  id: ID!
  version: Int!
  title: String
  description: String
  status: TaskStatus
  ${_.range(25).map(i => `test${i}: String`).join('\n')}
  ${_.range(25, 50).map(i => `test${i}: Int`).join('\n')}
  ${_.range(50, 75).map(i => `test${i}: Float`).join('\n')}
  ${_.range(75, 100).map(i => `test${i}: Boolean`).join('\n')}
  ${_.range(100, 125).map(i => `test${i}: NestedInput`).join('\n')}
}
`

const PUSH_ALIAS = 'cordova';

const addNested = async (task, context) => {
  for (let i = 100; i < 125; i++) {
    const nested = await context.db.select().from('test').where('id', task[`test${i}`]).then((rows) => rows[0])
    task[`test${i}`] = nested
  }
}

const omitNested = task => {
  return _.omit(task, _.range(100, 125).map(i => `test${i}`))
}

const taskResolvers = {
  Query: {
    allTasks: async (obj, args, context) => {
      const result = context.db.select().from('tasks')
      if (args.first && args.after) {
        result.limit(args.first)
        result.offset(args.after)
      } else if (args.first) {
        result.limit(args.first)
      }
      let tasks = await result

      for (const task of tasks) {
        await addNested(task, context)
      }

      return tasks
    },
    getTask: async (obj, args, context, info) => {
      const result = await context.db.select().from('tasks').where('id', args.id).then((rows) => rows[0])
      await addNested(result, context)
      return result
    }
  },

  Mutation: {
    createTask: async (obj, args, context, info) => {
      console.log("Create", args)
      const task = omitNested(args.task)
      const result = await context.db('tasks').insert({
        ...task,
        version: 1,
        status: 'OPEN'
      }).returning('*').then((rows) => rows[0])
      const dbResult = _.clone(result)
      for (let i = 100; i < 125; i++) {
        const nested = args.task[`test${i}`];
        if (nested) {
          const nestedResult = await context.db('test').insert({
            ...nested,
            taskId: result.id
          }).returning('*').then((rows) => rows[0])
          result[`test${i}`] = nestedResult
          dbResult[`test${i}`] = nestedResult.id
          await context.db('tasks').update(dbResult)
            .where({
              'id': result.id
            })
        }
      }
      // TODO context helper for publishing subscriptions in SDK?
      // TODO move from passing pushClient in context and use boolean to push or not here
      publish('CREATED', result, context.pushClient)
      return result
    },
    updateTask: async (obj, clientData, context, info) => {
      console.log("Update", clientData)
      clientData = clientData.task
      const task = await context.db('tasks').select()
        .where('id', clientData.id).then((rows) => rows[0])
      if (!task) {
        throw new Error(`Invalid ID for task object: ${clientData.id}`);
      }
      const dbTask = _.clone(task)
      await addNested(task, context)

      if (conflictHandler.hasConflict(task, clientData)) {
        const { response } = conflictHandler.resolveOnClient(task, clientData)
        return response
      }
      conflictHandler.nextState(clientData)

      const data = omitNested(clientData)
      const update = await context.db('tasks').update(data)
        .where({
          'id': data.id
        }).returning('*').then((rows) => rows[0])

      await context.db('test').delete().where('taskId', data.id)

      const dbUpdate = _.clone(update)
      
      for (let i = 100; i < 125; i++) {
        const nested = clientData[`test${i}`];
        if (nested) {
          const nestedResult = await context.db('test').insert({
            ...nested,
            taskId: update.id
          }).returning('*').then((rows) => rows[0])
          update[`test${i}`] = nestedResult
          dbUpdate[`test${i}`] = nestedResult.id
          await context.db('tasks').update(dbUpdate)
            .where({
              'id': update.id
            })
        }
      }

      publish('MUTATED', update)
      return update;
    },
    deleteTask: async (obj, args, context, info) => {
      console.log("Delete", args)
      const result = await context.db('tasks').delete()
        .where('id', args.id).returning('*').then((rows) => {
          if (rows[0]) {
            const deletedId = rows[0].id
            publish('DELETED', rows[0])
            return deletedId;
          } else {
            throw new Error(`Cannot delete object ${args.id}`);
          }
        })

      await context.db('test').delete().where('taskId', args.id)

      return result
    },
    deleteAll: async (obj, args, context, info) => {
      await context.db('tasks').delete()
      await context.db('test').delete()
    }
  }
}

function publish(actionType, data, pushClient) {
  if (pushClient) {
    pushClient.sender.send({
      alert: `New task: ${data.title}`,
      userData: {
        title: data.title,
        message: actionType
      }
    },
      {
        criteria: {
          alias: [PUSH_ALIAS]
        }
      }).then((response) => {
        console.log("Notification sent, response received ", response);
      }).catch((error) => {
        console.log("Notification not sent, error received ", error)
      })
  }
  pubSub.publish(TASKS_SUBSCRIPTION_KEY, {
    tasks: {
      action: actionType,
      task: data
    }
  });
}

module.exports = {
  taskResolvers: taskResolvers,
  taskTypeDefs: typeDefs
}