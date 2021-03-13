# jsworkers
Javascript parallel-computing library for both node.js and browser environment, no dependencies. It's created by modifying the source code of parallel.js (https://github.com/parallel-js/parallel.js), which is a well designed tiny library for multi-core processing in Javascript environment. jsworkers provides some handy additions like worker thread support (for node.js), unlimited function chaining, built-in promise support ...... to make javascript parallel programming even more interesting. 

## Installation
### For node.js app:
```
$ npm install jsworkers
```
### For web app:
```
<script src='./jsworkers/lib/index.js'></script>
```
## Usage
jsworkers covers all the features provided by [parallel.js](https://github.com/parallel-js/parallel.js), like require, spawn, map, reduce, options and environments (you may refer to parallel.js readme file for more information), and provides more regarding computing chaining, changing options on the fly, node.js worker threads supporting, promise based error catching and so on. 

### An example
```js
// filename: app.js
// install the moudle first by:
//   $ npm install jsworkers
var Jsworkers = require("jsworkers");
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

function error(e) {
  console.log(e);
}

// spawn 8 node.js worker threads to execute the map task, each of them runs the 'square'
// and then output the map result
// and then create 4 node.js processes (instead of worker threads) to execute the reduce task, each of them runs the 'add'
// and then output the reduce result
// any exceptions/errors happening during the whole process will be caught by the error handler. 
jsworkers.setOptions({maxWorkers: 8, processPreferred: false})
         .map(square)
	 .then(log)
	 .setOptions({maxWorkers: 4, processPreferred: true})
	 .reduce(add)
	 .then(log)
	 .catch(error);
```
Output:
```
$ node app.js
[
      1,    4,    9,   16,   25,   36,   49,   64,   81,
    100,  121,  144,  169,  196,  225,  256,  289,  324,
    361,  400,  441,  484,  529,  576,  625,  676,  729,
    784,  841,  900,  961, 1024, 1089, 1156, 1225, 1296,
   1369, 1444, 1521, 1600, 1681, 1764, 1849, 1936, 2025,
   2116, 2209, 2304, 2401, 2500, 2601, 2704, 2809, 2916,
   3025, 3136, 3249, 3364, 3481, 3600, 3721, 3844, 3969,
   4096, 4225, 4356, 4489, 4624, 4761, 4900, 5041, 5184,
   5329, 5476, 5625, 5776, 5929, 6084, 6241, 6400, 6561,
   6724, 6889, 7056, 7225, 7396, 7569, 7744, 7921, 8100,
   8281, 8464, 8649, 8836, 9025, 9216, 9409, 9604, 9801,
  10000
]
338350
```

### Three types of parallel execution
jsworkers supports process (node.js), worker thread (node.js) and web worker (browser). For node.js app, worker thread is preferable considering forking processes is expensive in terms of resources. When running on a node.js instance without worker-thread feature enabled (v10.x.x or before)，process will be selected as an alternative. In browser, web worker is the only choice for jsworkers.

For the node.js environment that supports both (process & worker thread), you have the discretion to choose any of them by specifing the "options" parameter either for the Jsworkers constructor or for the steOptions method:

Constructor way:
```
// use process instead of worker thread
let Jsworkers = new Jsworkers(data, {processPreferred: true}); 
```
setOptions way:
```
// use worker thead instead of process
// the second parameter of setOptions() method is related with function chaining and will be explained later.
Jsworkers.setOptions({processPreferred: false}, true); 
```
Without the option, worker thead will be selected as default.

### Promise and unlimited chaining
jsworkers uses promise through delegation, basically by keeping promise in a property to track the status of each parallel-computing task. Based on promise, jsworkers provides a couple of recipes to do function chaining, something looks like this:
```
jsworkers.setOptions({maxWorkers: 8, processPreferred: false})
         .map(square)
	 .then(log)
	 .setOptions({maxWorkers: 4, processPreferred: true})
	 .reduce(add)
	 .then(log)
	 .catch(error);
```
Each method returns a Jsworkers instance for chaining purpose. Here, setOptions() is not a necessity, but it gives you the flexibility to change options on the fly, even change the options of whether using process or thread, the worker amount, the execution scripts of the worker, etc. The second parameter of setOptions supplys extra adaptability: 
<pre>
jsworkers.setOptions({processPreferred: true}, <b>true</b>).map(square); // (*)
jsworkers.map(cube); //(**)
</pre>
The setOptions() call in line (\*) is provided with a second parameter (value true). It tells setOptions() method to change the options in the immediate left object (visually left, here, it's jsworkers). As a result, both the map() call in line (\*) and line (\*\*) will use process instead of worker thread for calculating purpose. Similarly, in the following code snippet, the first map() call will use worker thread (because it's default), the second map() and the following reduce() will employ process instead: 
<pre>
// the following setOptions() will pose an impact on the italic part
jsworkers.map(...)<i>.map(...).setOptions({processPreferred: true}, <b>true</b>).reduce(...)</i>
</pre>
Without the second parameter (or give it a value false), setOptions() will impact on its right (visually right) part:
<pre>
// the following setOptions() will pose an impact on the italic part
jsworkers.map(...).map(...)<i>.setOptions({processPreferred: true}).reduce(...)</i>
</pre>

### Multiple computing branch supporting
```
function fib(n) {
  return n < 2 ? 1 : fib(n - 1) + fib(n - 2);
}

function square(n) {
  return n * n;
}

function cube(n) {
  return n * n * n;
}

function add(d) {
  return d[0] + d[1];
}

function error(e) {
  console.log(e);
}

let tempJsworkers = jsworkers.map(fib); // (*)
tempJsworkers.map(square).reduce(add).then(log).catch(error); // (**)
tempJsworkers.map(cube).reduce(add).then(log).catch(error); // (***)         
```
map() in line (\*) calculates the Fibonacci Sequence, and save the result temporarily in `tempJsworkers`. Based on that, line (\*\*) computes the sum of the square , and line (\*\*\*) figures the sum of cube. <br/>
line (\*\*) finally produces ![\sum_{i=1}^{n}\[fib(i)\]^{2}](https://latex.codecogs.com/svg.latex?\sum_{i=1}^{n}\[fib(i)\]^{2}) <br/>
line (\*\*\*) finally produces ![\sum_{i=1}^{n}\[fib(i)\]^{3}](https://latex.codecogs.com/svg.latex?\sum_{i=1}^{n}\[fib(i)\]^{3}) <br/>


## License
MIT

## Acknowledgements
- [parallel.js](https://github.com/parallel-js/parallel.js)
