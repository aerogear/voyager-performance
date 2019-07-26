#!/usr/bin/env bash

# Prerequisites:
# - npm install -g cordova
# - npm install -g ionic
# - edit mobile-services.json
# - BROWSERSTACK_USER env var
# - BROWSERSTACK_KEY env var

set -e

cd "$(dirname "$0")/.."

rm -rf ionic-showcase

git clone git@github.com:aerogear/ionic-showcase.git

cp fixtures/home.page.ts ionic-showcase/src/app/pages/home/
cp fixtures/app-routing.module.ts ionic-showcase/src/app/
cp fixtures/mobile-services.json ionic-showcase/src/

cd ionic-showcase

npm install

ionic cordova build android

curl -u "$BROWSERSTACK_USER:$BROWSERSTACK_KEY" \
  -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
  -F "file=@$(pwd)/platforms/android/app/build/outputs/apk/debug/app-debug.apk"
