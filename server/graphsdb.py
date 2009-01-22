import sys
sys.path.append("../")


from pysqlite2 import dbapi2 as sqlite
from databases import mysql as MySQLdb


db = MySQLdb.connect("localhost","root","","graphserver")

