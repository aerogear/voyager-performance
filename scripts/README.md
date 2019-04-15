# Useful scripts

### Data visualisation

When using `k6` as a performance testing tool, you may want to use `k6-metrics-setup.sh` script to setup apps for visualisation of the results from your tests.

#### Prerequisites

* OpenShift instance available (^3.11)
* [oc](https://github.com/openshift/origin/releases) command-line tool (^3.11)
* [jq](https://github.com/stedolan/jq) JSON processor
  * `brew install jq`
  * `jq` could be also run as a Docker container (in that case make sure [Docker](https://docs.docker.com/install/) is installed and running)

Create a new project in OpenShift
```
oc new-project k6
```
Run the script
```
./k6-metrics-setup.sh
```

When the script finishes, it will provide you an example on how to run performance tests with `k6` and to redirect an output (test results) to InfluxDB now running in OpenShift.
To access visualised data from your test, go to Grafana URL also provided by script in console output.