# jsworkers
Javascript parallel-computing library for both node.js and browser environment, no dependencies. It's created by modifying the source code of parallel.js (https://github.com/parallel-js/parallel.js), which is a well designed tiny library for multi-core processing in Javascript environment. 


## Install
```
npm install --save jsworkers
```
## Use
Require the jsworkers module and initialize with a `Jsworkers` instance:
```js
var Jsworkers = require("./jsworkers");
var data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            11,12,13,14,15,16,17,18,19,20,
	    21,22,23,24,25,26,27,28,29,30,
	    31,32,33,34,35,36,37,38,39,40,
	    41,42,43,44,45,46,47,48,49,50,
	    51,52,53,54,55,56,57,58,59,60,
	    61,62,63,64,65,66,67,68,69,70,
	    71,72,73,74,75,76,77,78,79,80,
	    81,82,83,84,85,86,87,88,89,90,
	    91,92,93,94,95,96,97,98,99,100];
var jsworkers = new Jsworkers(data);

function log(result) {
  console.log(result);
  return result;
}

function square(n) {
  return n * n;
}

function add(d) {
  return d[0] + d[1];
}

jsworkers.map(square).then(log).reduce(add).then(log);
```
## Related
- [parallel.js](https://github.com/parallel-js/parallel.js)

## License
MIT

The readme file will be updated recently, with the information about how to use it in detail, as well as ideas behind the scenes.
