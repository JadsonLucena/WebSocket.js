const EventEmitter = require('events');

class WebSocket extends EventEmitter {

    constructor() {

        super({captureRejections: true});

        this.setMaxListeners(0);

    }

};