function Worker(url, fork, type) {
  const that = this;
  this.type = type;
  if(this.type === Worker.Type.PROCESS)
    this.worker = fork(url);
  else if(this.type === Worker.Type.WORKERTHREAD || this.type === Worker.Type.WEBWORKER) 
    this.worker = new fork(url);

  if (type === Worker.Type.PROCESS) {
    this.worker.on("message", (msg) => {
      if (that.onmessage) {
        that.onmessage({ data: JSON.parse(msg) });
      }
    });
    this.worker.on("error", (err) => {
      if (that.onerror) {
        that.onerror(err);
      }
    });
  } else if (type === Worker.Type.WORKERTHREAD) {
    this.worker.on("message", (msg) => {
      if (that.onmessage) {
        that.onmessage({ data: msg });
      }
    });
    this.worker.on("error", (err) => {
      if (that.onerror) {
        that.onerror(err);
      }
    });
  } else if (type === Worker.Type.WEBWORKER) {
    this.worker.onmessage((msg) => {
      if (that.onmessage) {
        that.onmessage({ data: msg });
      }
    });
    this.worker.onerror("error", (err) => {
      if (that.onerror) {
        that.onerror(err);
      }
    });
  }
}

Worker.Type = Object.freeze({
  PROCESS: 1, // create node.js process
  WORKERTHREAD: 2, // create node.js workerthread
  WEBWORKER: 3, // create webworker
});

Worker.prototype.onmessage = null;
Worker.prototype.onerror = null;

Worker.prototype.postMessage = function (obj) {
  if(this.type === Worker.Type.PROCESS)
    this.worker.send(JSON.stringify({ data: obj }));
  else if(this.type === Worker.Type.WORKERTHREAD || this.type === Worker.Type.WEBWORKER) 
    this.worker.postMessage({ data: obj });
};

Worker.prototype.terminate = function () {
  if(this.type === Worker.Type.PROCESS)
    this.worker.kill();
  else if(this.type === Worker.Type.WORKERTHREAD || this.type === Worker.Type.WEBWORKER) 
    this.worker.terminate();
};

module.exports = Worker;