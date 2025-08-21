const net = require("net");

console.log("Logs from your program will appear here!");

// In-memory store
const store = {};
const waitingClients = {}; // { key: [connection1, connection2, ...] }
const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    const message = data.toString();
    const parts = message.split("\r\n").filter((p) => p !== "");

    // Command is always at parts[2] after splitting RESP
    const command = parts[2] ? parts[2].toUpperCase() : null;

    switch (command) {
      case "PING":
        connection.write("+PONG\r\n");
        break;

      case "ECHO":
        connection.write(`$${parts[4].length}\r\n${parts[4]}\r\n`);
        break;

      case "SET": {
        const key = parts[4];
        const value = parts[6];
        let expiry = null;

        if (parts[8] && parts[8].toUpperCase() === "PX") {
          const ttl = parseInt(parts[10], 10);
          if (!isNaN(ttl)) expiry = Date.now() + ttl;
        }

        store[key] = { value, expiry };
        connection.write("+OK\r\n");
        break;
      }

      case "GET": {
        const key = parts[4];
        const entry = store[key];

        if (!entry) {
          connection.write("$-1\r\n");
        } else if (entry.expiry && Date.now() > entry.expiry) {
          delete store[key];
          connection.write("$-1\r\n");
        } else {
          const value = entry.value;
          connection.write(`$${value.length}\r\n${value}\r\n`);
        }
        break;
      }

      case "RPUSH":
      case "LPUSH": {
        const key = parts[4];

        if (!store[key]) store[key] = [];

        // Determine values: everything after the key
        const values = [];
        for (let i = 6; i < parts.length; i++) {
          const val = parts[i];
          if (val && !val.startsWith("$") && !val.startsWith("*")) {
            values.push(val);
          }
        }

        if (command === "RPUSH") {
          store[key].push(...values);
        } else {
          for (let i = 0; i < values.length; i++) {
            store[key].unshift(values[i]);
          }
        }
        if (waitingClients[key] && waitingClients[key].length > 0) {
          const client = waitingClients[key].shift();
          const val = store[key].shift(); // pop value for that client
          client.write(
            `*2\r\n$${key.length}\r\n${key}\r\n$${val.length}\r\n${val}\r\n`
          );
        }

        //connection.write(`:${store[key].length}\r\n`);
        break;
      }

      case "LPOP": {
        const key = parts[4];
        if (!store[key] || store[key].length === 0) {
          connection.write("$-1\r\n");
        } else {
          if (parts.length > 5) {
            const count = parseInt(parts[6]); // number of elements to pop
            if (isNaN(count) || count <= 0) {
              connection.write(
                "-ERR value is not an integer or out of range\r\n"
              );
              break;
            }

            const popped = store[key].splice(0, count); // remove multiple
            if (popped.length === 0) {
              connection.write("$-1\r\n");
            } else {
              connection.write(`*${popped.length}\r\n`);
              popped.forEach((el) => {
                connection.write(`$${el.length}\r\n${el}\r\n`);
              });
            }
          } else {
            const value = store[key].shift();
            connection.write(`$${value.length}\r\n${value}\r\n`);
          }
        }
        break;
      }
      case "LRANGE": {
        const key = parts[4];
        let start = parseInt(parts[6], 10);
        let stop = parseInt(parts[8], 10);

        const list = store[key] || [];

        // Normalize negative indices
        if (start < 0) start = list.length + start;
        if (stop < 0) stop = list.length + stop;

        // Clamp indices
        start = Math.max(0, start);
        stop = Math.min(list.length - 1, stop);

        if (start > stop || list.length === 0) {
          connection.write("*0\r\n");
        } else {
          const values = list.slice(start, stop + 1);
          connection.write(`*${values.length}\r\n`);
          values.forEach((value) => {
            connection.write(`$${value.length}\r\n${value}\r\n`);
          });
        }
        break;
      }
      case "LLEN": {
        const key = parts[4];
        if (!store[key]) {
          connection.write(":0\r\n"); // no list found
        } else if (Array.isArray(store[key])) {
          connection.write(`:${store[key].length}\r\n`); // length of the list
        } else {
          connection.write("-ERR Wrong type, key is not a list\r\n");
        }
        break;
      }
      case "BLPOP": {
        const key = parts[4];
        const timeout = parseInt(parts[6]);
        if (store[key] && store[key].length > 0) {
          // Pop immediately
          const val = store[key].shift();
          connection.write(
            `*2\r\n$${key.length}\r\n${key}\r\n$${val.length}\r\n${val}\r\n`
          );
        } else {
          // Block (timeout ignored for now, assume 0 = infinite)
          if (!waitingClients[key]) waitingClients[key] = [];
          waitingClients[key].push(connection);
        }
        break;
      }

      default:
        connection.write("-ERR unknown command\r\n");
        break;
    }
  });
});

server.listen(6379, "127.0.0.1", () => {
  console.log("Redis clone running on port 6379");
});
