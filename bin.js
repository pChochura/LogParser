#!/usr/bin/env node

const query = require('./src/query');
const loqs = require('./src/loqs');

const validationRegex = /^(\[(.*?)(:|$))?((.*?\(?[a-z0-9._-]+\)?[=~!<>]{1,2}(.*\('.*?'\)|(['\/])?.*?\7)(&|\||$)?)*)/i;

const showHelp = () => {
	console.log(`
Parses JSON formatted logs from a given directory and allows to filter them via query language.

Usage:  logparser [<directory>] [-e|--extension <extension>] [-q|--query <query>]
Options:
  -h, --help, -help, h, help, ?   displays this help message
  -e, --extenstion                allows to choose an extension of the files that will be parsed; default - all
  -q, --query                     query to select matching entries

Query syntax:
  [column2.subColumn3,column3[subColumn1,...]]        - selects column1 and column2.column3
  [...,column4]                                       - selects all columns and additionally column4
  []                                                  - selects empty table
  column1='value1'                                    - selects only entries where values from column1 are equal to value1
  column2!='value2'                                   - selects only entries where values from column2 are not equal to value2
  column3=/regex1/                                    - selects only entries where values from column3 are matching regex1
  column4!=/regex2/                                   - selects only entries where values from column4 are not matching regex2
  column5~'value3'                                    - selects only entries where values from column5 are containing value3
  column6!~'value4'                                   - selects only entries where values from column6 are not containing value3
  [column1]:column2='value5'                          - selects column1 where values from column2 are equal to value5
  [...,column2]:column3~'value6'                      - selects all columns and additionally column2 where values from column3 are containig value6
  [column1]:column2~'value6'&column3='value2'         - selects column1 where values from column2 are containig value6 AND values from column3 are equal to value2
  [column2]:column1!='value3'|column2=/regex1/        - selects column2 where values from column1 are not equal to value3 OR values from column2 are matching regex1
  column5='value2'&column2=/regex2/|column1~'value6'  - selects only entries where values from column5 are equal to value5 AND values from column2 are matching regex2
														OR values from column1 are containing value6
  column<=date('2020-02-02')                          - selects only entries where the value of the column parsed as a date is before or equal to 2020-02-02
  column=object('{key:value}')                        - selects only entries where the value of the column parsed as a JSON object for the same keys have the same values
  column=object('{key:value,...}')                    - selects only entries where the value of the column parsed as a JSON object contains the given key-value pairs
  column=array('[value]')                             - selects only entries where the value of the column parsed as a JSON array have only entry equal to value
  column=array('[value,...]')                         - selects only entries where the value of the column parsed as a JSON array contains entry value
  floor(column)='-12'
  ceil(column)!='12.2'
  round(column)>='12'                                 - selects only entries where the value of column parsed as a float matches the given expression

If you omit 'directory' parameter current directory will be used.
	`);
	process.exit(0);
};

const parseArgs = (args) => {
	const options = {};
	for (let i = 0; i < args.length; i++) {
		if (
			['-h', '--help', '-help', 'h', 'help', '?'].indexOf(args[i]) !== -1
		) {
			showHelp();
		} else if (['-e', '--extension'].indexOf(args[i]) !== -1) {
			options.extension = args[i + 1];

			// Skip checking 'extension' parameter
			i++;
		} else if (['-q', '--query'].indexOf(args[i]) !== -1) {
			options.query = args[i + 1];

			// Skip checking 'query' parameter
			i++;
		} else {
			options.directory = args[i];
		}
	}

	return validateOptions(options);
};

const validateOptions = async (tempOptions) => {
	const options = {};

	options.directory = tempOptions.directory || '.';

	if (tempOptions.hasOwnProperty('extension')) {
		if (
			!tempOptions.extension ||
			!tempOptions.extension.match(/^[a-z0-9]+$/i)
		) {
			console.error('You have to pass a valid extension');
			process.exit(1);
		}

		options.extension = tempOptions.extension;
	}

	if (tempOptions.hasOwnProperty('query')) {
		if (tempOptions.query) {
			if (!tempOptions.query.match(validationRegex)) {
				console.error('Query have to be valid');
				process.exit(1);
			}
			options.query = tempOptions.query;
		} else {
			console.error('Query cannot be empty');
			process.exit(1);
		}
	}

	return options;
};

const logParser = async (args) => {
	const options = await parseArgs(args);
	await loqs.parse(options, query.parse(options));
};

logParser(process.argv.slice(2));
