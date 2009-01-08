
SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";

-- 
-- Database: `graphserver`
-- 

-- 
-- Dumping data for table `annotations`
-- 

INSERT INTO `annotations` VALUES (1, 1, 'I think something happened here', 12345);
INSERT INTO `annotations` VALUES (2, 2, 'Yay, we fixed it!', 0);

-- 
-- Dumping data for table `branches`
-- 

INSERT INTO `branches` VALUES (1, '1.8');
INSERT INTO `branches` VALUES (2, '1.9');
INSERT INTO `branches` VALUES (4, 'actionmonkey');
INSERT INTO `branches` VALUES (3, 'mozilla-central');

-- 
-- Dumping data for table `builds`
-- 

INSERT INTO `builds` VALUES (1, 2008100211, '2fdcdd519ee7', 3, 1202033420);
INSERT INTO `builds` VALUES (2, 2008100212, '2fdcer519ee7', 2, 1202053420);
INSERT INTO `builds` VALUES (3, 2008110211, '2fecdd519ee7', 3, 1202083420);
INSERT INTO `builds` VALUES (4, 2008120211, '2feccd519ee7', 1, 1202013420);

-- 
-- Dumping data for table `machines`
-- 

INSERT INTO `machines` VALUES (1, 1, 1, 0, 'qm-mini-xp01', 1, 1209729600);
INSERT INTO `machines` VALUES (2, 2, 1, 0, 'qm-mini-ubuntu01 ', 1, 1209759600);
INSERT INTO `machines` VALUES (3, 3, 0, 0, 'qm-pmac01 ', 1, 1209829600);
INSERT INTO `machines` VALUES (4, 4, 0, 0, 'qm-pleopard-trunk06', 1, 1209629600);
INSERT INTO `machines` VALUES (5, 5, 1, 0, 'qm-mini-vista01 ', 1, 1209929600);

-- 
-- Dumping data for table `os_list`
-- 

INSERT INTO `os_list` VALUES (3, '10.4.8');
INSERT INTO `os_list` VALUES (4, '10.5.2');
INSERT INTO `os_list` VALUES (2, 'Linux');
INSERT INTO `os_list` VALUES (5, 'Vista');
INSERT INTO `os_list` VALUES (1, 'WinXP');

-- 
-- Dumping data for table `pages`
-- 

INSERT INTO `pages` VALUES (5, 1, 'facebook.com');
INSERT INTO `pages` VALUES (3, 1, 'google.com');
INSERT INTO `pages` VALUES (7, 1, 'myspace.com');
INSERT INTO `pages` VALUES (1, 1, 'yahoo.com');
INSERT INTO `pages` VALUES (2, 2, 'altavista.com');
INSERT INTO `pages` VALUES (6, 2, 'geocities.com');
INSERT INTO `pages` VALUES (4, 2, 'yahoo.com');

-- 
-- Dumping data for table `pagesets`
-- 

INSERT INTO `pagesets` VALUES (2, 'Historic');
INSERT INTO `pagesets` VALUES (1, 'New');

-- 
-- Dumping data for table `tests`
-- 

INSERT INTO `tests` VALUES (1, 'Tp3', 'Tp3', 1, 1, 1);
INSERT INTO `tests` VALUES (2, 'DHTML', 'DHTML', 1, 1, NULL);
INSERT INTO `tests` VALUES (3, 'Sunspider', 'Sunspider', 1, 1, NULL);
INSERT INTO `tests` VALUES (4, 'Tjss', 'Tjss', 0, 1, NULL);
INSERT INTO `tests` VALUES (5, 'Twinopen', 'Twinopen', 1, 1, NULL);
INSERT INTO `tests` VALUES (6, 'Tsvg', 'Tsvg', 0, 1, NULL);

-- 
-- Dumping data for table `test_runs`
-- 

INSERT INTO `test_runs` VALUES (1, 1, 1, 2, 1, 1208955480, 87907);
INSERT INTO `test_runs` VALUES (2, 3, 2, 4, 1, 1208935480, 8707);
INSERT INTO `test_runs` VALUES (3, 2, 5, 3, 1, 1208955480, 65);

-- 
-- Dumping data for table `test_run_values`
-- 

INSERT INTO `test_run_values` VALUES (1, 1, 157, 3);
INSERT INTO `test_run_values` VALUES (1, 2, 89, 4);
INSERT INTO `test_run_values` VALUES (1, 3, 99, 5);
INSERT INTO `test_run_values` VALUES (1, 4, 165, 7);
INSERT INTO `test_run_values` VALUES (1, 5, 55, 6);