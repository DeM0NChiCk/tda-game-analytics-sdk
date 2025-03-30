import { MetricCollector } from '../types';

/**
 * Сборщик метрик производительности игры
 *
 * @remarks
 * Собирает следующие показатели:
 * - FPS (кадры в секунду)
 * - Использование памяти JS heap (если доступно)
 * - Время загрузки страницы
 * - Информацию об устройстве пользователя
 * - Таймстамп начала работы performance API
 *
 * @example
 * ```typescript
 * // Добавление в SDK
 * const sdk = TDAGameAnalyticsSDK.getInstance();
 * sdk.addCollector(new PerformanceCollector());
 * ```
 */
export class PerformanceCollector implements MetricCollector {
    private fps = 0;
    private frameCount = 0;
    private lastFpsUpdate = Date.now();
    private readonly hasPerformanceMemory: boolean;

    /**
     * Создает экземпляр сборщика производительности
     *
     * @remarks
     * Автоматически проверяет доступность Performance Memory API
     */
    constructor() {
        this.hasPerformanceMemory = 'memory' in performance &&
            performance.memory !== undefined;
    }

    /**
     * Запускает отслеживание FPS
     *
     * @remarks
     * Использует requestAnimationFrame для расчета кадров в секунду
     */
    start() {
        const calculateFps = () => {
            const now = Date.now();
            if (now - this.lastFpsUpdate >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastFpsUpdate = now;
            }
            this.frameCount++;
            requestAnimationFrame(calculateFps);
        };
        calculateFps();
    }

    /**
     * Останавливает отслеживание (заглушка, не требуется для данной реализации)
     */
    stop() {}

    /**
     * Рассчитывает время загрузки страницы
     *
     * @returns Время загрузки в миллисекундах или null
     *
     * @remarks
     * Использует PerformanceNavigationTiming API
     */
    private getLoadTime(): number | null {
        const navigationEntry = performance.getEntriesByType('navigation')[0] as
            PerformanceNavigationTiming | undefined;

        return navigationEntry
            ? navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime
            : null;
    }

    /**
     * Собирает информацию об устройстве пользователя
     *
     * @returns Объект с информацией об устройстве
     *
     * @remarks
     * Использует User-Agent Client Hints API при доступности
     * @internal
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

    /**
     * Возвращает собранные метрики производительности
     *
     * @returns Объект с метриками:
     * - fps: текущее значение FPS
     * - memory: использование памяти JS heap (если доступно)
     * - loadTime: время загрузки страницы
     * - timeOrigin: точное время начала работы performance API
     * - device: информация об устройстве пользователя
     *
     * @example
     * ```json
     * {
     *   "fps": 60,
     *   "memory": 24568392,
     *   "loadTime": 1200,
     *   "timeOrigin": 1678901234567,
     *   "device": {
     *     "userAgent": "Chrome/120.0.0.0",
     *     "platform": "Windows",
     *     "language": "en-US"
     *   }
     * }
     * ```
     */
    async getMetrics() {
        const deviceInfo = await this.getDeviceInfo();

        return {
            fps: this.fps,
            memory: this.hasPerformanceMemory
                ? (performance as any).memory?.usedJSHeapSize
                : null,
            loadTime: this.getLoadTime(),
            timeOrigin: performance.timeOrigin,
            device: deviceInfo
        };
    }
}