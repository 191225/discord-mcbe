const { EventEmitter } = require('events');
const util = require('./util');
const WebSocket = require('ws')

const debug = true;

class World extends EventEmitter {
  constructor(server, ws) {
    super();
    this.ws = ws;
    this.server = server;
    this.responses = new Map();
    this.countInterval = null;
    this.lastPlayers = [];
    this.subscribedEvents = new Set();
    
    this.on('packet', packet => {
      this.server.events.emit('packet', { world: this, packet });
      this.server.events.emit(packet.header.eventName, { ...packet.body, world: this });
    
      if (packet.header.messagePurpose === 'commandResponse') {
        if (packet.body.recipient === undefined) {
          this.responses.set(packet.header.requestId, packet.body);
        }
      }
      
      if (packet.header.messagePurpose === 'error') {
        if (packet.body.recipient === undefined) {
          this.responses.set(packet.header.requestId, packet.body);
        }
      }
    });
  }
  
  get id() {
    return this.ws.id;
  }
  
  subscribe(eventName) {
    this.subscribedEvents.add(eventName);
    if (eventName == 'PlayerJoin' || eventName == 'PlayerLeave') {
      if (!this.countInterval) {
        this.countInterval = setInterval(this.playerCounter.bind(this), 1000);
      }
    }
  }
  
  async runCommand(command) {
    let packet = util.commandBuilder(command);
    this.ws.send(JSON.stringify(packet));
    if (command.startsWith('tellraw')) return {}
    let res = await this.getResponse(packet.header.requestId).catch(e => {
      if (debug) console.error(`runCommand Error: ${e.message}`);
      return {error: true, statusMessage: e.message}
    });
    return res
  }
  
  getResponse(id) {
    return new Promise((res, rej) => {
      let count = 0;
      const interval = setInterval(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          clearInterval(interval);
          rej(new Error('client is offline'));
          
        } else if (count > 200) { // 50ms*200=10000ms=10s
          clearInterval(interval);
          rej(new Error('response timeout'));
          
        } else if (this.responses.has(id)) {
          clearInterval(interval);
          res(this.responses.get(id));
          this.responses.delete(id);
        }
        count++
      }, 50);
    });
  }
  
  async sendMessage(message, target = '@a', key, ...args) {
    if (!target.match(/@s|@p|@a|@r|@e/)) target = `"${target}"`;
    let rawtext = {
      rawtext: [{ text: String(message || '') }]
    }
    if (key) rawtext.rawtext.push({
        translate: key,
        with: args
    });
    return await this.runCommand(`tellraw ${target} ${JSON.stringify(rawtext)}`);
  }
  
  async getPlayers() {
    let data = await this.runCommand('list');
    let status = (data.statusCode == 0 && !data.error);
    return {
      current: status ? data.currentPlayerCount : 0,
      max: status ? data.maxPlayerCount : 0,
      players: status ? data.players.split(', ') : []
    }
  }
  
  async playerCounter() {
    const { players, current, max } = await this.getPlayers();
    const join = players.filter(i => this.lastPlayers.indexOf(i) === -1);
    const leave = this.lastPlayers.filter(i => players.indexOf(i) === -1);
    if (join.length > 0) this.server.events.emit('PlayerJoin', { world: this, join, players, current, max });
    if (leave.length > 0) this.server.events.emit('PlayerLeave', { world: this, leave, players, current, max });
    this.lastPlayers = players;
  }
  
  async getTags(player) {
    const res = await this.runCommand(`tag "${player}" list`);
    if (res.error) return res;
    try {
      return res.statusMessage.match(/§a.*?§r/g).map(str => str.replace(/§a|§r/g, ''));
    } catch {
      return [];
    }
  }
  
  async hasTag(player, tag) {
    const tags = await this.getTags(player);
    if (tags.error) return tags;
    return tags.includes(tag);
  }
  
  // by Kinji | https://twitter.com/commanderkinji
  async getScores(player) {
    const res = await this.runCommand(`scoreboard players list "${player}"`);
    if (res.error) return res;
    try {
      return Object.fromEntries(
        [...res.statusMessage.matchAll(/: (\d*) \((.*?)\)/g)]
        .map(data => data.slice(1).reverse())
      ).map(n => Number(n));
    } catch {
      return {};
    }
  }
  
  async getScore(player, objective) {
    const res = await this.getScores(player);
    if (res.error) return res;
    return res[objective];
  }
}

module.exports = World;
