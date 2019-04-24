import ws from 'k6/ws';
import { check } from 'k6';

// Place GraphQL Server App WS URL here, e.g. ws://myapp.com/graphql
const wsUrl = 'ws://localhost:4000/graphql';
const wsParams = { headers: { 'sec-websocket-protocol': 'graphql-ws' } };

export default function() {
  const response = ws.connect(wsUrl, wsParams, socket => {
    socket.on('open', () => {
      socket.send(
        JSON.stringify({
          id: '1',
          type: 'start',
          payload: { query: 'subscription {taskCreated {id}}' }
        })
      );
    });

    socket.on('message', data => {
      console.log(`message: ${data}`);
    });

    socket.on('close', () => {
      console.log('disconnected');
    });

    socket.on('error', e => {
      if (e.error() !== 'websocket: close sent') {
        console.log('An unexpected error occured: ', e.error());
      }
    });

    socket.setTimeout(() => {
      console.log('20 seconds passed, closing the socket');
      socket.close();
    }, 20000);
  });

  check(response, { 'status is 101': r => r && r.status === 101 });
}
