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


        if (pingDelay >= 0) {

            setInterval(() => {

                for (let clientId in this.#clients) {

                    this.ping(clientId);

                }

            }, pingDelay);

        }


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


                // let customEvent = request.path != '/' ? request.path : 'message';
                let customEvent = request.url != '/' ? request.url : 'message';


                let next = Buffer.alloc(0);
                let frames = [];
                socket.on('data', (data) => {

                    if (clientId in this.#clients) {

                        data = [this.#decode(Buffer.concat([next, data]))];

                        let index = 0;

                        // Ensures that until the last frame is processed, if it comes concatenated
                        while (true) {

                            if (data[index] && !data[index].waiting && data[index].next.length) {

                                data.push(this.#decode(data[index].next));
                                
                                index++;

                                if (data[index] && !data[index].waiting && (data[index].FIN && data[index].payloadData.length == data[index].payloadLength)) {

                                    data[index - 1].next = Buffer.alloc(0);

                                } else {

                                    break;

                                }

                            } else {

                                break;

                            }

                        }

                        // Ensures that it will only follow when the entire frame arrives
                        if (data[index] && data[index].waiting) {

                            next = data[index].next;

                        } else {

                            for (let decoded of data) {

                                if (decoded == null) {

                                    this.emit('close', clientId, {code: 1003, message:  'Unacceptable Data Type'});

                                    this.close(clientId);

                                } else if ((decoded.payloadLength + frames.map(frameDecoded => frameDecoded.payloadLength).reduce((acc, cur) => acc + cur, 0)) > this.#maxPayload) {

                                    this.emit('close', clientId, {code: 1009, message:  'Message Too Big'});

                                    this.close(clientId);

                                } else if (decoded.opcode == 0) { // Denotes a continuation frame

                                    if (decoded.FIN && decoded.payloadData.length == decoded.payloadLength) {

                                        if (decoded.opcode == 1) {

                                            this.emit(customEvent, clientId, frames.splice(0, frames.push(decoded)).map(frameDecoded => frameDecoded.payloadData).reduce((acc, cur) => Buffer.concat([acc, cur])).toString(this.#encoding));

                                        } else {

                                            this.emit(customEvent, clientId, frames.splice(0, frames.push(decoded)).map(frameDecoded => frameDecoded.payloadData).reduce((acc, cur) => Buffer.concat([acc, cur])));

                                        }

                                    }

                                    next = decoded.next;

                                } else if (decoded.opcode == 1) { // Denotes a text frame

                                    if (decoded.FIN && decoded.payloadData.length == decoded.payloadLength) {

                                        this.emit(customEvent, clientId, decoded.payloadData.toString(this.#encoding));

                                    } else {

                                        frames.push(decoded);

                                    }

                                    next = decoded.next;

                                } else if (decoded.opcode == 2) { // Denotes a binary frame (blob, arraybuffer)

                                    if (decoded.FIN && decoded.payloadData.length == decoded.payloadLength) {

                                        this.emit(customEvent, clientId, decoded.payloadData);

                                    } else {

                                        frames.push(decoded);

                                    }

                                    next = decoded.next;

                                } else if (decoded.opcode >= 3 && decoded.opcode <= 7) { // Are reserved for further non-control frames

                                    this.emit('close', clientId, {code: 1003, message:  'Unacceptable Data Type'});

                                    this.close(clientId);

                                } else if (decoded.opcode == 8) { // Denotes a connection close

                                    this.emit('close', clientId, {code: 1000, message:  'Close Normal'});

                                    this.close(clientId);

                                } else if (decoded.opcode == 9) { // Denotes a ping (the max payload length is 125)

                                    if (decoded.payloadLength <= 125) {

                                        clearTimeout(this.#clients[clientId].pong.timer);
                                        this.#clients[clientId].pong.timer = setTimeout(() => { // Avoid sending more than one pong simultaneously

                                            socket.write(this.#encode(decoded.payloadData, 0xA)); // Send pong

                                            clearTimeout(this.#clients[clientId].pong.timerSecurity);
                                            this.#clients[clientId].pong.timerSecurity = null;

                                        }, 3000);

                                        // Prevents DDOS attack
                                        if (this.#clients[clientId].pong.timerSecurity == null) {

                                            this.#clients[clientId].pong.timerSecurity = setTimeout(() => {

                                                this.emit('close', clientId, {code: 1006, message:  'Closed Abnormally'});

                                                this.close(clientId);

                                            }, 3000 * 3);

                                        }

                                    } else {

                                        this.emit('close', clientId, {code: 1003, message:  'Unacceptable Data Type'});

                                        this.close(clientId);

                                    }

                                } else if (decoded.opcode == 10) { // Denotes a pong (the max payload length is 125)

                                    if (decoded.payloadLength <= 125) {

                                        if (decoded.payloadData.toString('utf8') == this.#clients[clientId].ping.content) {

                                            this.#clients[clientId].ping.content = crypto.randomBytes(5).toString('hex');
                                            clearTimeout(this.#clients[clientId].ping.timer);

                                        }

                                    } else {

                                        this.emit('close', clientId, {code: 1003, message:  'Unacceptable Data Type'});

                                        this.close(clientId);

                                    }

                                } else { // Are reserved for further control frames

                                    this.emit('close', clientId, {code: 1003, message:  'Unacceptable Data Type'});

                                    this.close(clientId);

                                }

                            }

                        }

                    }

                });


                socket.on('close', e => {

                    if (this.close(clientId)) {

                        this.emit('close', clientId, e ? {code: 1006, message:  'Closed Abnormally'} : {code: 1000, message:  'Close Normal'});

                    }

                });

                socket.on('error', e => {

                    if (this.close(clientId)) {

                        this.emit('error', clientId, e);

                    }

                });


                this.emit('open', clientId);

            }

        });

    }


    get allowOrigin() { return this.#allowOrigin }

    get clients() { return Object.keys(this.#clients) }

    get encoding() { return this.#encoding }

    get limitByIP() { return this.#limitByIP }

    get maxPayload() { return this.#maxPayload }

    get pongTimeout() { return this.#pongTimeout }


    set allowOrigin(allowOrigin = null) { this.#allowOrigin = allowOrigin }

    set encoding(encoding = 'utf8') { this.#encoding = encoding }

    set limitByIP(limitByIP = 256) { this.#limitByIP = limitByIP }

    set maxPayload(maxPayload = 131072 * 20) { this.#maxPayload = maxPayload }

    set pongTimeout(pongTimeout = 5000) { this.#pongTimeout = pongTimeout }


    #decode(payload) { // Input buffer binary

        let FIN = (payload[0] & 0x80) == 0x80; // 1 bit
        let RSV1 = payload[0] & 0x40; // 1 bit
        let RSV2 = payload[0] & 0x20; // 1 bit
        let RSV3 = payload[0] & 0x10; // 1 bit
        let opcode = payload[0] & 0x0F; // Low four bits
        let MASK = (payload[1] & 0x80) == 0x80; // 1 bit

        let payloadLength = payload[1] & 0x7F; // Low 7 bits, 7+16 bits, or 7+64 bits
        let maskingKey = ''; // 0 or 4 bytes
        let payloadData = Buffer.alloc(0); // (x+y) bytes
        let extensionData = ''; // x bytes
        let applicationData = ''; // y bytes


        if (
            // RSV1 || RSV2 || RSV3 ||
            // ((opcode >= 3 && opcode <= 7) || opcode > 10) ||
        !MASK) {

            return null;

        } else {

            let index = 2;

            if (payloadLength == 126) {

                // if (payload.length < 2) {
                //     return null;
                // }

                payloadLength = payload.readUInt16BE(2);
                index += 2;

            } else if (payloadLength == 127) {

                // if (payload.length < 8) {
                //     return null;
                // }

                if (payload.readUInt32BE(2) != 0) { // Discard high 4 bits because this server cannot handle huge lengths

                    return null;

                }

                payloadLength = payload.readUInt32BE(6);
                index += 8;

            }

            let waiting = false;
            let next = null;
            if (payload.length >= index + 4 + payloadLength) {

                maskingKey = payload.slice(index, index + 4);

                index += 4;

                payloadData = payload.slice(index, index + payloadLength);
                for (let i = 0; i < payloadData.length; i++) {

                    payloadData[i] = payloadData[i] ^ maskingKey[i % 4];

                }

                next = payload.slice(index + payloadLength);

            } else {

                waiting = true;
                next = payload;

            }

            return {
                'FIN': FIN,
                'opcode': opcode,
                'payloadLength': payloadLength,
                'payloadData': payloadData,
                'next': next,
                'waiting': waiting
            };

        }

    }

    #encode(message, opcode) {

        let size = message.length;

        let buffer;
        if (size <= 125) {

            buffer = Buffer.alloc(size + 2 + 0);            
            buffer.writeUInt8(0x80 | opcode, 0);
            buffer.writeUInt8(size, 1);
            message.copy(buffer, 2);

        } else if (size <= 65535) {

            buffer = Buffer.alloc(size + 2 + 2);            
            buffer.writeUInt8(0x80 | opcode, 0);
            buffer.writeUInt8(126, 1);
            buffer.writeUInt16BE(size, 2);
            message.copy(buffer, 4);

        } else { // This implementation cannot handle lengths greater than 2^32

            buffer = Buffer.alloc(size + 2 + 8);            
            buffer.writeUInt8(0x80 | opcode, 0);
            buffer.writeUInt8(127, 1);
            buffer.writeUInt32BE(0, 2);
            buffer.writeUInt32BE(size, 6);
            message.copy(buffer, 10);

        }

        return buffer;

    }


    bytesRead(clientId) {

        if (clientId in this.#clients && !this.#clients[clientId].socket.destroyed) {

            return this.#clients[clientId].socket.bytesRead;

        } else {

            return null;

        }

    }

    bytesWritten(clientId) {

        if (clientId in this.#clients && !this.#clients[clientId].socket.destroyed) {

            return this.#clients[clientId].socket.bytesWritten;

        } else {

            return null;

        }

    }

    isPaused(clientId) {

        if (clientId in this.#clients && !this.#clients[clientId].socket.destroyed) {

            return this.#clients[clientId].socket.isPaused();

        } else {

            return null;

        }

    }

    pause(clientId) {

        if (clientId in this.#clients && !this.#clients[clientId].socket.destroyed) {

            this.#clients[clientId].socket.pause();

            return this.#clients[clientId].socket.isPaused();

        } else {

            return null;

        }

    }

    readyState(clientId) {

        if (clientId in this.#clients && !this.#clients[clientId].socket.destroyed) {

            return this.#clients[clientId].socket.readyState;

        } else {

            return null;

        }

    }


    close(clientId) {

        if (clientId in this.#clients) {

            if (!this.#clients[clientId].socket.destroyed) {

                this.#clients[clientId].socket.end();
                this.#clients[clientId].socket.destroy();

            }

            if (this.#clients[clientId].socket.destroyed) {

                return delete this.#clients[clientId];

            } else {

                return false;

            }

        } else {

            return null;

        }

    }

    ping(clientId, pongTimeout = this.#pongTimeout) {

        if (clientId in this.#clients && !this.#clients[clientId].socket.destroyed) {

            this.#clients[clientId].ping.content = clientId;

            // Closes the connection if not answered correctly in a timely manner
            if (pongTimeout >= 0) {

                this.#clients[clientId].ping.timer = setTimeout(() => {

                    this.emit('close', clientId, {code: 1011, message:  'Unexpected Condition'});

                    this.close(clientId);

                }, pongTimeout);

            }

            return this.#clients[clientId].socket.write(this.#encode(Buffer.from(this.#clients[clientId].ping.content, 'utf8'), 0x9));

        } else {

            return null;

        }

    }

    send(clientId, data, encoding = this.#encoding) {

        let opcode = 0x2;

        if (!Buffer.isBuffer(data)) {

            if (typeof data == 'string') {

                opcode = 0x1;

            }

            data = Buffer.from(data);

        }

        if (clientId in this.#clients && !this.#clients[clientId].socket.destroyed) {

            return this.#clients[clientId].socket.write(this.#encode(data, opcode), encoding);

        } else {

            return null;

        }

    }

};

module.exports = WebSocket;