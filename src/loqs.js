const table = require('table');
const fs = require('fs').promises;

const loadFilesFrom = async (directory, extension) => {
	const entries = await fs.readdir(directory);
	const files = [];
	for (const entry of entries) {
		if (
			(await fs.stat(`${directory}/${entry}`)).isFile() &&
			(!extension || entry.endsWith(`.${extension}`))
		) {
			files.push(`${directory}/${entry}`);
		}
	}

	return files;
};

const getLogsFromFiles = async (files) => {
	return Promise.all(
		files.map(async (file) => {
			const content = (await fs.readFile(file)).toString();
			const logEntries = content
				.split('\n')
				.filter((line) => line)
				.map((line) => JSON.parse(line));

			return { file, logEntries };
		}),
	);
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

const getRowFromLogEntry = (columns, logEntry) => {
	return columns.map((column) => {
		let value = logEntry[column];
		if (column.indexOf('.') !== -1) {
			const nestedEntries = column.split('.');
			value = logEntry;
			for (const nestedEntry of nestedEntries) {
				if (typeof value !== 'object') {
					return null;
				}
				value = value[nestedEntry];
			}
		}

		return typeof value === 'object' ? JSON.stringify(value) : value;
	});
};

const parseLogs = async (args, query, display = true) => {
	const files = await loadFilesFrom(args.directory, args.extension);
	const logs = await getLogsFromFiles(files);

	const columns = query.columns(
		getCommonColumns(logs.flatMap((log) => log && log.logEntries)),
	);
	const data = [columns];

	logs.forEach((log) =>
		log.logEntries.forEach((logEntry) => {
			if (query.matches(logEntry)) {
				data.push(getRowFromLogEntry(columns, logEntry));
			}
		}),
	);

	if (data[0].length !== 0 && display) {
		console.log(
			table.table(data, {
				columnDefault: {
					width: 15,
					wrapWord: true,
				},
			}),
		);
	}

	return data;
};

module.exports = {
	parse: parseLogs,
};
