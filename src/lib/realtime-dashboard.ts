export class RealtimeDashboard {
    private ws!: WebSocket;
    private reconnectAttempts = 0;

    constructor(private url: string) {
        this.connect();
    }

    private connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
        };

        this.ws.onclose = () => {
            this.reconnect();
        };
    }

    private reconnect() {
        const timeout = Math.min(1000 * (2 ** this.reconnectAttempts), 30000);
        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, timeout);
    }

    send(data: any) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}