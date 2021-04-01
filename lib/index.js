/* ============================================================
 * jsworkers
 * https://github.com/brucecan/jsworkers
 * ============================================================
 * This project is a reworking of parallel.js:
 *  https://github.com/parallel-js/parallel.js 
 * 
 * jsworkers is released under the MIT License
 * ============================================================
 * @module jsworkers
 * @return {object} instance of Jsworkers 
 * ==========================================================*/
(function () {
  const isCommonJS = typeof module !== "undefined" && module.exports;
  const isNode = !(typeof window !== "undefined" && this === window);
  var setImmediate =
    setImmediate ||
    function (cb) {
      setTimeout(cb, 0);
    };

  // It's a uniform process/thread wrapper.
  // unfortunately, there is no built-in equivalent for 'require' in browser, 
  // so this wrapper only works for node.js. In Browser, self.Worker will be
  // employed directly.
  const Worker = isNode ? require(`${__dirname}/worker.js`) : self.Worker;

  // the fork functions/constructors below will be called by
  // the process/thread wrapper above to create node.js process 
  // or node.js worker threads based on the current execution 
  // environment and configuration options.
  // processFork is a function, so the variable name starts with 
  // a lower case letter. ThreadFork is a constructor, therefore 
  // the variable name starts with a capital letter.
  let processFork = isNode ? require('child_process').fork : undefined;
  let ThreadFork = undefined;

  // is node.js worker_threads module available?
  let isThreadAvail = undefined;

  if(isNode) {
    try{
      ({Worker: ThreadFork, isMainThread: isThreadAvail} = require('worker_threads'));
    } catch (error) {
    }
  } 

  const URL =
    typeof self !== "undefined" ? (self.URL ? self.URL : self.webkitURL) : null;
  const _supports = !!(isNode || self.Worker); // node always supports parallel

  function extend(from, to) {
    if (!to) to = {};
    for (const i in from) {
      if (to[i] === undefined) to[i] = from[i];
    }
    return to;
  }

  function copy(data) {
    if (!data || !data.length) {
      return data;
    } else {
      try {
        return Array.prototype.slice.call(data);
      } catch (error) {
        return undefined;
      }
    }
  }

  function setPromise(jsworkers, promise, resolve, reject) {
    jsworkers.promise = promise;
    jsworkers.resolve = resolve;
    jsworkers.reject = reject;

    jsworkers.status = Jsworkers.Promise.STATUS_PENDING;
    jsworkers.promise
      .then(function () {
        jsworkers.status = Jsworkers.Promise.STATUS_RESOLVED;
      })
      .catch(function () {
        jsworkers.status = Jsworkers.Promise.STATUS_REJECTED;
      });
  }

  const defaults = {
    evalPath: !isNode ? undefined : isThreadAvail ? `${__dirname}/evalwt.js` : `${__dirname}/eval.js` ,
    maxWorkers: isNode
      ? require("os").cpus().length
      : navigator.hardwareConcurrency || 4,
    synchronous: true,
    env: {},
    envNamespace: "env",
    processPreferred: false
  };

  function Jsworkers(data, options, promise, debug) {
    promise =
      promise !== undefined ? promise : Jsworkers.Promise.CREATE_RESOLVED;

    this.debug = debug;

    this.data = data;

    let rectifyEval = !!(
      isNode &&
      options && 
      (!options.evalPath || options.evalPath.length <= 0) && 
      typeof options.processPreferred === "boolean"
      );
    this.options = extend(defaults, options);
    if(rectifyEval){
      if(this.options.processPreferred) 
        this.options.evalPath = `${__dirname}/eval.js`;
      else 
        this.options.evalPath = `${__dirname}/evalwt.js`;
      }

    var that = this;
    if (
      promise === Jsworkers.Promise.CREATE_RESOLVED ||
      promise === Jsworkers.Promise.CREATE_PENDING
    ) {
      this.status = Jsworkers.Promise.STATUS_PENDING;

      this.promise = new Promise(function (resolve, reject) {
        that.resolve = resolve;
        that.reject = reject;
        if (promise === Jsworkers.Promise.CREATE_RESOLVED) resolve(that.data);
      });

      this.promise
        .then(function (result) {
          that.status = Jsworkers.Promise.STATUS_RESOLVED;
        })
        .catch(function (error) {
          that.status = Jsworkers.Promise.STATUS_REJECTED;
        });
    }

    this.requiredScripts = [];
    this.requiredFunctions = [];
  }

  // static constants
  Jsworkers.Promise = Object.freeze({
    CREATE_RESOLVED: 1, // create resolved promise
    CREATE_PENDING: 2, // create pending promise
    CREATE_NONE: 3, // not create any promise
    STATUS_PENDING: 0, // current promise status: pending
    STATUS_RESOLVED: 1, // current promise status: resolved
    STATUS_REJECTED: 2, // current promise status: rejected
  });

  // static method
  Jsworkers.isSupported = function () {
    return _supports;
  };

  Object.defineProperty(Jsworkers.prototype, "isSettled", {
    get: function () {
      return (
        this.status === Jsworkers.Promise.STATUS_RESOLVED ||
        this.status === Jsworkers.Promise.STATUS_REJECTED
      );
    },
  });

  Jsworkers.prototype.setOptions = function (options, left) {
    let that = null;
    if(left) {
      // set options for the current Jsworkers object, 
      // visually, poses an impact on the immediate left object 
      that = this;
    }
    else {
      // set options for the new Jsworkers object,
      // visually, poses an impact on the right objects
      that = new this.constructor(null, this.options, Jsworkers.Promise.CREATE_NONE, "setOptions");
      that.promise = this.promise;
    }

    let rectifyEval = !!(
      isNode &&
      options && 
      (!options.evalPath || options.evalPath.length <= 0) && 
      typeof options.processPreferred === "boolean"
      );
 
    that.options = extend(that.options, options);
    if(rectifyEval){ 
      if(that.options.processPreferred)
        that.options.evalPath = `${__dirname}/eval.js`;
      else
        that.options.evalPath = `${__dirname}/evalwt.js`;
    }

    return that;
  }

  function _getWorkerSource(that, cb, env) {
    let preStr = "";
    let i = 0;
    if (!isNode && that.requiredScripts.length !== 0) {
      preStr += `importScripts("${that.requiredScripts.join('","')}");\r\n`;
    }

    for (i = 0; i < that.requiredFunctions.length; ++i) {
      if (that.requiredFunctions[i].name) {
        preStr += `var ${
          that.requiredFunctions[i].name
        } = ${that.requiredFunctions[i].fn.toString()};`;
      } else {
        preStr += that.requiredFunctions[i].fn.toString();
      }
    }

    env = JSON.stringify(env || {});

    const ns = that.options.envNamespace;

    if (isNode) {
      if(isThreadAvail && !that.options.processPreferred)
        return `${preStr}parentPort.on("message", function(e) {global.${ns} = ${env};parentPort.postMessage((${cb.toString()})(e.data))})`;
      else
        return `${preStr}process.on("message", function(e) {global.${ns} = ${env};process.send(JSON.stringify((${cb.toString()})(JSON.parse(e).data)))})`;
    }
    return `${preStr}self.onmessage = function(e) {var global = {}; global.${ns} = ${env};self.postMessage((${cb.toString()})(e.data))}`;
  }

  Jsworkers.prototype.require = function () {
    const args = Array.prototype.slice.call(arguments, 0);
    if(args.length === 0) return this;
    if(typeof args[args.length] === "boolean") var left = args[args.length];

    if(left){
      for (let i = 0; i < args.length; i++) {
        let func = args[i];
        if (typeof func === "string") {
          this.requiredScripts.push(func);
        } else if (typeof func === "function") {
          this.requiredFunctions.push({ fn: func });
        } else if (typeof func === "object") {
          this.requiredFunctions.push(func);
        }
      }
      return this;
    } else {
      const that = new this.constructor(null, this.options, Jsworkers.Promise.CREATE_NONE, "require");
      that.promise = this.promise;
      for (let i = 0; i < args.length; i++) {
        let func = args[i];
        if (typeof func === "string") {
          that.requiredScripts.push(func);
        } else if (typeof func === "function") {
          that.requiredFunctions.push({ fn: func });
        } else if (typeof func === "object") {
          that.requiredFunctions.push(func);
        }
      }
      return that;
    }
  };

  function _spawnWorker(that, cb, env) {
    let wrk;
    const src = _getWorkerSource(that, cb, env);
    if (isNode) {
      if(!that.options.processPreferred && isThreadAvail)
        wrk = new Worker(that.options.evalPath, ThreadFork, Worker.Type.WORKERTHREAD);
      else
        wrk = new Worker(that.options.evalPath, processFork, Worker.Type.PROCESS);
      wrk.postMessage(src);
    } else {
      if (Worker === undefined) {
        return undefined;
      }

      try {
        if (that.requiredScripts.length !== 0) {
          if (that.options.evalPath !== null) {
            wrk = new Worker(that.options.evalPath);
            wrk.postMessage(src);
          } else {
            throw new Error("Can't use required scripts without eval.js!");
          }
        } else if (!URL) {
          throw new Error("Can't create a blob URL in this browser!");
        } else {
          const blob = new Blob([src], { type: "text/javascript" });
          const url = URL.createObjectURL(blob);

          wrk = new Worker(url);
        }
      } catch (e) {
        if (that.options.evalPath !== null) {
          // blob/url unsupported, cross-origin error
          wrk = new Worker(that.options.evalPath);
          wrk.postMessage(src);
        } else {
          throw e;
        }
      }
    }

    return wrk;
  }

  Jsworkers.prototype.spawn = function (cb, env, promise) {
    promise =
      promise !== undefined ? promise : Jsworkers.Promise.CREATE_PENDING;

    let timeout;

    env = extend(this.options.env, env || {});

    // create a new Jsworkers object for each new operation
    // and return the new created object for operation chaining
    const that = new this.constructor(null, this.options, promise, "spawn");
    this.promise
      .then(function (result) {
        let data = copy(result);

        if (env.timeout) {
          timeout = setTimeout(function () {
            if (!that.isSettled) {
              wrk.terminate();
              that.reject(new Error("Operation timed out!"));
            }
          }, env.timeout);
        }

        const wrk = _spawnWorker(that, cb, env);
        if (wrk !== undefined) {
          wrk.onmessage = function (msg) {
            if (timeout) clearTimeout(timeout);
            wrk.terminate();
            that.resolve(msg.data);
          };
          wrk.onerror = function (e) {
            if (timeout) clearTimeout(timeout);
            wrk.terminate();
            that.reject(e);
          };
          wrk.postMessage(data);
        } else if (that.options.synchronous) {
          setImmediate(() => {
            try {
              that.resolve(cb(data));
            } catch (e) {
              that.reject(e);
            }
          });
        } else {
          that.reject(
            new Error(
              "Workers do not exist and synchronous operation not allowed!"
            )
          );
        }
      })
      .catch(function () {
        // this.promise exceptions are supposed to have been handled before,
        // when this is 'that' at that moment. But, here, it's another independent
        // branch inheriting from this.promise, we still need a catch to prevent
        // internal unhandled exceptions from being produced.
      });

    return that;
  };

  function _spawnMapWorker(that, data, i, cb, env, wrk) {
    return new Promise(function (resolve, reject) {
      if (!wrk) wrk = _spawnWorker(that, cb, env);

      if (wrk !== undefined) {
        wrk.onmessage = function (msg) {
          resolve({ index: i, worker: wrk, value: msg.data });
        };
        wrk.onerror = function (e) {
          wrk.terminate();
          reject(e);
        };
        wrk.postMessage(data[i]);
      } else if (that.options.synchronous) {
        setImmediate(() => {
          resolve({ index: i, worker: null, value: cb(data[i]) });
        });
      } else {
        throw new Error(
          "Workers do not exist and synchronous operation not allowed!"
        );
      }
    });
  }

  Jsworkers.prototype.map = function (cb, env) {
    env = extend(this.options.env, env || {});

    // create a new Jsworkers object for each new operation
    // and return the new created object for operation chaining
    const that = new this.constructor(null, this.options, Jsworkers.Promise.CREATE_PENDING, "map");
    const preOp = this;

    this.promise
      .then(function (result) {
        // var prom = new Promise(function(resolve, reject){
        //   resolve([1,2,3]);
        // });
        // prom.then(function(result){
        //   result[0] = 2;
        // });
        // prom.then(function(result){
        //   console.log(result);
        // });
        //
        // output: (3) [2, 2, 3]
        // this is not a situation that we expect. Here, copy() is used to 
        // prevent then() from changing the original promise value.

        let data = copy(result);

        if (!data.length) {
          // data = [data];
          let jsworkers = preOp.spawn(cb, env, Jsworkers.Promise.CREATE_NONE);
          setPromise(jsworkers, that.promise, that.resolve, that.reject);
          that = null;
          return undefined;
        }

        let startedOps = 0;
        let doneOps = 0;

        function onFulfil(result) {
          data[result.index] = result.value;
          if (++doneOps === data.length) {
            that.resolve(data);
            if (result.worker) result.worker.terminate();
          } else if (startedOps < data.length) {
            // if any of the recursive call to _spawnMapWorker fails with an exception,
            // the return operation make sure the exception will be caught by the outermost
            // catch defined in the for loop below. Without the 'return', any exception (or reject)
            // from _spawnMapWorker() will produce a unhandled exception
            //
            // as an alternative, we can also define a catch here:
            // _spawnMapWorker(that, startedOps++, cb, env, result.worker).then(onFulfil).catch(function(error){
            //    that.reject(error);
            // })
            return _spawnMapWorker(that, data, startedOps++, cb, env, result.worker).then(onFulfil);
          } else if (result.worker) {
            result.worker.terminate();
          }
        }

        for (
          ;
          startedOps - doneOps < that.options.maxWorkers &&
          startedOps < data.length;
          ++startedOps
        ) {
          _spawnMapWorker(that, data, startedOps, cb, env)
            .then(onFulfil)
            .catch(function (error) {
              that.reject(error);
            });
        }
      })
      .catch(function () {
        // this.promise exceptions are supposed to have been handled before,
        // when this is 'that' at that moment. But, here, it's another independent
        // branch inheriting from this.promise, we still need a catch to prevent
        // internal unhandled exceptions from being produced.
      });

    return that;
  };

  function _spawnReduceWorker(that, data, cb, env, wrk) {
    return new Promise(function (resolve, reject) {
      if (!wrk) wrk = _spawnWorker(that, cb, env);

      if (wrk !== undefined) {
        wrk.onmessage = function (msg) {
          resolve({ worker: wrk, value: msg.data });
        };
        wrk.onerror = function (e) {
          wrk.terminate();
          reject(e);
        };
        wrk.postMessage(data);
      } else if (that.options.synchronous) {
        setImmediate(() => {
          resolve({ worker: null, value: cb(data) });
        });
      } else {
        throw new Error(
          "Workers do not exist and synchronous operation not allowed!"
        );
      }
    });
  }

  Jsworkers.prototype.reduce = function (cb, env) {
    env = extend(this.options.env, env || {});

    // create a new Jsworkers object for each new operation
    // and return the new created object for operation chaining
    const that = new this.constructor(null, this.options, Jsworkers.Promise.CREATE_PENDING, "reduce");

    this.promise
      .then(function (result) {
        let data = copy(result);

        if (!data.length) {
          that.resolve(data);
        } else if (data.length === 1) {
          that.resolve(data[0]);
        } else {
          let runningWorkers = 0;
          function onFulfil(result) {
            --runningWorkers;
            data[data.length] = result.value;
            if (data.length === 1 && runningWorkers === 0) {
              data = result.value;
              that.resolve(data);
              if (result.worker) result.worker.terminate();
            } else if (data.length > 1) {
              ++runningWorkers;
              return _spawnReduceWorker(that, data.splice(0, 2), cb, env, result.worker).then(onFulfil);
            } else if (result.worker) {
              result.worker.terminate();
            }
          }

          for (
            var i = 0;
            i < that.options.maxWorkers && i < Math.floor(data.length / 2);
            ++i
          ) {
            ++runningWorkers;
            _spawnReduceWorker(that, [data[i * 2], data[i * 2 + 1]], cb, env)
              .then(onFulfil)
              .catch(function (error) {
                that.reject(error);
              });
          }

          data.splice(0, i * 2);
        }
      })
      .catch(function () {
        // this.promise exceptions are supposed to have been handled 
        // in other branch, when this is 'that'. But, here, it's another 
        // independent branch inheriting from this.promise, we still need 
        // a catch to prevent internal unhandled exceptions from being produced.
      });
    return that;
  };

  // for jsworkers object related with then/catch, it only needs a promise,
  // and this promise will be resolved/rejected by the previouse promise nodes
  // on the chain (here, it's this.promise, and all nodes before this.promise)
  // so we don't need a that.resolve/that.reject for then/catch level jsworkers
  // object. So does to that.status, because the following jsworkers objects
  // (like ...then().map()) will define their own that and that.status
  Jsworkers.prototype.then = function (cb, errCb) {
    const that = new this.constructor(null, this.options, Jsworkers.Promise.CREATE_NONE, "then");
    that.promise = this.promise.then(cb, errCb);
    return that;
  };

  Jsworkers.prototype.catch = function (errCb) {
    const that = new this.constructor(null, this.options, Jsworkers.Promise.CREATE_NONE, "catch");
    that.promise = this.promise.catch(errCb);
    return that;
  };

  if (isCommonJS) {
    module.exports = Jsworkers;
  } else {
    self.Jsworkers = Jsworkers;
  }
})();
