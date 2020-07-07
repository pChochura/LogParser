const validationRegex = /^(\[(.*?)(:|$))?((.*?\(?[a-z0-9._-]+\)?[=~!<>]{1,2}(.*\('.*?'\)|(['\/])?.*?\7)(&|\||$)?)*)/i;
const operatorRegex = /^([a-z0-9_.()-]+)([=~!<>]{1,2})((.*\('.*?'\))|(['\/])(.*)?\5)([|&])?/i;
const expressionRegex = /^[a-z]+\([żąółźńćęśa-z0-9_.-]+\)(!?[=~]|[<>]=?)('|\/)[ żąółźńćęśa-z0-9(){}\[\]_:.,-]+\2$|^[żąółźńćęśa-z0-9_.-]+(!?=|[<>]=?)[a-z]+\('[[{]?[ żąółźńćęśa-z0-9(){}\[\]_:.,-]*[}\]]?'\)$|^[żąółźńćęśa-z0-9_.-]+(!?[=~]|[<>]=?)(['\/])[ żąółźńćęśa-z0-9(){}\[\]_:.,-]+\5$/;
const dateRegex = /^\d{4}(-\d{1,2}(-\d{1,2})?)?( \d{1,2}(:\d{1,2})?(:\d{1,2})?)?$/;

const getFunctionFromValue = (value) => {
	const indexOfOpeningBracket = value.indexOf('(');
	const indexOfClosingBracket = value.lastIndexOf(')');
	const method =
		indexOfOpeningBracket !== -1 && value.slice(0, indexOfOpeningBracket);

	return {
		method,
		argument: method
			? value.slice(indexOfOpeningBracket + 1, indexOfClosingBracket)
			: value,
	};
};

const parseValue = (value) => {
	if (!value) {
		return value;
	}

	if (parseFloat(value) == value) {
		return parseFloat(value);
	}

	if (typeof value === 'object') {
		return JSON.stringify(value);
	}

	return value;
};

const parseEntries = (value, padding = 1) => {
	return value
		.slice(padding, value.length - padding)
		.split(',')
		.filter(Boolean);
};

const checkIfEntryIsMissing = (input1, input2, callback) => {
	for (const entry in input1) {
		if (!callback(entry, input1[entry], input2)) {
			return false;
		}
	}
	for (const entry in input2) {
		if (!callback(entry, input2[entry], input1)) {
			return false;
		}
	}

	return true;
};

const isValueMatchedByExpression = (
	existingValue,
	value,
	operation,
	isRegex,
	column,
) => {
	existingValue = parseValue(existingValue);
	switch (column.method) {
		case 'floor':
			existingValue = Math.floor(existingValue);
			break;
		case 'ceil':
			existingValue = Math.ceil(existingValue);
			break;
		case 'round':
			existingValue = Math.round(existingValue);
			break;
	}

	if (!existingValue) {
		return false;
	}

	switch (value.method) {
		case 'date':
			if (!value.argument.match(dateRegex)) {
				console.error(
					`Following value is not valid date: ${value.argument}`,
				);
				process.exit(1);
			}

			value.argument = new Date(value.argument);
			existingValue = new Date(existingValue);
			break;
		case 'array':
			if (!['=', '!='].includes(operation)) {
				console.error(
					`Following expression is not valid: ${
						column.method
							? `${column.method}(${column.argument})`
							: column.argument
					}${operation}${
						value.method
							? `${value.method}(${value.argument})`
							: value.argument
					}`,
				);
				process.exit(1);
			}

			value.argument = parseEntries(value.argument, 2);
			try {
				existingValue = JSON.parse(existingValue);
			} catch (error) {
				// It is not valid JSON object
				return operation[0] === '!';
			}

			if (!Array.isArray(existingValue)) {
				return operation[0] === '!';
			}

			const index = value.argument.indexOf('...');
			if (index !== -1) {
				value.argument.splice(index, 1);
				value.argument.push(...existingValue);
				value.argument = [...new Set(value.argument)];
			}

			return (
				(operation[0] === '!') !==
				checkIfEntryIsMissing(
					value.argument,
					existingValue,
					(_, value, input) => input.includes(value),
				)
			);
		case 'object':
			if (!['=', '!='].includes(operation)) {
				console.error(
					`Following expression is not valid: ${
						column.method
							? `${column.method}(${column.argument})`
							: column.argument
					}${operation}${
						value.method
							? `${value.method}(${value.argument})`
							: value.argument
					}`,
				);
				process.exit(1);
			}

			let parsedValue = {};
			try {
				existingValue = JSON.parse(existingValue);
			} catch (error) {
				// It is not valid JSON object
				return operation[0] === '!';
			}

			if (Array.isArray(existingValue)) {
				return operation[0] === '!';
			}

			parseEntries(value.argument, 2).forEach((entry) => {
				const keyValuePair = entry.split(':');
				if (keyValuePair[0] === '...') {
					parsedValue = {
						...parsedValue,
						...existingValue,
					};

					return;
				}

				parsedValue[keyValuePair[0]] = keyValuePair[1];
			});

			return (
				(operation[0] === '!') !==
				checkIfEntryIsMissing(
					parsedValue,
					existingValue,
					(key) => parsedValue[key] === existingValue[key],
				)
			);
	}

	switch (operation) {
		case '<':
		case '>':
		case '<=':
		case '>=':
		case '!=':
		case '=':
			if (operation.match(/^!?=$/) && isRegex) {
				return (
					(operation[0] === '!') !==
					!!existingValue.match(new RegExp(value.argument))
				);
			}

			switch (operation[0]) {
				case '<':
					return (
						existingValue &&
						(operation[1] === '='
							? existingValue <= value.argument
							: existingValue < value.argument)
					);
				case '>':
					return (
						existingValue &&
						(operation[1] === '='
							? existingValue >= value.argument
							: existingValue > value.argument)
					);
				case '!':
					return existingValue !== value.argument;
				default:
					return existingValue === value.argument;
			}
		case '~':
		case '!~':
			return (
				existingValue &&
				(operation[0] === '!') !==
					existingValue.includes(value.argument)
			);
	}

	return false;
};

const getConditionsFromExpressions = (expressions) => {
	if (!expressions) {
		return [[]];
	}

	const conditions = [[]];

	expressions.split(/(?<=[&|])/g).forEach((expression) => {
		if (!expression.match(expressionRegex)) {
			console.error(`Following expression is not valid: ${expression}`);
			process.exit(1);
		}

		const result = operatorRegex.exec(expression);
		const column = getFunctionFromValue(result[1]);

		const operation = result[2];
		const isRegex = result[5] === '/';

		const value = getFunctionFromValue(result[4] || result[6]);
		value.argument = value.argument.slice(1, value.argument.length - 1);

		conditions[conditions.length - 1].push({
			[column.argument]: {
				matches: (existingValue) => {
					return isValueMatchedByExpression(
						existingValue,
						{ ...value },
						operation,
						isRegex,
						{ ...column },
					);
				},
			},
		});

		// If the expressions are split by a '|' it means that we have to create another 'AND' group
		result[7] === '|' && conditions.push([]);
	});

	return conditions;
};

const parseNestedColumn = (entry) => {
	const startIndex = entry.indexOf('[');
	const endIndex = entry.lastIndexOf(']');
	if (startIndex === -1 || endIndex === -1) {
		return [entry];
	}

	const parent = entry.slice(0, startIndex);
	const columns = parseColumns(entry.slice(startIndex + 1, endIndex));
	return columns.map((n) => (n === '...' ? parent : parent + '.' + n));
};

const parseColumns = (columns) => {
	const parsedColumns = columns.split(',');
	const openingBracketRegex = /\[/g;
	const closingBracketRegex = /\]/g;
	for (let i = parsedColumns.length - 1; i >= 0; i--) {
		if (
			(parsedColumns[i].match(closingBracketRegex) || []).length !==
			(parsedColumns[i].match(openingBracketRegex) || []).length
		) {
			parsedColumns[Math.max(i - 1, 0)] =
				parsedColumns[i - 1] + ',' + parsedColumns[i];
			i > 0 && delete parsedColumns[i];
		}
	}

	return parsedColumns.flatMap(
		(column) => column && parseNestedColumn(column),
	);
};

const parseQuery = (options) => {
	if (!options.query) {
		return {
			matches: (_) => true,
			columns: (_) => _,
		};
	}

	const result = validationRegex.exec(options.query);
	const columns =
		result[2] !== undefined
			? result[2].slice(0, result[2].length - 1)
			: '...';
	const parsedColumns = parseColumns(columns);
	const conditions = getConditionsFromExpressions(result[4]);

	const columnMatcher = (original) => {
		if (parsedColumns.includes('...')) {
			return [
				...parsedColumns.filter((column) => column !== '...'),
				...original.filter((column) => !parsedColumns.includes(column)),
			];
		}

		return parsedColumns;
	};

	const valueMatcher = (value) => {
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
	};

	return {
		matches: valueMatcher,
		columns: columnMatcher,
	};
};

module.exports = {
	parse: parseQuery,
};
