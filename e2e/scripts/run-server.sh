#!/usr/bin/env bash

# prerequisites:
# - prepare script

set -e

cd "$(dirname "$0")/.."

cd ionic-showcase/server

docker-compose up &

npm install

npm start
