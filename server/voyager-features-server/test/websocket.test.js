import ws from "k6/ws";
import { check } from "k6";

const wsUrl = "ws://localhost:4000/graphql";
const wsParams = { "headers": {"sec-websocket-protocol":"graphql-ws"} };

export default function () {
    const response = ws.connect(wsUrl, wsParams, function (socket) {
        socket.on('open', function open() {
            socket.send(JSON.stringify(
                {
                    "id":"1",
                    "type":"start",
                    "payload":{
                        "query":"subscription {taskCreated {id}}"}})
                );
        });

        socket.on('message', function incoming(data) {
            console.log(`message: ${data}`);
        });

        socket.on('close', function close() {
            console.log('disconnected');
        });

        socket.on('error', function (e) {
            if (e.error() != "websocket: close sent") {
                console.log('An unexpected error occured: ', e.error());
            }
        });

        socket.setTimeout(function () {
            console.log('20 seconds passed, closing the socket');
            socket.close();
        }, 20000);
    });

    check(response, { "status is 101": (r) => r && r.status === 101 });
};