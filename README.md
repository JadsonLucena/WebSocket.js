# WebSocket
A complete and minimalist WebSocket under the protocol [RFC-6455](https://tools.ietf.org/html/rfc6455) for Node.js server ≥ v14.x

## What is
It is a socket type connection (real-time, bidirectional and persistent) where both parties (server and client) can sending data (Text, Blob or ArrayBuffer) at any time.


## Interfaces
```typescript
// Constructor
WebSocket(
    server: Server, // HTTP(s) Server Object
    {
        allowOrigin = null, // Allowed domains
        encoding = 'utf8',
        limitByIP = 256, // IP access limit
        maxPayload = 2621440, // Maximum size in bytes that a message can be
        pingDelay = 180000, // Delay in ms between sending ping's
        pongTimeout = 5000 // Maximum pong waiting time in ms
    }: {
        allowOrigin?: string | string[] | null,
        encoding?: 'utf8' | 'ascii' | 'base64' | 'hex' | 'binary' | 'utf16le' | 'ucs2',
        limitByIP?: number,
        maxPayload?: number,
        pingDelay?: number,
        pongTimeout?: number
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

pongTimeout(): number
```

```typescript
// Setters
allowOrigin(arg: (string | string[] | null) = null): void

encoding(arg: ('utf8' | 'ascii' | 'base64' | 'hex' | 'binary' | 'utf16le' | 'ucs2') = 'utf8'): void

limitByIP(arg: number = 256): void

maxPayload(arg: number = 2621440): void

pongTimeout(arg: number = 5000): void
```

```typescript
// Methods

/* Socket Methods Begin (https://nodejs.org/docs/latest/api/net.html#net_class_net_socket) */
    bytesRead(clientId: string): boolean | null

    bytesWritten(clientId: string): boolean | null

    isPaused(clientId: string): boolean | null

    pause(clientId: string): boolean | null

    readyState(clientId: string): boolean | null

    resume(clientId: string): boolean | null

    setEncoding(clientId: string, encoding: ('utf8' | 'ascii' | 'base64' | 'hex' | 'binary' | 'utf16le' | 'ucs2') = 'utf8'): boolean | null

    setKeepAlive(clientId: string, enable: boolean = false, initialDelay: number = 0): boolean | null

    setNoDelay(clientId: string, noDelay: boolean = true): boolean | null
/* Socket Methods End */

close(clientId: string): boolean | null

ping(clientId: string, pongTimeout?: number): boolean | null

send(
    clientId: string,
    data: string | Buffer, // Message content (if string, opcode 0x1, if not, 0x2)
    encoding: ('utf8' | 'ascii' | 'base64' | 'hex' | 'binary' | 'utf16le' | 'ucs2') = 'utf8'
): boolean | null
```

```typescript
// Listeners
on(name: 'close', callback: (clientId: string, event: {code: number, message:  string}) => void): void

on(name: 'error', callback: (clientId: string, event: Error) => void): void

on(name: 'open', callback: (clientId: string) => void): void

on(name: string = 'message', callback: (clientId: string, data: string | Buffer) => void): void // If the pathname is instantiated in the WebSocket constructor on the front-end, it must be referenced in place of the message name
```