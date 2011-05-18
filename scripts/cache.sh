#!/bin/sh
#
# Keep the cache warm.
# TODO static_graphs.js should be able to replace this.
#

SERVERNAME=$1
if [ -z "$SERVERNAME" ]
then
  echo "Syntax: cache.sh <servername>"
fi

runs="id=16&branchid=1&platformid=12 id=16&branchid=1&platformid=1 id=16&branchid=1&platformid=13 id=16&branchid=1&platformid=14 id=38&branchid=1&platformid=12 id=38&branchid=1&platformid=1 id=38&branchid=1&platformid=13 id=38&branchid=1&platformid=14 id=25&branchid=1&platformid=12 id=25&branchid=1&platformid=1 id=25&branchid=1&platformid=13 id=25&branchid=1&platformid=14"
for run in $runs
do
  curl -o /dev/null -s -H 'Accept-encoding: gzip' -s "http://${SERVERNAME}/api/test/runs?${run}"
done

curl -o /dev/null -s -H 'Accept-encoding: gzip' -s "http://${SERVERNAME}/api/test?attribute=short"
