const { EventEmitter } = require('events');

class ServerEvent extends EventEmitter {
  constructor(server) {
    super();
    this.server = server;
  }
  
  subscribe(eventName, fn) {
    this.server.subscribedEvents.add(eventName);
    this.on(eventName, fn);
  }
}

module.exports = ServerEvent;