#!/bin/bash
#
# Generate static dashboard images using node, flot, jsdom, and node-canvas
#

export DOCROOT=/var/www/html/graphs
export PATH=$PATH:$HOME/node/bin

cd $DOCROOT
mkdir -p images/dashboard
node ./scripts/static_graphs.js
