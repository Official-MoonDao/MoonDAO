const path = require('path');
const fs = require('fs');
const EventController = require('../Controller');
const { checkSchedule } = require('../Validator');
const { executeEvent } = require('../Executor');

// Mock dependencies
jest.mock('fs');
jest.mock('../Validator');
jest.mock('../Executor');

describe('EventController Tests', () => {
    let controller;
    const mockEventsPath = path.join(__dirname, '../TestEvents');

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Mock fs.readdirSync
        fs.readdirSync.mockReturnValue(['test1.json', 'test2.json', 'notjson.txt']);
        
        // Mock fs.readFileSync
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.includes('test1.json')) {
                return JSON.stringify({
                    name: 'test1',
                    schedule: { time: ['09:00'], weekday: [1], month: [12] },
                    flow: { input: { message: 'test1' } }
                });
            }
            if (filePath.includes('test2.json')) {
                return JSON.stringify({
                    name: 'test2',
                    schedule: { time: ['10:00'], weekday: [2], month: [12] },
                    flow: { input: { message: 'test2' } }
                });
            }
        });

        // Initialize controller
        controller = new EventController(mockEventsPath);
    });

    test('should load events from directory', () => {
        expect(controller.events).toHaveLength(2);
        expect(controller.events[0].name).toBe('test1');
        expect(controller.events[1].name).toBe('test2');
    });

    test('should handle file read errors', () => {
        fs.readFileSync.mockImplementationOnce(() => {
            throw new Error('File read error');
        });

        controller.loadEvents();
        expect(controller.events).toHaveLength(0);
    });

    test('should check if event should execute', () => {
        checkSchedule.mockReturnValueOnce(true);
        
        const event = controller.events[0];
        const shouldExecute = controller.shouldExecute(event);
        
        expect(shouldExecute).toBe(true);
        expect(checkSchedule).toHaveBeenCalledWith(event.schedule);
    });

    test('should process events', async () => {
        checkSchedule.mockReturnValue(true);
        executeEvent.mockResolvedValue({ success: true });

        await controller.processEvents();

        expect(executeEvent).toHaveBeenCalledTimes(2);
        expect(executeEvent).toHaveBeenCalledWith(controller.events[0]);
        expect(executeEvent).toHaveBeenCalledWith(controller.events[1]);
    });

    test('should handle execution errors', async () => {
        checkSchedule.mockReturnValue(true);
        executeEvent.mockRejectedValueOnce(new Error('Execution failed'));
        executeEvent.mockResolvedValueOnce({ success: true });

        await controller.processEvents();

        expect(executeEvent).toHaveBeenCalledTimes(2);
        // Should continue processing even after error
        expect(executeEvent).toHaveBeenCalledWith(controller.events[1]);
    });

    test('should start processing events periodically', () => {
        jest.useFakeTimers();
        const processSpy = jest.spyOn(controller, 'processEvents');

        controller.start();
        
        jest.advanceTimersByTime(3000);
        
        expect(processSpy).toHaveBeenCalledTimes(3);
        
        jest.useRealTimers();
    });
}); 