var reraf = (function (exports) {
  'use strict';

  var compat = typeof cancelAnimationFrame === 'function';
  var cAF = compat ? cancelAnimationFrame : clearTimeout;
  var rAF = compat ? requestAnimationFrame : setTimeout;
  function reraf(limit) {
    var force, timer, callback, self, args;
    reset();
    return function reschedule(_callback, _self, _args) {
      callback = _callback;
      self = _self;
      args = _args;
      if (!timer)
        timer = rAF(invoke);
      if (--force < 0)
        stop(true);
      return stop;
    };
    function invoke() {
      reset();
      callback.apply(self, args || []);
    }
    function reset() {
      force = limit || Infinity;
      timer = compat ? 0 : null;
    }
    function stop(flush) {
      var didStop = !!timer;
      if (didStop) {
        cAF(timer);
        if (flush)
          invoke();
      }
      return didStop;
    }
  }

  

  return reraf;

}({}));
