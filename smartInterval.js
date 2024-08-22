export class SmartInterval {
    callback;
    timeout = 0;
    iId = null;
    _isPaused = false;
    lastTick;
    constructor(callback, interval = 0, runImmediate = false // default case -- means will not run
    ) {
        this.setCallback(callback);
        this.setInterval(interval, runImmediate);
    }
    setInterval(interval, runImmediate = true) {
        const oldInterval = this.timeout;
        this.timeout = interval;
        if (interval > 0 && oldInterval != this.timeout && !this._isPaused) { // new and valid interval
            this.createInterval(runImmediate);
        }
    }
    getInterval() { return this.timeout; }
    setCallback(callback) {
        this.callback = callback;
    }
    pause() {
        clearInterval(this.iId);
        this.iId = null;
        this._isPaused = true;
    }
    play() {
        this.createInterval();
        this._isPaused = false;
    }
    get isPaused() { return this._isPaused; }
    createInterval(runImmediate = true) {
        if (this.iId != null) { // remove old interval, then replace it
            clearInterval(this.iId);
            const now = (new Date()).getTime();
            if (now - this.lastTick >= this.timeout) { // too long between calls, just phone one in
                this.callback();
                this.lastTick = now;
            }
        }
        // create brand new interval
        this.iId = setInterval(() => {
            this.lastTick = (new Date()).getTime();
            this.callback();
        }, this.timeout);
        if (runImmediate) this.callback();
    }
    get id() { return this.id; }
}