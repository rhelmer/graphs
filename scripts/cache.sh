#!/bin/sh
#
# Keep the cache warm.
# TODO static_graphs.js should be able to replace this.
#

runs="id=16&branchid=1&platformid=12 id=16&branchid=1&platformid=1 id=16&branchid=1&platformid=13 id=16&branchid=1&platformid=14 id=38&branchid=1&platformid=12 id=38&branchid=1&platformid=1 id=38&branchid=1&platformid=13 id=38&branchid=1&platformid=14 id=25&branchid=1&platformid=12 id=25&branchid=1&platformid=1 id=25&branchid=1&platformid=13 id=25&branchid=1&platformid=14"
for run in $runs
do
  curl -H 'Accept-encoding: gzip' -s "http://bm-graphs-stage01.mozilla.org/api/test/runs?${run}" > /dev/null
done

curl -H 'Accept-encoding: gzip' -s "http://bm-graphs-stage01.mozilla.org/api/test?attribute=short" > /dev/null
