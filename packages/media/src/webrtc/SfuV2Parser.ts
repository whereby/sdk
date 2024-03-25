export default class SfuV2Parser {
    static parse(raw: any) {
        let object;

        try {
            object = JSON.parse(raw);
        } catch (error) {
            return;
        }
        if (typeof object !== "object" || Array.isArray(object)) {
            return;
        }

        // Will return message if valid, null if invalid
        if (object.request) {
            // Request
            return SfuV2Parser._handleRequest(object);
        } else if (object.response) {
            // Response
            return SfuV2Parser._handleResponse(object);
        } else if (object.message) {
            // Message
            return SfuV2Parser._handleMessage(object);
        } else {
            // Invalid.
            return;
        }
    }

    static _handleRequest(rawMessage: any) {
        const message: any = {};
        message.request = true;

        if (typeof rawMessage.method !== "string") {
            return;
        }

        if (typeof rawMessage.id !== "number") {
            return;
        }

        message.id = rawMessage.id;
        message.method = rawMessage.method;
        message.data = rawMessage.data || {};

        return message;
    }

    static _handleResponse(rawMessage: any) {
        const message: any = {};
        message.response = true;

        if (typeof rawMessage.id !== "number") {
            return;
        }

        message.id = rawMessage.id;

        // Success
        if (rawMessage.ok) {
            message.ok = true;
            message.data = rawMessage.data || {};
        } else {
            // Error
            message.ok = false;
            message.errorCode = rawMessage.errorCode;
            message.errorReason = rawMessage.errorReason;
        }

        return message;
    }

    static _handleMessage(rawMessage: any) {
        const message: any = {};
        message.message = true;

        if (typeof rawMessage.method !== "string") {
            return;
        }

        message.method = rawMessage.method;
        message.data = rawMessage.data || {};

        return message;
    }

    static createRequest(method: any, data: any) {
        return {
            request: true,
            id: Math.round(Math.random() * 10000000),
            method,
            data: data || {},
        };
    }

    static createSuccessResponse(request: any, data: any) {
        return {
            response: true,
            id: request.id,
            ok: true,
            data: data || {},
        };
    }

    static createErrorResponse(request: any, errorCode: any, errorReason: any) {
        return {
            response: true,
            id: request.id,
            errorCode,
            errorReason,
        };
    }

    static createMessage(method: any, data: any) {
        return {
            message: true,
            method,
            data: data || {},
        };
    }
}
