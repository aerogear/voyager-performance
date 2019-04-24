export const query_allTasks = {
  "query": `query allTasks {
      allTasks{
        id, version, title, description
      }
    }`
};

export const mutation_createTask = {
  "query": `mutation createTask {
      createTask(title: "perf test" description: "1") {
          id, version, title, description
      }
    }`
}