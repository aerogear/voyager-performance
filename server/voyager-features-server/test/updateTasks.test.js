import http from 'k6/http';
import { Trend } from 'k6/metrics';
import { check, group } from 'k6';
import { queryAllTasks, mutationCreateTask, mutationDeleteAllTasks } from './utils/queries.js';

// Place GraphQL Server App URL here, e.g. https:/myapp.com/graphql
const url = 'http://localhost:4000/graphql';
const params = { headers: { 'Content-Type': 'application/json' } };

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomTaskToUpdate(listOfTasks) {
  const randomInt = getRandomInt(0, listOfTasks.length - 1);
  return listOfTasks[randomInt];
}

export function setup() {
  const payload = JSON.stringify(mutationCreateTask);
  // Create some tasks
  for (let i = 0; i < 1000; i++) {
    http.post(url, payload, params);
  }
}

export default function() {
  group('quering all tasks', () => {
    let payload = JSON.stringify(queryAllTasks);
    let res = http.post(url, payload, params);

    check(res, {
      'is status 200 after quering all tasks': r => r.status === 200
    });
    const { allTasks } = JSON.parse(res.body).data;

    group('updating tasks', () => {
      const randomTask = getRandomTaskToUpdate(allTasks);
      const mutationUpdateTask = {
        query: `mutation updateTask {
          updateTask(
            id: "${randomTask.id}",
            version: ${randomTask.version},
            title: "${randomTask.id} - updated task",
            description: "updated description"
          ) { id, version, title, description }
        }`
      };

      payload = JSON.stringify(mutationUpdateTask);
      res = http.post(url, payload, params);
      check(res, {
        'is status 200 after updating the task': r => r.status === 200,
        'no errors from graphql server after updating the task': r => JSON.parse(r.body).errors === undefined
      });
    });
  });
}

export function teardown() {
  const payload = JSON.stringify(mutationDeleteAllTasks);
  const res = http.post(url, payload, params);

  check(res, {
    'is status 200 after deleting all tasks': r => r.status === 200
  });
}
