const knex = require('knex');

const options = {
  database: process.env.DB_NAME || 'tasks',
  user: process.env.DB_USERNAME || 'postgresql',
  password: process.env.DB_PASSWORD || 'postgresql',
  host: process.env.DB_HOSTNAME || '127.0.0.1',
  port: process.env.DB_PORT || '5432'
};

async function createTasksTables(db) {
  const tasksExists = await db.schema.hasTable('tasks');
  if (!tasksExists) {
    await db.schema.createTable('tasks', table => {
      table.string('title');
      table.integer('version');
      table.increments('id');
      table.string('status');
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

module.exports = {
  connect
};
