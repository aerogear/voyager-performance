export const queryAllTasks = {
  query: `query allTasks {
        allTasks{
          id, version, title, description
        }
      }`
};

export const mutationCreateTask = {
  query: `mutation createTask {
        createTask(title: "perf test" description: "perf test description") {
            id, version, title, description
        }
      }`
};

export const mutationDeleteAllTasks = {
  query: `mutation deleteAllTasks {
        deleteAllTasks
      }`
};
