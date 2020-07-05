#!/usr/bin/env node

const table = require('table');
const fs = require('fs').promises;

const showHelp = () => {
	console.log(`
Parses JSON formatted logs from a given directory and allows to filter them via query language.

Usage:  logparser [<directory>] [-e|--extension <extension>] [-q|--query <query>]
Options:
  -h, --help, -help, h, help, ?   displays this help message
  -e, --extenstion                allows to choose an extension of the files that will be parsed; default - all
  -q, --query                     query to select matching entries

Query syntax:
  [column1, column2.column3]                          - selects column1 and column2.column3
  [..., column4]                                      - selects all columns and additionally column4
  []                                                  - selects empty table
  column1='value1'                                    - selects only entries where values from column1 are equal to value1
  column2!='value2'                                   - selects only entries where values from column2 are not equal to value2
  column3=/regex1/                                    - selects only entries where values from column3 are matching regex1
  column4!=/regex2/                                   - selects only entries where values from column4 are not matching regex2
  column5~'value3'                                    - selects only entries where values from column5 are containing value3
  column6!~'value4'                                   - selects only entries where values from column6 are not containing value3
  [column1]: column2='value5'                         - selects column1 where values from column2 are equal to value5
  [..., column2]: column3~'value6'                    - selects all columns and additionally column2 where values from column3 are containig value6
  [column1]: column2~'value6',column3='value2'        - selects column1 where values from column2 are containig value6 AND values from column3 are equal to value2
  [column2]: column1!='value3';column2=/regex1/       - selects column2 where values from column1 are not equal to value3 OR values from column2 are matching regex1
  column5='value2',column2=/regex2/;column1~'value6'  - selects only entries where values from column5 are equal to value5 AND values from column2 are matching regex2
                                                        OR values from column1 are containing value6

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
			const regex = /^(\[(((\.\.\.|[a-zA-Z0-9_.-]+),?)*)\](:|$))?(([a-zA-Z0-9_.-]+!?[=~](['\/]).*?\8(,|;|$))*)/;
			const query = tempOptions.query.replace(/ */g, '');
			if (!query.match(regex)) {
				console.error('Query have to be valid');
				process.exit(1);
			}
			options.query = query;
		} else {
			console.error('Query cannot be empty');
			process.exit(1);
		}
	}

	return options;
};

const parseQuery = (options) => {
	if (!options.query) {
		return {
			matches: (_) => true,
			columns: (_) => _,
		};
	}

	const regex = /^(\[(((\.\.\.|[a-zA-Z0-9_.-]+),?)*)\](:|$))?(([a-zA-Z0-9_.-]+!?[=~](['\/]).*?\8(,|;|$))*)/;
	const result = regex.exec(options.query);
	const columns = result[2] !== undefined ? result[2] : '...';
	let operators = result[6];
	const conditions = [[]];

	operators &&
		operators.split(/(?<=[,;])/g).forEach((operator) => {
			const result = /^([a-zA-Z0-9_.-]+)(!?[=~])(['\/])(.*)?\3([,;])?/.exec(
				operator,
			);
			const column = result[1];
			const action = result[2];
			const isRegex = result[3] === '/';
			const value = result[4];
			const newGroup = result[5] === ';';

			if (isRegex && action.includes('~')) {
				console.error(
					'Regex matching can only be used with a equals sign: "column=/regex/" or "column!=/regex/"',
				);
				process.exit(1);
			}

			conditions[conditions.length - 1].push({
				[column]: {
					matches: (v) => {
						let negation =
							action.startsWith('!') && action.slice(1) && true;
						v = typeof v === 'object' ? JSON.stringify(v) : v;
						if (action === '~') {
							return negation
								? !(v && v.includes(value))
								: v && v.includes(value);
						}

						if (isRegex) {
							return negation
								? !(v && v.match(new RegExp(value)))
								: v && v.match(new RegExp(value));
						}

						return negation ? v !== value : v === value;
					},
				},
			});

			if (newGroup) {
				conditions.push([]);
			}
		});

	const columnMatcher = (original) => {
		let output = columns;
		output = output.split(',');
		const index = output.indexOf('...');
		if (index !== -1) {
			output.splice(index, 1);
			output = [
				...output,
				...original.filter((column) => columns.indexOf(column) === -1),
			];
		}
		return output;
	};

	return {
		matches: (value) => {
			let result = false;
			for (const group of conditions) {
				let tempResult = true;
				for (const condition of group) {
					for (let column in condition) {
						let v = value[column];
						if (column.includes('.')) {
							v = value;
							const tree = column.split('.');
							tree.forEach((c) => (v = v && v[c]));
						}

						if (!condition[column].matches(v)) {
							tempResult = false;
						}
					}
				}
				if (tempResult) {
					result = tempResult;
				}
			}

			return result;
		},
		columns: columnMatcher,
	};
};

const parseLogs = async (args, query) => {
	const entries = await fs.readdir(args.directory);
	const files = [];
	for (const entry of entries) {
		if ((await fs.stat(`${args.directory}/${entry}`)).isFile()) {
			if (!args.extension || entry.endsWith(`.${args.extension}`)) {
				files.push(entry);
			}
		}
	}

	const logs = [];
	for (const file of files) {
		const content = (
			await fs.readFile(`${args.directory}/${file}`)
		).toLocaleString();
		const logEntries = content
			.split('\n')
			.filter((line) => !!line)
			.map((line) => JSON.parse(line));
		logs.push({ file, logEntries });
	}

	const columns = query.columns(
		getCommonColumns(logs.flatMap((log) => log && log.logEntries)),
	);
	const data = [columns];

	logs.forEach((log) => {
		log.logEntries.forEach((logEntry) => {
			if (query.matches(logEntry)) {
				data.push(
					columns.map((column) => {
						let value = logEntry[column];
						if (column.indexOf('.') !== -1) {
							const tree = column.split('.');
							value = logEntry;
							for (const branch of tree) {
								if (typeof value !== 'object') {
									return null;
								}
								value = value[branch];
							}
						}
						return typeof value === 'object'
							? JSON.stringify(value)
							: value;
					}),
				);
			}
		});
	});
	if (data[0].length !== 0) {
		console.log(
			table.table(data, {
				columnDefault: {
					width: 15,
					wrapWord: true,
				},
			}),
		);
	}
};

const getCommonColumns = (entries) => {
	if (entries.length === 0) {
		return [];
	}

	const columns = Object.keys(entries[0]);
	for (let i = 1; i < entries.length; i++) {
		for (let j = columns.length - 1; j >= 0; j--) {
			let index = Object.keys(entries[i]).indexOf(columns[j]);
			if (index === -1) {
				columns.splice(j, 1);
			}
		}
	}
	return columns;
};

const logParser = async (args) => {
	const options = await parseArgs(args);
	await parseLogs(options, parseQuery(options));
};

logParser(process.argv.slice(2));
