const express = require('express');
const { VoyagerServer, gql } = require('@aerogear/voyager-server');
const cors = require('cors');
const _ = require('lodash');

let db = [];

console.log(_.range(10 * 1000).map(i => i).join('').length);

const typeDefs = gql`
  type Query {
    items: [String]
  }

  type Mutation {
    createItem(data: String, complexData: ComplexInput): String
    deleteAll: String

    report(report: Report): Boolean
  }

  input NestedInput {
    test1: String
    test2: Int
    test3: Float
    test4: Boolean
  }
  
  input ComplexInput {
    ${_.range(25).map(i => `test${i}: String`).join('\n')}
    ${_.range(25, 50).map(i => `test${i}: Int`).join('\n')}
    ${_.range(50, 75).map(i => `test${i}: Float`).join('\n')}
    ${_.range(75, 100).map(i => `test${i}: Boolean`).join('\n')}
    ${_.range(100, 125).map(i => `test${i}: NestedInput`).join('\n')}
  }

  input Report {
    createLastMutTime: Int
    numOfOfflineMutations: Int
    storageUsageKB: Float
    responsivnessTicks: Int
    syncTime: Int
  }
`;

const resolvers = {
  Query: {
    items: (obj, args, context, info) => {
      return db;
    }
  },
  Mutation: {
    createItem: () => {
      db.push('test');
      return 'test';
    },
    deleteAll: () => {
      db = [];
    },
    report: (_, { report }) => {
      console.log(JSON.stringify(report));
    }
  }
};

const server = VoyagerServer({
  typeDefs,
  resolvers
});

const app = express();
app.use(cors())
server.applyMiddleware({ app });

app.listen(4000, () =>
  console.log(`🚀 Server ready at http://localhost:4000/graphql`)
);
