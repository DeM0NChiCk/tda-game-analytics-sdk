import { SDKConfig, MetricCollector, ErrorReport, EventPriority } from './types';
import { QueueManager } from './lib/queue-manager';
import { RealtimeDashboard } from './lib/realtime-dashboard';
import { ErrorTracker } from './lib/error-tracker';
import { EventEmitter } from './lib/event-emitter';

declare global {
    interface Navigator {
        userAgentData?: {
            readonly platform: string;
            getHighEntropyValues(keys: string[]): Promise<{ platform: string }>;
        };
    }
}

/**
 * Основной класс SDK для сбора аналитики в браузерных играх
 *
 * @category Core Functionally
 *
 * @example
 * ```typescript
 * // Инициализация SDK
 * TDAGameAnalyticsSDK.init({
 *   endpoint: 'https://api.example.com',
 *   apiKey: 'your-api-key',
 *   errorTracking: true
 * });
 *
 * // Получение экземпляра
 * const sdk = TDAGameAnalyticsSDK.getInstance();
 * ```
 */
export class TDAGameAnalyticsSDK {
    private static instance: TDAGameAnalyticsSDK;
    private config: SDKConfig;
    private queueManager: QueueManager;
    private realtimeDashboard?: RealtimeDashboard;
    private errorTracker?: ErrorTracker;
    private collectors: MetricCollector[] = [];
    private customCollectors: MetricCollector[] = [];
    private events = new EventEmitter();

    /**
     * Приватный конструктор (используйте статические методы init/getInstance)
     * @param config - Конфигурация SDK
     */
    private constructor(config: Partial<SDKConfig>) {
        this.config = {
            sendInterval: 30000,
            maxCacheAge: 86400000,
            enabledMetrics: ['performance', 'userActions'],
            endpoint: '',
            apiKey: '',
            ...config
        };

        this.queueManager = new QueueManager(this);
        this.initErrorTracking();
        this.initRealtime();
        this.initAutoSend();
    }

    /**
     * Инициализирует периодическую отправку данных
     */
    private initAutoSend() {
        if (this.config.sendInterval > 0) {
            setInterval(() => this.sendData(), this.config.sendInterval);
        }
    }

    /**
     * Собирает метрики из системных сборщиков
     * @returns Объект с системными метриками
     */
    private collectSystemMetrics() {
        return this.collectors.reduce((acc, collector) => ({
            ...acc,
            ...collector.getMetrics()
        }), {});
    }

    /**
     * Собирает метрики из кастомных сборщиков
     * @returns Объект с кастомными метриками
     */
    private collectCustomMetrics() {
        return this.customCollectors.reduce((acc, collector) => ({
            ...acc,
            ...collector.getMetrics()
        }), {});
    }

    /**
     * Инициализирует SDK с указанной конфигурацией
     * @param config - Конфигурация SDK
     * @returns Экземпляр SDK
     */
    static init(config: Partial<SDKConfig>): TDAGameAnalyticsSDK {
        if (!this.instance) {
            this.instance = new TDAGameAnalyticsSDK(config);
        }
        return this.instance;
    }

    /**
     * Возвращает инициализированный экземпляр SDK
     * @throws {Error} Если SDK не инициализирован
     * @returns Экземпляр SDK
     */
    static getInstance(): TDAGameAnalyticsSDK {
        if (!this.instance) {
            throw new Error('SDK not initialized');
        }
        return this.instance;
    }

    /**
     * Инициализирует трекинг ошибок
     */
    private initErrorTracking() {
        if (this.config.errorTracking) {
            this.errorTracker = new ErrorTracker(this);
        }
    }

    /**
     * Инициализирует real-time дашборд
     */
    private initRealtime() {
        if (this.config.realtime?.enabled) {
            this.realtimeDashboard = new RealtimeDashboard(
                this.config.realtime.websocketUrl || 'wss://realtime.yourplatform.com'
            );
            this.events.on('data', (data) => {
                this.realtimeDashboard?.send(data);
            });
        }
    }

    /**
     * Добавляет сборщик системных метрик
     * @param collector - Реализация интерфейса MetricCollector
     */
    addCollector(collector: MetricCollector) {
        this.collectors.push(collector);
        collector.start();
    }

