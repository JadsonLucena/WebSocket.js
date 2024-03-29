# WebSocket
A complete and minimalist WebSocket under the protocol [RFC-6455](https://tools.ietf.org/html/rfc6455)

## What is
It is a socket type connection (real-time, bidirectional and persistent) where both parties (server and client) can sending data (Text, Blob or ArrayBuffer) at any time.

## Features
- [x] Supported websocket protocols: 8 and 13
- [x] Supported HTTP2 protocol
- [x] Supported ping and pong requests
- [x] Supported sending and receiving types: Text, Blob and ArrayBuffer
- [x] Supported sending and receiving encodings: utf8, ascii, base64, hex, binary, utf16le and ucs2
- [x] Access-Control-Allow-Origin
- [x] Limit of connections per ip
- [x] Maximum data size
- [x] Prevents DDOS ping and pong attack
- [x] Fixed ID by session time
- [x] Inheritance of socket methods
- Supported extensions:
    - [ ] permessage-deflate


## Interfaces
```typescript
// Constructor
WebSocket(
    server: HttpServer, // HTTP(1.x or 2) Server Object
    {
        allowOrigin = null, // Allowed domains
        encoding = 'utf8',
        limitByIP = 256, // IP access limit. if value less than 1, there will be no limit
        maxPayload = 131072 * 20, // Maximum size in bytes that a message can be. if value less than 1, there will be no limit
        pingDelay = 3 * 60 * 1000, // Delay in ms between sending ping's. if value less than 1, ping's will not be sent
        pongTimeout = 5 * 1000, // Maximum pong waiting time in ms. if value less than 1, there will be no limit
        sessionExpires = 12 * 60 * 60 * 1000, // Maximum time in ms that an ID will be associated with the same client. If the value is less than 1, every time the client reconnects, a new ID will be generated
    }: {
        allowOrigin?: string | string[] | null,
        encoding?: 'utf8' | 'ascii' | 'base64' | 'hex' | 'binary' | 'utf16le' | 'ucs2',
        limitByIP?: number,
        maxPayload?: number,
        pingDelay?: number,
        pongTimeout?: number,
        sessionExpires?: number
    } = {}
)
```

```typescript
// Getters
allowOrigin(): string | string[] | null

clients(): string[] // List of connected user ID's

encoding(): 'utf8' | 'ascii' | 'base64' | 'hex' | 'binary' | 'utf16le' | 'ucs2'

limitByIP(): number

maxPayload(): number

pingDelay(): number

pongTimeout(): number

sessionExpires(): number
```

```typescript
// Setters
allowOrigin(arg?: (string | string[] | null) = null): void

encoding(arg?: ('utf8' | 'ascii' | 'base64' | 'hex' | 'binary' | 'utf16le' | 'ucs2') = 'utf8'): void

limitByIP(arg?: number = 256): void

maxPayload(arg?: number = 131072 * 20): void

pingDelay(arg?: number = 3 * 60 * 1000): void

pongTimeout(arg?: number = 5 * 1000): void

sessionExpires(arg?: number = 12 * 60 * 60 * 1000): void
```

```typescript
// Methods

/* Socket Methods Begin (https://nodejs.org/docs/latest/api/net.html#net_class_net_socket) */
    bytesRead(clientId: string): number

    bytesWritten(clientId: string): number

    isPaused(clientId: string): boolean

    pause(clientId: string): boolean

    readyState(clientId: string): 'opening' | 'open' | 'readOnly' | 'writeOnly'

    resume(clientId: string): boolean

    setEncoding(clientId: string, encoding: ('utf8' | 'ascii' | 'base64' | 'hex' | 'binary' | 'utf16le' | 'ucs2') = 'utf8'): boolean

    setKeepAlive(clientId: string, enable: boolean = false, initialDelay: number = 0): boolean

    setNoDelay(clientId: string, noDelay: boolean = true): boolean
/* Socket Methods End */

url(clientId: string): URL // https://developer.mozilla.org/en-US/docs/Web/API/URL

close(clientId: string): boolean

ping(clientId: string, pongTimeout?: number): boolean

send(
    clientId: string,
    data: string | Buffer, // Message content (if string, opcode 0x1, if not, 0x2)
    encoding: ('utf8' | 'ascii' | 'base64' | 'hex' | 'binary' | 'utf16le' | 'ucs2') = 'utf8'
): boolean
```

```typescript
// Listeners
on(name: 'close', callback: (clientId: string, event: {code: number, message:  string}) => void): void

on(name: 'error', callback: (clientId: string, event: Error) => void): void

on(name: 'open', callback: (clientId: string) => void): void

on(name: string = 'message', callback: (clientId: string, data: string | Buffer) => void): void // If the pathname is instantiated in the WebSocket constructor on the front-end, it must be referenced in place of the message name
```


## QuickStart
```javascript
// Back-end
const HttpServer = require('http').createServer((req, res) => res.end()).listen(80); // Although this is a minimalist HTTP server, HTTPs or HTTP2 are more suitable

const WebSocket = require('@jadsonlucena/websocket'); // npm i @jadsonlucena/websocket

var webSocket = new WebSocket(HttpServer);

webSocket.on('open', clientId => {

    try {

        console.log('Connect', clientId, webSocket.url(clientId));

    } catch (err) {

        console.error(err);

    }

});

webSocket.on('close', (clientId, e) => console.log('Close', clientId, e));

webSocket.on('error', (clientId, e) => console.log('Error', clientId, e));

// webSocket.on('message', (clientId, data) => {
webSocket.on('/chat', (clientId, data) => {

    console.log('Data', clientId, data);

    try {

        // Single Client
        webSocket.send(clientId, data);

        // Broadcast
        webSocket.clients.forEach(id => webSocket.send(id, data));

    } catch (err) {

        console.error(err);

    }

});
```

```javascript
// Front-end

//https://datatracker.ietf.org/doc/html/rfc6455#section-3
const path = '/chat'; // https://datatracker.ietf.org/doc/html/rfc3986#section-3.3
const query = '?token=123'; // https://datatracker.ietf.org/doc/html/rfc3986#section-3.4

const webSocket = new WebSocket((location.protocol == 'https:' ? 'wss://' : 'ws://') + location.host + path + query);

// webSocket.binaryType = 'blob';
// webSocket.binaryType = 'arraybuffer';

webSocket.onclose = e => console.log('Close', e);

webSocket.onerror = e => console.log('Error', e);

webSocket.onopen = () => {

    webSocket.send('Hello World');

    webSocket.onmessage = (e) => console.log('Message', e);

};
```

> By default, if the path in the frontend constructor is empty or "/", the listener in the backend will be "message". If you enter a path in the front-end, it must be specified in the back-end listener.

### References

> [The WebSocket Protocol 13](https://tools.ietf.org/html/rfc6455)\
> [The WebSocket Protocol 8](https://tools.ietf.org/html/draft-ietf-hybi-thewebsocketprotocol-08)\
> [Extensions](https://www.iana.org/assignments/websocket/websocket.xml#extension-name)\
> [Protocols](https://www.iana.org/assignments/websocket/websocket.xml#subprotocol-name)\
> [Writing WebSocket servers](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers)

> Book: The Definitive Guide to HTML5 WebSocket
