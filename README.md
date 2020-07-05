# Log parser

![Tests](https://github.com/Pawelek99/LogParser/workflows/Tests/badge.svg) [![npm version](https://badge.fury.io/js/LogParser.svg)](https://badge.fury.io/js/LogParser)

---

To install **logparser** library just type in the console:

```bash
npm install [-g] logparser
```

If you want to see help, please type:

```bash
logparser ?
```

Synposis:

```bash
logparser [<directory>] [-e|--extension <extension>] [-q|--query <query>]
```

## Description

It's a simple CLI to help investigate logs in a JSON format. It can parse, display and filter them.
To make filtering easier you can use this simple query language:

> `[column1, column2, ...]: column1='value1', column3=/regex1/; column4!='value3'`

Which will be interpreted as: select `column1`, `column2` and all the common columns where `column1` is equal to `value1` and `column3` matches regex `regex1` or `column4` is not equal to `value3`.

Let's just go over every fragment and explain them thoroughly.
Query consist of column selection (optional) followed by filter expressions (optional as well). Column selection is enclosed between `[` and `]` and followed by `:` if there are filter expressions. To make sure column is select, provide its name. If you want to select all common columns, type `...`. 
Filter expressions consist of key-value pairs such as `column='value'`. There's three possible equality checks you can use:

- equals:
  ```bash
  logparser -q="column='value'"
  ```
  This will filter all entries which have values of `column` equal to `value`.
  If you want to filter all entries that are NOT equal, type:
  ```bash
  logparser -q="column!='value'"
  ```
- contains
  ```bash
  logparser -q="column~'value'"
  ```
  It will make sure that only entries which have values of `column` parsed as strings containig `value` in it will show up.
  If you want to do reverse thing, type:
  ```bash
  logparser -q="column!~'value'"
  ```
- matches regex
  ```bash
  logparser -q="column=/regex/"
  ```
  To select columns which values are matched by a given `regex` type the above command. If you want to select all entries NOT matching the given regex, type:
  ```bash
  logparser -q="column!=/regex/"
  ```

If you want to combine multiple expressions you can use operators `,` or `;` which respectively are interpreted as `AND` and `OR`. Keep in mind that you cannot use parenthesis to group them. Despite that you can create any expression you want with this simple rules. Remember that operator `AND` is always more important.

For example:

```bash
logparser -q="column1='value1'; column2!='value2', column3=/regex1/"
```
This will be parsed as: select all columns such that `column1` is equal to `value1` OR (`column2` is not equal to `value2` AND `column3` matches `regex1`).

---

## Sample usages:

- ```bash
  logparser -e log
  logparser . -e log
  logparser --extension log .
  ```
  It will display all logs from a current directory which have '.log' extension.
- ```bash
  logparser /var/www/logs -q="message='error'"
  logparser /var/www/logs -q="[...]: message='error'"
  ```
  It will display logs which have value of 'message' column equal to 'error' from all files from the '/var/www/logs' directory.
- ```bash
	logparser -q="[customProperties]"
	logparser -q="[customProperties]:"
  ```
  This command allows to display only the given columns. In this case - column 'customProperties'.
- ```bash
  logparser -q="[customProperties.date]"
  ```
  This lets you to select nested columns. 
- ```bash
  logparser -q="customProperties.timestamp~'2020-07'"
  ```
  If you want to filter by a nested column you can simply split columns by a `.` (dot).
  More complex nesting is also possible:
  ```bash
  logparser -q="customProperties.date.day='12'"
  ```
