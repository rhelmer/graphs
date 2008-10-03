DROP TABLE IF EXISTS machines;
CREATE TABLE machines (
   machine_id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
   os_id INT UNSIGNED NOT NULL,
   is_throttling TINYINT UNSIGNED NOT NULL DEFAULT '0',
   cpu_speed SMALLINT UNSIGNED NOT NULL DEFAULT '0',
   name VARCHAR(255) NOT NULL,
   is_active TINYINT UNSIGNED NOT NULL DEFAULT '0',
   date_added INT UNSIGNED NOT NULL,

   PRIMARY KEY (machine_id),
   UNIQUE KEY (name)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS os_list;
CREATE TABLE os_list (
   os_id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
   name VARCHAR(255) NOT NULL,

   PRIMARY KEY (os_id),
   UNIQUE KEY (name)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS tests;
CREATE TABLE tests (
   test_id MEDIUMINT UNSIGNED NOT NULL AUTO_INCREMENT,
   name VARCHAR(255) NOT NULL,
   pretty_name VARCHAR(255),
   is_chrome TINYINT UNSIGNED NOT NULL DEFAULT '0',
   is_active TINYINT UNSIGNED NOT NULL DEFAULT '0',
   pageset_id INT UNSIGNED,

   PRIMARY KEY (test_id),
   UNIQUE KEY (name),
   KEY (pageset_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS branches;
CREATE TABLE branches (
   branch_id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
   name VARCHAR(255) NOT NULL,

   PRIMARY KEY (branch_id),
   UNIQUE KEY (name)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS builds;
CREATE TABLE builds (
   build_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
   ref_build_id INT UNSIGNED,
   ref_changeset VARCHAR(255),
   os_id TINYINT UNSIGNED NOT NULL,
   branch_id SMALLINT UNSIGNED NOT NULL,
   date_added INT UNSIGNED NOT NULL,

   PRIMARY KEY (build_id),
   KEY (ref_changeset),
   KEY (ref_build_id),
   KEY (branch_id, date_added)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS pagesets;
CREATE TABLE pagesets (
   pageset_id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
   name VARCHAR(255) NOT NULL,

   PRIMARY KEY (pageset_id),
   UNIQUE KEY (name)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS pages;
CREATE TABLE pages (
   page_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
   pageset_id SMALLINT UNSIGNED NOT NULL,
   name VARCHAR(255) NOT NULL,

   PRIMARY KEY (page_id),
   UNIQUE KEY (pageset_id, name)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS test_runs;
CREATE TABLE test_runs (
   test_run_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
   machine_id SMALLINT UNSIGNED NOT NULL,
   test_id MEDIUMINT UNSIGNED NOT NULL,
   build_id INT UNSIGNED NOT NULL,
   run_number TINYINT UNSIGNED NOT NULL DEFAULT '0',
   date_run INT UNSIGNED NOT NULL,
   average FLOAT,

   PRIMARY KEY (test_run_id),
   UNIQUE KEY (machine_id, test_id, build_id, run_number),
   KEY (machine_id, test_id, date_run)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS test_run_values;
CREATE TABLE test_run_values (
   test_run_id INT UNSIGNED NOT NULL,
   interval_id SMALLINT UNSIGNED NOT NULL,
   value FLOAT NOT NULL,
   page_id INT UNSIGNED,

   PRIMARY KEY (test_run_id, interval_id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS annotations;
CREATE TABLE annotations (
  annotation_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  test_run_id int UNSIGNED NOT NULL,
  note text NOT NULL,
  bug_id INT UNSIGNED NOT NULL,
  
  PRIMARY KEY (id)
) ENGINE=InnoDB;
