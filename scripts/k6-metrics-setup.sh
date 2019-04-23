#!/bin/bash

if ! type jq &> /dev/null; then
  	if ! type docker &> /dev/null; then
		echo "Error: To run this script, at least Docker must be installed and active.";
    	exit 1
  	fi
	jq="docker run -i stedolan/jq"
else
	jq="jq"
fi

# Fancy stuff
green_text=$(tput setaf 2)
normal_text=$(tput sgr0)

# Deploy InfluxDB & Grafana to OpenShift project
oc new-app docker.io/library/influxdb
oc new-app docker.io/grafana/grafana

# Create PVC from the template
oc create -f pvc.yaml

# Add persistent volumes to InfluxDB & Grafana
oc patch dc influxdb -p '{
	"spec": {
		"template": {
			"spec": {
				"volumes": [{
					"name": "volume-influx",
					"persistentVolumeClaim": {
						"claimName": "k6-pvc"
					}
				}],
				"containers": [{
					"name": "influxdb",
					"volumeMounts": [{
						"mountPath": "/var/lib/influxdb",
						"name": "volume-influx",
						"subPath": "influxdb"
					}]
				}]
			}
		}
	}
}'

oc patch dc grafana -p '{
	"spec": {
		"template": {
			"spec": {
				"volumes": [{
					"name": "volume-grafana",
					"persistentVolumeClaim": {
						"claimName": "k6-pvc"
					}
				}],
				"containers": [{
					"name": "grafana",
					"volumeMounts": [{
							"mountPath": "/var/lib/grafanadb",
							"name": "volume-grafana",
							"subPath": "grafanadb"
						},
						{
							"mountPath": "/var/lib/grafana",
							"name": "volume-grafana",
							"subPath": "grafana"
						}
					]
				}]
			}
		}
	}
}'

# Create routes
oc expose svc/influxdb    
oc expose svc/grafana

# Add anonymous access to Grafana UI
oc set env dc grafana GF_AUTH_ANONYMOUS_ORG_ROLE=Admin GF_AUTH_ANONYMOUS_ENABLED=true GF_AUTH_BASIC_ENABLED=false

# Wait until all pods are running
while oc get pods | grep -q deploy; do echo "waiting for all pods to be running"; sleep 1; done
grafana_host=$(oc get routes | grep grafana | awk '{print $2}')
influxdb_host=$(oc get routes | grep influx | awk '{print $2}')
influxdb_pod_name=$(oc get pods | grep influx | awk '{print $1}')

# Create database in InfluxDB
oc exec "$influxdb_pod_name" -- bash -c "influx -execute 'create database k6'"

# Add k6 database to Grafana datasource
curl "http://$grafana_host/api/datasources" -H 'Content-Type: application/json' -X POST --data-binary '{
    "name": "k6",
    "type": "influxdb",
    "url": "http://influxdb:8086",
    "access": "proxy",
    "isDefault": true,  
    "database": "k6"
}'

# Import load testing dashboard (https://grafana.com/dashboards/2587)
load_testing_dashboard=$(curl -s "http://$grafana_host/api/gnet/dashboards/2587" | $jq '.json')
dashboard_data="{\"dashboard\": ${load_testing_dashboard}, \"folderId\": 0, \"overwrite\": true, \"inputs\": [{\"name\":\"DS_K6\",\"type\":\"datasource\",\"pluginId\":\"influxdb\",\"value\":\"k6\"}]}"
curl -s "http://$grafana_host/api/dashboards/import" -X POST -H 'Content-Type: application/json;charset=UTF-8' --data-binary "${dashboard_data}"
# Set Load testing dashboard as home dashboard
curl -s "http://$grafana_host/api/org/preferences" -X PUT -H 'Content-Type: application/json' --data-binary '{"homeDashboardId":1}'

# Finish
echo -e "\n${green_text}SUCCESS!${normal_text}"
echo "To store & visualize data from your tests, just run your test like this:"
echo "k6 run --out influxdb=http://${influxdb_host}/k6 <your-test-script-name>.js"
echo "Grafana URL (to see the graphs): http://${grafana_host}"
