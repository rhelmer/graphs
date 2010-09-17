#!/usr/bin/env python

from webob.dec import wsgify
import MySQLdb
from pyfomatic import collect
from graphsdb import db


@wsgify
def application(req):
    collect.handleRequest(req, db, MySQLdb)
