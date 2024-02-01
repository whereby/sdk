/*! (c) Andrea Giammarchi - ISC */
var self = {};
try { self.Event = new Event('.').constructor; }
catch (Event) {
  try {
    self.Event = new CustomEvent('.').constructor;
  } catch (Event) {
    self.Event = function Event(type, init) {
      if (!init)
        init = {};
      var e = document.createEvent('Event');
      var bubbles = !!init.bubbles;
      var cancelable = !!init.cancelable;
      e.initEvent(type, bubbles, cancelable);
      try {
        e.bubbles = bubbles;
        e.cancelable = cancelable;
      } catch (e) {}
      return e;
    };
  }
}
export default self.Event;
