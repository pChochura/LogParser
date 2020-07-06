# Log parser

![Tests](https://github.com/Pawelek99/LogParser/workflows/Tests/badge.svg) [![npm version](https://badge.fury.io/js/loqs.svg)](https://badge.fury.io/js/loqs)

---

To install **loqs** library just type in the console:

```bash
npm install [-g] loqs
```

If you want to see help, please type:

```bash
loqs ?
```

Synposis:

```bash
loqs [<directory>] [-e|--extension <extension>] [-q|--query <query>]
```

## Description

It's a simple CLI to help investigate logs in a JSON format. It can parse, display and filter them.
To make filtering easier you can use this simple query language:

> `[column1, column2[subColumn1, ...], ...]: column1='value1', column3=/regex1/; column4!='value3'`

Which will be interpreted as: select `column1`, `column2` and additionally `column2.subColumn1` and all the common columns where `column1` is equal to `value1` and `column3` matches regex `regex1` or `column4` is not equal to `value3`.

Let's just go over every fragment and explain them thoroughly.
Query consist of column selection (optional) followed by filter expressions (optional as well). Column selection is enclosed between `[` and `]` and followed by `:` if there are filter expressions. To make sure column is select, provide its name. If you want to select all common columns, type `...`. If you want to select nested columns provide their names in a dot notation, for example: `column1.subColumn1` or if you want to select more than one sub column at once, type as follows: `column1[subColumn1, subColumn2, ...]`. If you want to select ONLY `subColumn1` and `subColumn2` omit `...` parameter.
Filter expressions consist of key-value pairs such as `column='value'`. There's five possible equality checks you can use:

- equals:
  ```bash
  loqs -q "column='value'"
  ```
  This will filter all entries which have values of `column` equal to `value`.
  If you want to filter all entries that are NOT equal, type:
  ```bash
  loqs -q "column!='value'"
  ```
- less than:
  ```bash
  loqs -q "column<'10'"
  ```
  This way you can filter `column` to show only values which are less than `10`. Remember that it only works for numbers or functions (described below).
  If you want to check column for values less than or equal to, type:
  ```bash
  loqs -q "column<='-11'"
  ```
  Even if this is a number it has to be enclosed between `'`.
- greater than:
  ```bash
  loqs -q "column>'10'"
  ```
  This way you can filter `column` to show only values which are greater than `10`. Remember that it only works for numbers or functions (described below).
  If you want to check column for values greater than or equal to, type:
  ```bash
  loqs -q "column>='-11'"
  ```
  Even if this is a number it has to be enclosed between `'`.
- contains
  ```bash
  loqs -q "column~'value'"
  ```
  It will make sure that only entries which have values of `column` parsed as strings containig `value` in it will show up.
  If you want to do reverse thing, type:
  ```bash
  loqs -q "column!~'value'"
  ```
- matches regex
  ```bash
  loqs -q "column=/regex/"
  ```
  To select columns which values are matched by a given `regex` type the above command. If you want to select all entries NOT matching the given regex, type:
  ```bash
  loqs -q "column!=/regex/"
  ```

To combine multiple expressions you can use operators `,` or `;` which respectively are interpreted as `AND` and `OR`. Keep in mind that you cannot use parenthesis to group them. Despite that you can create any expression you want with this simple rules. Remember that operator `AND` is always more important.

For example:

```bash
loqs -q "column1='value1'; column2!='value2', column3=/regex1/"
```
This will be parsed as: select all columns such that `column1` is equal to `value1` OR (`column2` is not equal to `value2` AND `column3` matches `regex1`).

### Functions

To help filter values we provide you with utility functions such as:

- `date('value')`
  
  Converts the given `value` to a date and allows to filter values as a date instead of comparing strings.
  ```bash
  loqs -q "timestamp<=date('2020-06-02')"
  loqs -q "timestamp=date('2018-03-01')"
  ```
- `floor(column)`
  
  Parses the given column as a number and if it is a floating point number uses floor function.
  ```bash
  loqs -q "[floor(amount)]"
  loqs -q "[floor(price.amount)]"
  loqs -q "floor(amount)='12'"
  ```
  It allows you to floor selected columns as well as filtered values.
- `ceil(column)`
  
  Parses the given column as a number and if it is a floating point number uses ceil function.
  ```bash
  loqs -q "[ceil(amount)]"
  loqs -q "[ceil(price.amount)]"
  loqs -q "ceil(amount)='11'"
  ```
  It allows you to ceil selected columns as well as filtered values.
- `round(column)`
  
  Parses the given column as a number and if it is a floating point number uses round function.
  ```bash
  loqs -q "[round(amount)]"
  loqs -q "[round(price.amount)]"
  loqs -q "round(amount)='11'"
  ```
  It allows you to round selected columns as well as filtered values.
- `array('[value1, value2]')`

  Interprets the given value as a JSON array and allows to check for equality no matter array entries order. Only works for equality (or not equal) checks and can be used only for filtering.
  ```bash
  loqs -q "currencies=array('[PLN, EUR]')"
  loqs -q "currencies=array('[PLN, ...]')"
  loqs -q "errors=array('[]')"
  loqs -q "selectOnlyIfThisColumnIsArray=array('[...]')"
  ```
  If you want to check just if the array contains the given value add `...` to the list. If omitted arrays have to match every entry.
- `object('{ key1: value1, key2: value2 }')`
  
  Interprets the given value as a JSON object and allows to check for equality no matter key-value pairs order. Only works for equality (or not equal) checks and can be used only for filtering.
  ```bash
  loqs -q "currencies=object('{ PLN: 40, EUR: 10 }')"
  loqs -q "currencies=object('{ PLN: 40, ... }')"
  loqs -q "errors=object('{}')"
  loqs -q "selectOnlyIfThisColumnIsObject=object('{...}')"
  ```
  If you want to check just if the object contains the given key-value pair add `...` to the object. If omitted objects have to match every key-value pair.

---

## Sample usages:

- ```bash
  loqs -e log
  loqs . -e log
  loqs --extension log .
  ```
  It will display all logs from a current directory which have '.log' extension.
- ```bash
  loqs /var/www/logs -q "message='error'"
  loqs /var/www/logs -q "[...]: message='error'"
  ```
  It will display logs which have value of 'message' column equal to 'error' from all files from the '/var/www/logs' directory.
- ```bash
  loqs -q "[customProperties]"
  loqs -q "[customProperties]:"
  ```
  This command allows to display only the given columns. In this case - column 'customProperties'.
- ```bash
  loqs -q "[customProperties.date]"
  loqs -q "[customProperties[date, email]]"
  loqs -q "[customProperties[date[day, month], ...]]"
  ```
  This lets you to select nested columns. 
- ```bash
  loqs -q "customProperties.timestamp~'2020-07'"
  ```
  If you want to filter by a nested column you can simply split columns by a `.` (dot).
  More complex nesting is also possible:
  ```bash
  loqs -q "customProperties.date.day='12'"
  ```
- ```bash
  loqs -q "[floor(amount), ...]: timestamp<=date('2020-05-03')"
  ```
  Above expression will display all columns and additionally column `amount` parsed as a number and rounded up to the biggest (but not larger than now) integer where values of column `timestamp` are smaller or equal to `2020-05-03` which means before or at the given date.
