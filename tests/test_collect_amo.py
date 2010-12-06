import sys
import os
import doctest
try:
    import minimock
except ImportError:
    print 'You must install minimock (pip install minimock)'
    raise

here = os.path.dirname(os.path.abspath(__file__))
server_path = os.path.join(os.path.dirname(here), 'server')
sys.path.append(server_path)


def main():
    optionflags = doctest.ELLIPSIS
    if '-u' in sys.argv:
        optionflags |= doctest.REPORT_UDIFF
    doctest.testfile('test_collect_amo.txt', optionflags=optionflags)

if __name__ == '__main__':
    main()
