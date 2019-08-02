// Prerequisites:
// - npm install
// - BROWSERSTACK_USER env var
// - BROWSERSTACK_KEY env var
// - BROWSERSTACK_APP env var
// - for local sync server, have BrowserStackLocal running (https://www.browserstack.com/local-testing#command-line)

const wdio = require('webdriverio');
const fetch = require('node-fetch');
const moment = require('moment');

const services = require('../fixtures/mobile-services');

const TASKS_TO_CREATE = 100;

const localServer = services.services.find(service => service.url.includes('bs-local.com'));

const opts = {
  hostname:'hub-cloud.browserstack.com',
  logLevel: 'error',
  capabilities: {
    'os_version': '9.0',
    'device': 'Google Pixel 3',
    'real_mobile': 'true',
    'project': 'AeroGear DataSync Performance Tests',
    'name': 'tests',
    'browserstack.local': localServer ? 'true' : 'false',
    'browserstack.user': process.env.BROWSERSTACK_USER,
    'browserstack.key': process.env.BROWSERSTACK_KEY,
    'app': process.env.BROWSERSTACK_APP,
    'autoWebview': true,
    'browserstack.appium_version': '1.9.1',
    'browserstack.networkLogs': true
  }
};

const setNetwork = async (profile, client) => {
  const buff = Buffer.from(`${process.env.BROWSERSTACK_USER}:${process.env.BROWSERSTACK_KEY}`);
  await fetch(`https://api-cloud.browserstack.com/app-automate/sessions/${client.sessionId}/update_network.json`, {
    body: `{"networkProfile":"${profile}"}`,
    headers: {
      Authorization: `Basic ${buff.toString('base64')}`,
      "Content-Type": "application/json"
    },
    method: "PUT"
  });
};

const getNumOfTasks = async client => {
  const result = await client.executeAsync(async done => {
    const { voyeager, queries } =  window.aerogear;

    const result = await voyeager.apolloClient.query({
      query: queries.GET_TASKS,
      fetchPolicy: 'network-only',
      errorPolicy: 'none'
    });

    done(result.data.allTasks.length);
  });

  console.log(`number of tasks: ${result}`);

  return result;
};

const keycloakEnabled = () => {
  return services.services.find(service => service.type === 'keycloak');
};

const authenticate = async client => {
  console.log('authenticating');

  const mainWindow = await client.getWindowHandle();
  const allWindows = await client.getWindowHandles();
  const loginPage = allWindows.find(w => w !== mainWindow);
  await client.switchToWindow(loginPage);

  const usernamEl = await client.$('#username')
  await usernamEl.setValue(process.env.KEYCLOAK_USER);
  
  const passwordEl = await client.$('#password')
  await passwordEl.setValue(process.env.KEYCLOAK_PASS);
  
  const loginEl = await client.$('#kc-login')
  await loginEl.click();

  await client.switchToWindow(mainWindow);

  console.log('waiting for initialization');

  await new Promise(resolve => setTimeout(resolve, 10000));
};

const test = async () => {
  console.log('connecting to client');

  const client = await wdio.remote(opts);

  console.log('waiting for initialization');

  await new Promise(resolve => setTimeout(resolve, 10000));

  if (keycloakEnabled()) {
    await authenticate(client);
  }

  await getNumOfTasks(client);

  console.log('go offline');

  await setNetwork('no-network', client);

  console.log('performing mutations');

  for (let i = 0; i < TASKS_TO_CREATE; i++) {
    console.log(`mutation ${i}`);

    await client.executeAsync(async done => {
      const { voyeager, queries } =  window.aerogear;

      try {
        await voyeager.apolloClient.offlineMutate({
          mutation: queries.ADD_TASK,
          variables: {
            'title': 'test',
            'description': 'test',
            'version': 1,
            'status': 'OPEN'
          },
          updateQuery: queries.GET_TASKS,
          returnType: 'Task'
        });
      } catch (error) {}

      done();
    });
  }

  console.log('go online');

  await setNetwork('reset', client);

  const start = moment();

  let numOfTasks = TASKS_TO_CREATE;

  while (numOfTasks > 0) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    numOfTasks = await client.executeAsync(async done => {
      const { itemService } =  window.aerogear;
  
      const result = await itemService.getOfflineItems();
  
      done(result.length);
    });
  
    console.log(`number of offline tasks: ${numOfTasks}`);
  }

  const end = moment();

  const syncTime = moment.utc(end.diff(start)).format("HH:mm:ss");

  console.log(`sync time (hh:mm:ss): ${syncTime}`);

  await client.deleteSession();
};

test();
