import { QueueItem } from '../types';
import {TDAGameAnalyticsSDK} from "../sdk-core";

export class QueueManager {
    private queue: QueueItem[] = [];
    private static readonly MAX_RETRIES = 3;
    private static readonly STORAGE_KEY = 'ga_queue';

    constructor(private sdk: TDAGameAnalyticsSDK) {
        this.loadFromStorage();
    }

    enqueue(item: Omit<QueueItem, 'id' | 'timestamp' | 'retries'>) {
        const queueItem: QueueItem = {
            ...item,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            retries: 0
        };

        this.queue.push(queueItem);
        this.saveToStorage();
    }

    async processQueue() {
        this.queue.sort((a, b) => a.priority - b.priority);

        for (const item of [...this.queue]) {
            try {
                await this.sdk.sendRawData(item.data);
                this.removeFromQueue(item.id);
            } catch (error) {
                item.retries++;
                if (item.retries >= QueueManager.MAX_RETRIES) {
                    this.removeFromQueue(item.id);
                }
            }
        }
    }

    private loadFromStorage() {
        try {
            const storedData = localStorage.getItem(QueueManager.STORAGE_KEY);
            if (!storedData) return;

            const parsedData = JSON.parse(storedData);

            // Валидация структуры данных
            if (Array.isArray(parsedData)) {
                this.queue = parsedData.filter(item =>
                    typeof item?.id === 'string' &&
                    typeof item?.timestamp === 'number' &&
                    typeof item?.priority === 'number' &&
                    typeof item?.retries === 'number' &&
                    item.data !== undefined
                );
            }
        } catch (error) {
            console.error('Failed to load queue from storage:', error);
            // Восстановление после ошибки - очистка поврежденных данных
            localStorage.removeItem(QueueManager.STORAGE_KEY);
        }
    }

    private saveToStorage() {
        try {
            const dataToSave = this.queue.map(item => ({
                id: item.id,
                timestamp: item.timestamp,
                data: item.data,
                priority: item.priority,
                retries: item.retries
            }));

            localStorage.setItem(QueueManager.STORAGE_KEY, JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Failed to save queue to storage:', error);

            // Обработка переполнения хранилища
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                this.handleStorageOverflow();
            }
        }
    }

    private handleStorageOverflow() {
        const MAX_ATTEMPTS = 5;
        let attempt = 1;

        while (attempt <= MAX_ATTEMPTS && this.queue.length > 0) {
            const removalPercent = 0.2 * attempt; // 20%, 40%, 60%, 80%, 100%
            const itemsToRemove = Math.ceil(this.queue.length * removalPercent);

            this.queue = this.queue.slice(itemsToRemove);

            try {
                this.saveToStorage();
                return;
            } catch (error) {
                if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') {
                    break;
                }
            }
            attempt++;
        }

        console.error('Failed to resolve storage overflow after', MAX_ATTEMPTS, 'attempts');
    }

    private removeFromQueue(id: string) {
        this.queue = this.queue.filter(item => item.id !== id);
        this.saveToStorage();
    }
}