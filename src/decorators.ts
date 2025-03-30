import { TDAGameAnalyticsSDK } from './sdk-core';
import { EventPriority } from './types';

export function TrackEvent(eventName: string, priority: EventPriority = EventPriority.NORMAL) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any[]) {
            const result = originalMethod.apply(this, args);
            TDAGameAnalyticsSDK.getInstance().trackCustomEvent(eventName, {
                method: propertyKey,
                args: args,
                result: result,
                context: this
            });
            return result;
        };

        return descriptor;
    };
}