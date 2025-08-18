const net = require("net");

console.log("Logs from your program will appear here!");

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
    }
  });
});

server.listen(6379, "127.0.0.1");
