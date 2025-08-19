const net = require("net");

console.log("Logs from your program will appear here!");
const store = {};

const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    const message = data.toString();

    // Break the RESP message into parts
    const parts = message.split("\r\n");
    // Example for ECHO pear: ["*2", "$4", "ECHO", "$4", "pear", ""]

    if (parts[2] && parts[2].toUpperCase() === "PING") {
      connection.write("+PONG\r\n");
    } else if (parts[2] && parts[2].toUpperCase() === "ECHO") {
      const echoMessage = parts[4]; // this is the string after ECHO
      connection.write(`$${echoMessage.length}\r\n${echoMessage}\r\n`);
    } else if (parts[2] && parts[2].toUpperCase() === "SET") {
      let expiry = null;
      if (parts[8] && parts[8].toUpperCase() === "PX") {
        const ttl = parseInt(parts[10], 10);
        if (ttl) {
          expiry = Date.now() + ttl;
        }
      }
      const key = parts[4];
      const value = parts[6];
      store[key] = { value, expiry };
      connection.write(`+OK\r\n`);
    } else if (parts[2] && parts[2].toUpperCase() === "GET") {
      const key = parts[4];
      if (store[key]) {
        if (entry.expiry && Date.now() > entry.expiry) {
          delete store[key];
          connection.write("$-1\r\n");
        } else {
          const value = entry.value;
          connection.write(`$${value.length}\r\n${value}\r\n`);
        }
      } else {
        connection.write(`$-1\r\n`);
      }
    }
  });
});

server.listen(6379, "127.0.0.1");
