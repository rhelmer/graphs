#!/usr/bin/env python
import os, sys

if  len(sys.argv) != 9:
    print "Please enter a test id AND AND branch id AND machine id AND directory AND database name AND database host AND database user AND database password"
    print "Usage: dump_test_data.py TEST_ID BRANCH_ID MACHINE_ID DEST_DIR DB_NAME DB_HOST DB_USER DB_PASS"
    sys.exit()

test_id = sys.argv[1]
branch_id = sys.argv[2]
machine_id = sys.argv[3]
dir = sys.argv[4]
db = sys.argv[5]
host = sys.argv[6]
user = sys.argv[7]
password = sys.argv[8]

branches_file = dir + "/branches_"+test_id+".sql"
machines_file = dir + "/machines_"+test_id+".sql"
test_file = dir + "/test_"+test_id+".sql"
builds_file = dir + "/builds_"+test_id+".sql"
test_runs_file = dir + "/test_runs_"+test_id+".sql"
test_run_values_file = dir + "/test_run_values_" + test_id + ".sql"
pageset_file = dir + "/pageset_"+test_id+".sql"
pages_file = dir + "/pages_"+test_id+".sql"

os.system("mysqldump -h "+host+" -u "+user+" -p"+password+" "+db+" branches --no-create-info --skip-opt --compact --where='id = "+ branch_id +"' >" + branches_file)
os.system("mysqldump -h "+host+" -u "+user+" -p"+password+" "+db+" machines --no-create-info --skip-opt --compact --where='id = "+ machine_id +"' >" + machines_file)
os.system("mysqldump -h "+host+" -u "+user+" -p"+password+" "+db+" tests --no-create-info --skip-opt --compact --where='id = "+ test_id +"' >" + test_file)
os.system("mysqldump -h "+host+" -u "+user+" -p"+password+" "+db+" test_runs --no-create-info --skip-opt --compact --where='id IN(SELECT test_runs.id FROM test_runs INNER JOIN builds ON (builds.id = test_runs.build_id) INNER JOIN branches ON (builds.branch_id = branches.id) INNER JOIN machines ON (test_runs.machine_id = machines.id) WHERE test_runs.test_id = "+test_id+" AND machines.id = "+machine_id+" AND branches.id = "+branch_id+")' > "+test_runs_file)
os.system("mysqldump -h "+host+" -u "+user+" -p"+password+" "+db+" builds --no-create-info --skip-opt --compact --where='id IN(SELECT test_runs.build_id FROM test_runs INNER JOIN builds ON (builds.id = test_runs.build_id) INNER JOIN branches ON (builds.branch_id = branches.id) INNER JOIN machines ON (test_runs.machine_id = machines.id) WHERE test_runs.test_id = "+test_id+" AND machines.id = "+machine_id+" AND branches.id = "+branch_id+")' > "+builds_file)
os.system("mysqldump -h "+host+" -u "+user+" -p"+password+" "+db+" test_run_values --no-create-info --skip-opt --compact --where='test_run_id IN(SELECT test_runs.id FROM test_runs INNER JOIN builds ON (builds.id = test_runs.build_id) INNER JOIN branches ON (builds.branch_id = branches.id) INNER JOIN machines ON (test_runs.machine_id = machines.id) WHERE test_runs.test_id = "+test_id+" AND machines.id = "+machine_id+" AND branches.id = "+branch_id+")' > "+test_run_values_file)
os.system("mysqldump -h "+host+" -u "+user+" -p"+password+" "+db+" pagesets --no-create-info --skip-opt --compact --where='id IN(SELECT tests.pageset_id FROM tests WHERE tests.id = "+test_id+")' > "+pageset_file)
os.system("mysqldump -h "+host+" -u "+user+" -p"+password+" "+db+" pages --no-create-info --skip-opt --compact --where='pageset_id IN(SELECT pagesets.id FROM tests INNER JOIN pagesets ON(pagesets.id = tests.pageset_id) WHERE tests.id="+test_id+")' > "+pages_file)

os.system("cat "+dir+"/*_"+test_id+".sql > "+dir+"/test_dump_"+test_id+".sql")
os.system("zip -j "+dir+"/test_" + test_id + ".zip "+dir+"/test_dump_" + test_id + ".sql")
os.system("rm "+dir+"/*_"+test_id+".sql")
print "Test data in "+dir+"/test_" + test_id + ".zip\n"
