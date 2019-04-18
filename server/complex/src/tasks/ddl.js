const _ = require('lodash');

async function createTasksTables(db) {
    const tasksExists = await db.schema.hasTable('tasks')
    if (!tasksExists) {
        await db.schema.createTable('tasks', function(table) {
            table.string('title')
            table.string('description')
            // Required for conflict resolution
            table.integer('version')
            table.increments('id')
            table.string('status')
            _.range(25).map(i => table.string(`test${i}`))
            _.range(25, 50).map(i => table.integer(`test${i}`))
            _.range(50, 75).map(i => table.float(`test${i}`))
            _.range(75, 100).map(i => table.boolean(`test${i}`))
            _.range(100, 125).map(i => table.integer(`test${i}`))
        })
    }
    const testExists = await db.schema.hasTable('test')
    if (!testExists) {
        await db.schema.createTable('test', function(table) {
            table.increments('id')
            table.integer('taskId')
            table.string('test1')
            table.integer('test2')
            table.float('test3')
            table.boolean('test4')
        })
    }
}

module.exports = createTasksTables



