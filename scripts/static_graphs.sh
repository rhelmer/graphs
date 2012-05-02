#!/bin/bash
#
# Generate static dashboard images using node, flot, jsdom, and node-canvas
#

export PATH=$PATH:$HOME/node/bin
export NODE_PATH=$HOME/node_modules/
export NODE=$(which node)

# some installs call it "nodejs"
if [ -z "$NODE" ]
then
  NODE=$(which nodejs)
fi

if [ -z "$NODE" ]
then
  echo "node not found"
  exit 1
fi

if [ -z "$DOCROOT" ]
then
  export DOCROOT=/var/www/html/graphs
fi

cd $DOCROOT
mkdir -p images/dashboard
$NODE ./scripts/static_graphs.js
