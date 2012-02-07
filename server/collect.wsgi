import os
import sys
path = os.path.dirname(__file__)
if path not in sys.path:
    sys.path.append(path)
 
os.environ['CONFIG_MYSQL_HOST'] = ''
os.environ['CONFIG_MYSQL_USER'] = ''
os.environ['CONFIG_MYSQL_PASSWORD'] = ''
os.environ['CONFIG_MYSQL_DBNAME'] = ''
 
from collect_cgi import application 
