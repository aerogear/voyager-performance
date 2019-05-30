// Prerequisites:
// - log in to https://app-automate.browserstack.com/
// - use credentials from https://mojo.redhat.com/docs/DOC-929478
// - find your test run
// - go to "Network Logs" tab
// - "View Raw Network Logs"
// - download the log
// - save it as "network-log.json" in the root folder of this E2E performance test

const log = require('../network-log');

const { entries } = log.log;

const create = entries.filter(e => {
  const text = e.request && e.request.postData && e.request.postData.text;
  if (text && typeof text === 'string') {
    return e.request.postData.text.includes('createTask');
  }
  return false;
});

const timings = create.reduce((prev, curr) => {
  return {
    time: prev.time + curr.time,
    send: prev.send + curr.timings.send,
    receive: prev.receive + curr.timings.receive,
    wait: prev.wait + curr.timings.wait,
  }
}, { time: 0, send: 0, receive: 0, wait: 0 })

console.log('network timings in miliseconds:', timings);
