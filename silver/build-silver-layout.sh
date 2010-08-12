#!/bin/bash

DIR="$1"
if [ -z "$SILVER" ] ; then
    SILVER=silver
fi

if [ -z "$DIR" ] ; then
    echo "Usage: $(basename $0) DIR"
    echo "  Creates a new layout for the graphs code in DIR"
    exit 2
fi

if ! which $SILVER ; then
    echo "You must install Silver Lining"
    echo "Or do:"
    echo "  $ export SILVER=/path/to/bin/silver"
    exit 3
fi

$SILVER init $DIR
if [ ! -e src/graphs/.hg ] ; then
    cd $DIR/src
    hg clone ssh://hg.mozilla.org/users/ibicking_mozilla.com/graphs graphs
    cd ..
fi
if [ ! -e src/webtestrecorder/.hg ] ; then
    cd $DIR/src
    hg clone http://bitbucket.org/ianb/webtestrecorder
    cd ..
fi
if [ ! -L app.ini ] ; then
    rm -f app.ini
    ln -s src/graphs/silver/app.ini app.ini
fi
if [ -e README.txt ] ; then
    rm README.txt
fi
if [ ! -e lib/python/.hg ] ; then
    cd lib
    rmdir python
    hg clone ssh://hg.mozilla.org/users/ibicking_mozilla.com/graphs-lib python
    cd ..
fi

cd static
for NAME in images jq js graphs.html dgraphs.html ; do
    if [ ! -L $NAME ] ; then
        ln -s ../src/graphs/$NAME $NAME
    fi
done
cd ..

echo "Environment setup"
