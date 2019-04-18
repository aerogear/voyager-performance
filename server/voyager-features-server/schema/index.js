const { gql } = require('@aerogear/voyager-server');

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

exports.typeDefs = typeDefs;
exports.nodb = require('./type/nodb');
exports.nedb = require('./type/nedb');
exports.mongodb = require('./type/mongodb');
exports.postgres = require('./type/postgres');
