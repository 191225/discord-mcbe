const WebSocket = require('ws');
const util = require('./util');
const { v4: uuidv4 } = require('uuid');
const World = require('./world');
const ServerEvent = require('./serverEvent')
const ip = require('ip')
let number = 0;

class Server extends WebSocket.Server {
  constructor(config) {
    super(config);
    this.events = new ServerEvent(this);
    this.worlds = new Map();
    this.subscribedEvents = new Set();
    
    console.log(`Listening: ${ip.address()}:${config.port || config}`);
    
    this.on('connection', async ws => {
      ws.id = uuidv4();
      const world = new World(this, ws);
      world.number = number++;
      this.addWorld(world);
      
      ws.on('message', packet => {
        const res = JSON.parse(packet);
        this.getWorld(ws.id).emit('packet', res);
      });
      
      ws.on('close', () => {
        const world = server.getWorld(ws.id);
        clearInterval(world.countInterval);
        this.events.emit('close', { world });
        this.removeWorld(world);
      });
    });
  }
  
  addWorld(world) {
    this.worlds.set(world.id, world);
    this.events.emit('open', { world });
    
    world.ws.send(JSON.stringify(util.eventBuilder('commandResponse')));

    this.subscribedEvents.forEach(eventName => {
      if (eventName == 'PlayerJoin' || eventName == 'PlayerLeave') { // start interval
        world.subscribe(eventName);
      } else {
        world.ws.send(JSON.stringify(util.eventBuilder(eventName))); // send packet
      }
    });
  }
  
  removeWorld(world) {
    this.worlds.delete(world.id);
  }
  
  
  getWorld(id) {
    return this.worlds.get(id);
  }
  
  getWorlds() {
    return new Set(this.worlds.values());
  }
}

module.exports = Server;