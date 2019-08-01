# E2E Performance Tests

Test to help you perform E2E testing for voyager-client.

Test is suposed to be run in BrowserStack on real device.

This test uses ionic-showcase for tests.

# Prerequisites

- BrowserStack account
- `export BROWSERSTACK_USER=<BS_USER>`
- `export BROWSERSTACK_KEY=<BS_KEY>`

To build ionic-showcase also:

- `npm install -g cordova`
- `npm install -g ionic@4`

Optional:

- deploy your voyager-server app in OpenShift
- edit `./fixtures/mobile-services.json`
- if you use keyclaok, set KEYCLOAK_USER and KEYCLOAK_PASS env vars for your keycloak user

By default example server from ionic-showcase is used locally.

# Steps

1. `npm install`
2. `npm run prepare-showcase`
3. copy APP_URL that has been printed out
4. `export BROWSERSTACK_APP=<APP_URL>`

For local server:

1. in other terminal: `npm run server`
2. have BrowserStackLocal running (https://www.browserstack.com/local-testing#command-line)

Then:

1. `npm test`
2. test will print out `sync time`

To get info about how much time did network requests took:

1. log in to https://app-automate.browserstack.com/
2. find your test run
3. go to "Network Logs" tab
4. "View Raw Network Logs"
5. download the log
6. save it as "network-log.json" in the root folder of this E2E performance test
7. `npm run network-log`
