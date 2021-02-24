const EventEmitter = require('events');
const crypto = require('crypto');

class WebSocket extends EventEmitter {

    #allowOrigin;
    #clients;
    #encoding;
    #limitByIP;
    #maxPayload;
    #pongTimeout;

    constructor(server, {
        allowOrigin = null, // The value should be similar to what Access-Control-Allow-Origin would receive
        pingDelay = 1000 * 60 * 3,
        encoding = 'utf8',
        limitByIP = 256, // IP connection limit (Must be greater than zero)
        maxPayload = 131072 * 20, // (Max chrome 131072 bytes by frame)
        pongTimeout = 5000
    } = {}) {

        super({captureRejections: true});

        this.setMaxListeners(0);

        this.#allowOrigin = allowOrigin;
        this.#clients = {};
        this.#encoding = encoding;
        this.#limitByIP = limitByIP;
        this.#maxPayload = maxPayload;
        this.#pongTimeout = pongTimeout;

        server.on('upgrade', async (request, socket, head) => {

            request.headers['origin'] = (request.headers['origin'] || request.headers['sec-webSocket-origin']).trim();

            if (request.headers['upgrade'].trim() != 'websocket') {

                socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
                socket.destroy();

            } else if (!/^(8|13)$/.test(+request.headers['sec-websocket-version'].trim())) {

                socket.end('HTTP/1.1 426 Upgrade Required\r\nSec-WebSocket-Version: 13, 8\r\n\r\n');
                socket.destroy();

            } if (!request.headers['origin'] || (!request.headers['origin'].includes(request.headers['host'].trim()) && (!this.#allowOrigin || (this.#allowOrigin != '*' && !this.#allowOrigin.includes(request.headers['origin']))))) {

                socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
                socket.destroy();

            } else if (this.#limitByIP >= 1 && Object.keys(this.#clients).filter(clientId => this.#clients[clientId].socket.remoteAddress == socket.remoteAddress).length + 1 > this.#limitByIP) {

                socket.end('HTTP/1.1 429 Too Many Requests\r\n\r\n');
                socket.destroy();

            } else {

                socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: WebSocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${crypto.createHash('sha1').update(request.headers['sec-websocket-key'].trim() +'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')}\r\n\r\n`);
                socket.setTimeout(0);


                /* Begin generate unique ID */
                let clientId;
                while ((clientId = crypto.randomBytes(5).toString("hex")) in this.#clients);
                /* End generate unique ID */


                this.#clients[clientId] = {
                    socket: socket,
                    ping: {
                        timer: null,
                        content: crypto.randomBytes(5).toString('hex')
                    },
                    pong: {
                        timer: null,
                        timerSecurity: null
                    }
                };

            }

        });

    }

};