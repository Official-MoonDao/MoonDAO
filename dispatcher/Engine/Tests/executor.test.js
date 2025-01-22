const https = require('https');
const EventEmitter = require('events');

jest.mock('https');

const { executeEvent, setDelayFunction } = require('../Executor');

describe('Executor Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.WORDWARE_API_KEY = 'test-api-key';
        setDelayFunction(() => Promise.resolve());
    });

    afterEach(() => {
        setDelayFunction((ms) => new Promise(resolve => setTimeout(resolve, ms)));
    });

    const createEvent = () => ({
        name: "daily_notification",
        flow: {
            input: { 
                webhook_url: "https://discord.com/api/webhooks/1310050179784900669/XIBJZdRauQMs_y2F47qxqnV2gZ8gO1vCXf1RgcudqnRAZ8oxQAtvTe02oku1-8HpLceb",
                message: "GM!"
            },
            version: "^1.0",
            api: "https://app.wordware.ai/api/released-app/f9cd2df6-f73d-4ab7-808f-33832629130e/run"
        }
    });

    test('should execute daily notification event', async () => {
        const event = createEvent();
        const mockReq = {
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn((event, callback) => {
                if (event === 'response') {
                    const mockRes = new EventEmitter();
                    mockRes.statusCode = 200;
                    process.nextTick(() => {
                        callback(mockRes);
                        mockRes.emit('data', Buffer.from(JSON.stringify({ success: true })));
                        mockRes.emit('end');
                    });
                }
                return mockReq;
            })
        };

        https.request.mockImplementation(() => mockReq);

        const result = await executeEvent(event);
        expect(result).toEqual({ success: true });
        expect(mockReq.write).toHaveBeenCalled();
        expect(mockReq.end).toHaveBeenCalled();
    });

    test('should handle API failure', async () => {
        const event = createEvent();
        const mockReq = {
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn((event, callback) => {
                if (event === 'response') {
                    const mockRes = new EventEmitter();
                    mockRes.statusCode = 500;
                    process.nextTick(() => {
                        callback(mockRes);
                        mockRes.emit('end');
                    });
                }
                return mockReq;
            })
        };

        https.request.mockImplementation(() => mockReq);

        await expect(executeEvent(event)).rejects.toThrow('Server responded with status 500');
        expect(mockReq.write).toHaveBeenCalled();
        expect(mockReq.end).toHaveBeenCalled();
    });

    test('should handle network errors', async () => {
        const event = createEvent();
        const mockReq = {
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn((event, callback) => {
                if (event === 'error') {
                    process.nextTick(() => callback(new Error('Network error')));
                }
                return mockReq;
            })
        };

        https.request.mockImplementation(() => mockReq);

        await expect(executeEvent(event)).rejects.toThrow('Network error');
        expect(mockReq.write).toHaveBeenCalled();
        expect(mockReq.end).toHaveBeenCalled();
    });
});