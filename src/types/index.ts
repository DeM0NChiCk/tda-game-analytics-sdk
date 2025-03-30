export enum EventPriority {
    CRITICAL = 1,
    HIGH = 2,
    NORMAL = 3
}

export interface QueueItem {
    id: string;
    timestamp: number;
    data: any;
    retries: number;
    priority: EventPriority;
}

export interface ErrorReport {
    message: string;
    stack?: string;
    context?: any;
    tags?: Record<string, string>;
}

export interface SDKConfig {
    sendInterval: number;
    maxCacheAge: number;
    enabledMetrics: string[];
    endpoint: string;
    apiKey: string;
    errorTracking?: boolean;
    realtime?: {
        enabled: boolean;
        websocketUrl?: string;
    };
}

export interface MetricCollector {
    start(): void;
    stop(): void;
    getMetrics(): Record<string, any>;
}
