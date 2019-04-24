import http from "k6/http";
import { check } from "k6";
import { query_allTasks, mutation_createTask } from "./queries/showcase.js"

// Place GraphQL Server App URL here, e.g. https:/myapp.com/graphql
const url = ""
const params =  { headers: { "Content-Type": "application/json" } }

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomTaskToUpdate(listOfTasks) {
    const randomInt = getRandomInt(1, listOfTasks.length)
    return listOfTasks[randomInt-1]

}

export default function() {
    let payload, res, allTasks, randomTask;
    
    payload = JSON.stringify(mutation_createTask)
    res = http.post(url, payload, params);
    check(res, {
        "is status 200 after creating a task": (r) => r.status === 200,
        "no errors from graphql server when creating a task": (r) => JSON.parse(r.body).errors === undefined
    });


    payload = JSON.stringify(query_allTasks)
    res = http.post(url, payload, params);
    check(res, {
        "is status 200 after quering all tasks": (r) => r.status === 200
    });
    allTasks = JSON.parse(res.body).data.allTasks;

    
    randomTask = getRandomTaskToUpdate(allTasks)
    const mutation_updateTask = {
        "query": `mutation updateTask {
            updateTask(id: "${randomTask.id}" version: ${randomTask.version}, title: "${randomTask.id} - updated task") {
                id, version, title, description
            }
          }`
    }

    payload = JSON.stringify(mutation_updateTask)
    res = http.post(url, payload, params);
    if (JSON.parse(res.body).errors !== undefined) {
        console.log(JSON.stringify(JSON.parse(res.body).errors))
    }
    check(res, {
        "is status 200 after updating the task": (r) => r.status === 200,
        "no errors from graphql server after updating the task": (r) => JSON.parse(r.body).errors === undefined
    });
};