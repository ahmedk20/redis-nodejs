const net = require("net");

console.log("Logs from your program will appear here!");

const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    const message = data.toString().trim();

    if (message === "PING") {
      connection.write("+PONG\r\n");
    }
  });
});

server.listen(6379, "127.0.0.1");
