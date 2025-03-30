import { TDAGameAnalyticsSDK } from '../sdk-core';
import { ErrorReport } from "../types";

/**
 * Трекер ошибок для автоматического и ручного отслеживания исключений
 *
 * @remarks
 * Реализует:
 * - Автоматический перехват глобальных ошибок
 * - Обработку неперехваченных Promise rejection
 * - Ручное отслеживание кастомных ошибок
 *
 * @example
 * ```typescript
 * // Инициализация в SDK
 * const sdk = TDAGameAnalyticsSDK.getInstance();
 * const errorTracker = new ErrorTracker(sdk);
 *
 * // Ручное отслеживание ошибки
 * errorTracker.track({
 *   message: 'Custom error',
 *   stack: new Error().stack,
 *   context: { section: 'physics' }
 * });
 * ```
 */
export class ErrorTracker {
    /**
     * Создает экземпляр трекера ошибок
     * @param sdk - Экземпляр SDK для интеграции
     *
     * @remarks
     * Автоматически инициализирует обработчики ошибок при создании
     */
    constructor(private sdk: TDAGameAnalyticsSDK) {
        this.initErrorHandlers();
    }

    /**
     * Инициализирует глобальные обработчики ошибок
     * @internal
     */
    private initErrorHandlers() {
        window.addEventListener('error', this.handleError);
        window.addEventListener('unhandledrejection', this.handlePromiseRejection);
    }

    /**
     * Ручное отслеживание кастомной ошибки
     * @param report - Объект с данными об ошибке
     *
     * @example
     * ```typescript
     * tracker.track({
     *   message: 'AI module failed',
     *   stack: error.stack,
     *   tags: { module: 'npc_behavior' }
     * });
     * ```
     */
    track(report: ErrorReport) {
        this.sdk.enqueueErrorData(report);
    }

    /**
     * Обработчик глобальных JavaScript ошибок
     * @param event - Объект события ошибки
     * @internal
     */
    private handleError = (event: ErrorEvent) => {
        this.track({
            message: event.message,
            stack: event.error?.stack,
            context: {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            }
        });
    };

    /**
     * Обработчик неперехваченных Promise rejection
     * @param event - Событие отклоненного Promise
     * @internal
     */
    private handlePromiseRejection = (event: PromiseRejectionEvent) => {
        this.track({
            message: 'Unhandled promise rejection',
            stack: event.reason?.stack,
            context: {
                reason: event.reason
            }
        });
    };

    /**
     * Уничтожает трекер, удаляя обработчики событий
     *
     * @remarks
     * Обязательно вызывать при завершении работы приложения
     * для предотвращения утечек памяти
     */
    destroy() {
        window.removeEventListener('error', this.handleError);
        window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
    }
}