    /**
     * Отслеживает ошибку и добавляет ее в очередь
     * @param report - Отчет об ошибке
     */
    trackError(report: ErrorReport) {
        if (this.config.errorTracking) {
            this.errorTracker?.track(report);
        }
        this.enqueueData({
            type: 'error',
            data: report,
            priority: EventPriority.CRITICAL
        });
    }

    /**
     * Добавляет данные об ошибке в очередь
     * @param report - Отчет об ошибке
     */
    enqueueErrorData(report: ErrorReport) {
        this.enqueueData({
            type: 'error',
            data: report,
            priority: EventPriority.CRITICAL
        });
    }

    /**
     * Отслеживает кастомное событие
     * @param eventName - Название события
     * @param payload - Дополнительные данные события
     */
    trackCustomEvent(eventName: string, payload: any = {}) {
        this.enqueueData({
            type: 'customEvent',
            event: eventName,
            data: payload,
            priority: EventPriority.NORMAL
        });
    }

    /**
     * Добавляет данные в очередь отправки
     * @param data - Данные для отправки
     * @param priority - Приоритет отправки
     */
    private enqueueData(data: any, priority: EventPriority = EventPriority.NORMAL) {
        this.queueManager.enqueue({
            data,
            priority
        });
    }

    /**
     * Отправляет собранные данные на сервер
     * @async
     * @throws {Error} При ошибках сети или сервера
     */
    async sendData() {
        try {
            const metrics = this.prepareMetrics();
            const data = {
                ...metrics,
                session: this.getCurrentSessionInfo()
            };

            this.events.emit('data', data);

            if (!navigator.onLine) {
                this.queueManager.enqueue({ data, priority: EventPriority.NORMAL });
                return;
            }

            await this.sendRawData(data);
            await this.queueManager.processQueue();
        } catch (error) {
            console.error('Error sending analytics:', error);
        }
    }

    /**
     * Отправляет сырые данные на сервер
     * @param data - Данные для отправки
     * @async
     * @throws {Error} При ошибках сети или сервера
     */
    async sendRawData(data: any) {
        const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.config.apiKey
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    }

    /**
     * Добавляет кастомный сборщик метрик
     * @param collector - Реализация интерфейса MetricCollector
     */
    addCustomCollector(collector: MetricCollector) {
        this.customCollectors.push(collector);
        collector.start();
    }

    /**
     * Подготавливает метрики к отправке
     * @returns Отфильтрованные метрики
     */
    private prepareMetrics() {
        return {
            system: this.filterMetrics(this.collectSystemMetrics(), 'system'),
            custom: this.filterMetrics(this.collectCustomMetrics(), 'custom')
        };
    }

    /**
     * Фильтрует метрики согласно конфигурации
     * @param metrics - Собранные метрики
     * @param type - Тип метрик (system/custom)
     * @returns Отфильтрованные метрики
     */
    private filterMetrics(metrics: Record<string, any>, type: 'system' | 'custom') {
        return Object.fromEntries(
            Object.entries(metrics).filter(([key]) =>
                this.config.enabledMetrics.includes(`${type}.${key}`)
            )
        );
    }

    /**
     * Возвращает информацию о текущей сессии
     * @returns Информация о сессии
     */
    getCurrentSessionInfo() {
        return {
            sessionId: localStorage.getItem('ga_session_id') || crypto.randomUUID(),
            userId: localStorage.getItem('ga_user_id'),
            deviceInfo: this.getDeviceInfo()
        };
    }

    /**
     * Собирает информацию об устройстве пользователя
     * @returns Информация об устройстве
     */
    private async getDeviceInfo() {
        let platform: string | undefined;

        if (navigator.userAgentData) {
            try {
                const data = await navigator.userAgentData.getHighEntropyValues(["platform"]);
                platform = data.platform;
            } catch (e) {
                platform = navigator.userAgentData.platform || 'unknown';
            }
        } else {
            platform = navigator.platform;
        }

        return {
            userAgent: navigator.userAgent,
            platform,
            language: navigator.language
        };
    }
}