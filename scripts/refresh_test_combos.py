import api


def reporter(msg):
    print msg

if __name__ == '__main__':
    print 'Updating test combinations'
    api.update_valid_test_combinations(reporter)
