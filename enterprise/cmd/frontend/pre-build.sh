#!/bin/bash

set -ex
cd $(dirname "${BASH_SOURCE[0]}")/../..

pushd ..
yarn --ignore-engines --frozen-lockfile
yarn run build --color
popd

dev/generate.sh
