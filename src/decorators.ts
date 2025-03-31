import { TDAGameAnalyticsSDK } from './sdk-core';
import { EventPriority } from './types';

export function TrackEvent(eventName: string, priority: EventPriority = EventPriority.NORMAL) {
    return function <T extends Function>(
        target: any,
        context: ClassMethodDecoratorContext
    ) {
        const originalMethod = target as T;

        function replacementMethod(this: any, ...args: any[]) {
            const result = originalMethod.apply(this, args);
            TDAGameAnalyticsSDK.getInstance().trackCustomEvent(eventName, {
                method: context.name.toString(),
                args: args,
                result: result,
                context: this
            });
            return result;
        }

        return replacementMethod;
    };
}
