const Server = require('./server');

const server = new Server({ port: 19132 });

server.events.subscribe('open', ev => {
  const { world } = ev;
  console.log('connection opened: '+ world.id);
});

server.events.subscribe('close', ev => {
  const { world } = ev;
  console.log('connection closed: '+ world.id);
});

server.events.subscribe('PlayerJoin', ev => {
  const { join } = ev;
  console.log(`Joined: ${join}`);
});

server.events.subscribe('PlayerLeave', ev => {
  const { leave } = ev;
  console.log(`Left: ${leave}`);
});

server.events.subscribe('PlayerMessage', ev => {
  const { sender, message, world } = ev;
  if (sender == '外部') return;
  console.log(`Message Reveived: <${sender}> ${message}`)
  world.sendMessage(message);
});