import http from "k6/http";
import { check } from "k6";
import { query_allTasks } from "./showcase/queries/showcase.js"

// Place GraphQL Server App URL here, e.g. https:/myapp.com/graphql
const url = ""
const params =  { headers: { "Content-Type": "application/json" } }

export default function() {
    let payload, res, allTasks, mutation_deleteTask;


    payload = JSON.stringify(query_allTasks)
    res = http.post(url, payload, params);
    check(res, {
        "is status 200 after quering all tasks": (r) => r.status === 200
    });
    allTasks = JSON.parse(res.body).data.allTasks;

    for (let i = 1; i <= allTasks.length ; i++) {
        mutation_deleteTask = {
            "query": `mutation deleteTask {
                deleteTask(id: "${i}")
              }`
        }
        payload = JSON.stringify(mutation_deleteTask)
        res = http.post(url, payload, params);
        if (JSON.parse(res.body).errors !== undefined) {
            console.log(JSON.stringify(JSON.parse(res.body).errors))
        }
        check(res, {
            "is status 200 after deleting the task": (r) => r.status === 200,
            "no errors from graphql server after deleting the task": (r) => JSON.parse(r.body).errors === undefined
        });
    }


};