const isNode = typeof module !== 'undefined' && module.exports;
const { isMainThread, parentPort, workerData } = require('worker_threads');

if (isNode) {
  parentPort.once('message', code => {
    try{
      eval(code.data);
    } catch (error) {
      console.log(error);
    }
  });
}