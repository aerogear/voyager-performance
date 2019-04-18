import http from 'k6/http';
import { check } from 'k6';
import { queryAllTasks, mutationCreateTask, mutationDeleteAllTasks } from './utils/queries.js';

// Place GraphQL Server App URL here, e.g. http://myapp.com/graphql
const url = 'http://localhost:4000/graphql';
const params = { headers: { 'Content-Type': 'application/json' } };

export function setup() {
  const payload = JSON.stringify(mutationCreateTask);
  // Create some tasks
  for (let i = 0; i < 100; i++) {
    http.post(url, payload, params);
  }
}

export default function() {
  const payload = JSON.stringify(queryAllTasks);
  const res = http.post(url, payload, params);

  check(res, {
    'is status 200 after quering all tasks': r => r.status === 200
  });
}

export function teardown() {
  const payload = JSON.stringify(mutationDeleteAllTasks);
  const res = http.post(url, payload, params);

  check(res, {
    'is status 200 after deleting all tasks': r => r.status === 200
  });
}
