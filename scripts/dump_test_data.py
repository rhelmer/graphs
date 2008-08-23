#!/usr/bin/env python
import os, sys

if  len(sys.argv) != 3:
    print "Please enter a test id AND directory"
    print "Usage: dump_test_data.py TEST_ID DEST_DIR"
    sys.exit()

id = sys.argv[1]
dir = sys.argv[2]

values_file = dir + "/dataset_values_"+id+".sql"
annotations_file = dir + "/annotations_"+id+".sql"
extra_data_file = dir + "/dataset_extra_data_"+id+".sql"


os.system("mysqldump -u root graphs_stage dataset_values --no-create-info --skip-opt --compact --where='dataset_id = "+ id +"' >" +values_file)
os.system("mysqldump -u root graphs_stage annotations --no-create-info --skip-opt --compact --where='dataset_id = " + id + "' > "+annotations_file)
os.system("mysqldump -u root graphs_stage dataset_extra_data --no-create-info --skip-opt --compact --where=\"dataset_id = " + id + "\" > "+extra_data_file)


os.system("cat " + values_file + " " + annotations_file + " " +extra_data_file + " > test_"+id+".sql")
os.system("zip test_" + id + ".zip test_" + id + ".sql")
os.system("rm dataset_values_" + id + ".sql annotations_" + id + ".sql dataset_extra_data_" + id + ".sql test_" + id + ".sql")
print "Test data in test_" + id + ".zip\n"