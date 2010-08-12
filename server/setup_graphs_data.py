import os
import optparse
from graphsdb import db

sql_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sql')

parser = optparse.OptionParser(
    usage='%prog',
    description='Insert test_data into the database')
parser.add_option(
    '--sql',
    help='Show SQL that would be executed',
    action='store_true')


def main():
    options, args = parser.parse_args()
    fn = os.path.join(sql_dir, 'test_data.sql')
    sql = open(fn).read()
    if options.sql:
        print sql
        return
    sqls = list(sql_lines(sql))
    for sql in sqls:
        print 'Executing %s' % sql.strip()
        cursor = db.cursor()
        cursor.execute(sql)
        cursor.close()


def sql_lines(sql):
    lines = sql.splitlines(True)
    last = ''
    for line in lines:
        if line.startswith('--'):
            continue
        if not line.strip():
            continue
        if ';' in line:
            yield last + line
            last = ''
        else:
            last += line

if __name__ == '__main__':
    main()
    
