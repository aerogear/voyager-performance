# Performance test for ionic-showcase GraphQL server

Before running the script, add showcase-app server URL to the test file in this directory you want to run.

Also you may want to [setup metrics](../../../scripts/README.md) to visualise data from test results.

Then run it with:
```
k6 run --out influxdb=<influxdb-url>/k6 test.js
```