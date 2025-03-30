import { MetricCollector } from '../types';

/**
 * Сборщик метрик пользовательских действий
 *
 * @remarks
 * Отслеживает:
 * - Количество кликов на странице
 * - Длительность игровой сессии
 *
 * @example
 * ```typescript
 * // Добавление в SDK
 * const sdk = TDAGameAnalyticsSDK.getInstance();
 * sdk.addCollector(new UserActionCollector());
 * ```
 */
export class UserActionCollector implements MetricCollector {
    private clicks: number = 0;
    private sessionStart = Date.now();

    /**
     * Запускает отслеживание пользовательских действий
     *
     * @remarks
     * Регистрирует обработчик события 'click' на window
     */
    start() {
        window.addEventListener('click', this.handleClick);
    }

    /**
     * Останавливает отслеживание пользовательских действий
     *
     * @remarks
     * Удаляет обработчик события 'click' с window
     */
    stop() {
        window.removeEventListener('click', this.handleClick);
    }

    /**
     * Обработчик кликов (увеличивает счетчик)
     * @internal
     */
    private handleClick = () => this.clicks++;

    /**
     * Возвращает собранные метрики
     *
     * @returns Объект с метриками:
     * - clicks: общее количество кликов
     * - sessionDuration: длительность сессии в миллисекундах
     *
     * @example
     * ```json
     * {
     *   "clicks": 42,
     *   "sessionDuration": 12000
     * }
     * ```
     */
    getMetrics() {
        return {
            clicks: this.clicks,
            sessionDuration: Date.now() - this.sessionStart
        };
    }
}