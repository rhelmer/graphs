#!/usr/bin/env python
import os, sys

if  len(sys.argv) != 4:
    print "Please enter a test id AND directory AND database name"
    print "Usage: dump_test_data.py TEST_ID DEST_DIR DB_NAME"
    sys.exit()

id = sys.argv[1]
dir = sys.argv[2]
db = sys.argv[3]

values_file = dir + "/dataset_values_"+id+".sql"
annotations_file = dir + "/annotations_"+id+".sql"
extra_data_file = dir + "/dataset_extra_data_"+id+".sql"
branchinfo_file = dir + "/branchinfo_"+id+".sql"
info_file = dir + "/info_"+id+".sql"

os.system("mysqldump -u root "+db+" dataset_values --no-create-info --skip-opt --compact --where='dataset_id = "+ id +"' >" +values_file)
os.system("mysqldump -u root "+db+" annotations --no-create-info --skip-opt --compact --where='dataset_id = " + id + "' > "+annotations_file)
os.system("mysqldump -u root "+db+" dataset_extra_data --no-create-info --skip-opt --compact --where=\"dataset_id = " + id + "\" > "+extra_data_file)
os.system("mysqldump -u root "+db+" dataset_branchinfo --no-create-info --skip-opt --compact --where=\"dataset_id = " + id + "\" > "+branchinfo_file)
os.system("mysqldump -u root "+db+" dataset_info --no-create-info --skip-opt --compact --where=\"id = " + id + "\" > "+info_file)


os.system("cat " + values_file + " " + annotations_file + " " +extra_data_file + " "+branchinfo_file+" "+info_file+"> "+dir+"/test_"+id+".sql")
os.system("zip -j "+dir+"/test_" + id + ".zip "+dir+"/test_" + id + ".sql")
os.system("rm "+dir+"/test_"+id+".sql "+values_file+" "+annotations_file+" "+extra_data_file+" "+branchinfo_file+" "+info_file)
print "Test data in "+dir+"/test_" + id + ".zip\n"
