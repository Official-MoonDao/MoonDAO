const { checkSchedule } = require('../Validator');
const moment = require('moment-timezone');

// Mock moment-timezone
jest.mock('moment-timezone', () => {
    const mMoment = {
        utc: jest.fn(() => mMoment),
        isoWeekday: jest.fn(),
        month: jest.fn(),
        date: jest.fn(),
        format: jest.fn(),
        seconds: jest.fn(),  // Add seconds mock
        year: jest.fn()  // Add year mock
    };
    return jest.fn(() => mMoment);
});

describe('Validator Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Basic Time Validation Tests
    describe('Time Validation', () => {
        test('should validate daily notification at specific time with 0 seconds', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);
            mockMoment.month.mockReturnValue(11);
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            mockMoment.seconds.mockReturnValue(0);
            
            const schedule = {
                time: ["14:00"],
                weekday: [],
                day: [],
                month: [12]
            };

            expect(checkSchedule(schedule)).toBe(true);
        });

        test('should reject when not at 0 seconds', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);
            mockMoment.month.mockReturnValue(11);
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            mockMoment.seconds.mockReturnValue(30);  // Mid-minute
            
            const schedule = {
                time: ["14:00"],
                weekday: [],
                day: [],
                month: [12]
            };

            expect(checkSchedule(schedule)).toBe(false);
        });

        test('should validate multiple times in schedule', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);
            mockMoment.month.mockReturnValue(11);
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            mockMoment.seconds.mockReturnValue(0);
            
            const schedule = {
                time: ["14:00", "15:00", "16:00"],
                weekday: [],
                day: [],
                month: [12]
            };

            expect(checkSchedule(schedule)).toBe(true);
        });
    });

    // Weekday Validation Tests
    describe('Weekday Validation', () => {
        test('should validate specific weekday in month', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(6);  // Saturday
            mockMoment.month.mockReturnValue(11);      // 11 + 1 = 12 (December)
            mockMoment.date.mockReturnValue(23);
            mockMoment.format.mockReturnValue('14:00');
            mockMoment.seconds.mockReturnValue(0);
            
            const schedule = {
                time: ["14:00"],
                weekday: [6],  // Saturday
                day: [],
                month: [12]    // December
            };

            expect(checkSchedule(schedule)).toBe(true);
        });

        test('should validate multiple weekdays', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);  // Wednesday
            mockMoment.month.mockReturnValue(11);      // 11 + 1 = 12 (December)
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            
            const schedule = {
                time: ["14:00"],
                weekday: [2, 3, 4],  // Tuesday, Wednesday, Thursday
                day: [],
                month: [12]          // December
            };

            expect(checkSchedule(schedule)).toBe(true);
        });
    });

    // Month Validation Tests
    describe('Month Validation', () => {
        test('should validate multiple months', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);  // Wednesday
            mockMoment.month.mockReturnValue(11);      // 11 + 1 = 12 (December)
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            
            const schedule = {
                time: ["14:00"],
                weekday: [],
                day: [],
                month: [11, 12]  // November, December
            };

            expect(checkSchedule(schedule)).toBe(true);
        });

        test('should reject wrong month', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);  // Wednesday
            mockMoment.month.mockReturnValue(9);       // 9 + 1 = 10 (October)
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            
            const schedule = {
                time: ["14:00"],
                weekday: [],
                day: [],
                month: [12]  // December
            };

            expect(checkSchedule(schedule)).toBe(false);
        });
    });

    // Edge Cases
    describe('Edge Cases', () => {
        test('should handle empty arrays', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);  // Wednesday
            mockMoment.month.mockReturnValue(11);      // 11 + 1 = 12 (December)
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            
            const schedule = {
                time: [],      // Match any time
                weekday: [],   // Match any weekday
                day: [],       // Match any day
                month: []      // Match any month
            };

            expect(checkSchedule(schedule)).toBe(true);
        });

        test('should handle missing schedule properties', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);  // Wednesday
            mockMoment.month.mockReturnValue(11);      // 11 + 1 = 12 (December)
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            
            const schedule = {};  // Empty schedule should match any time

            expect(checkSchedule(schedule)).toBe(true);
        });

        test('should handle undefined schedule', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);  // Wednesday
            mockMoment.month.mockReturnValue(11);      // 11 + 1 = 12 (December)
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');

            expect(checkSchedule(undefined)).toBe(true);
        });
    });

    // Complex Combinations
    describe('Complex Combinations', () => {
        test('should validate complex schedule combination', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);  // Wednesday
            mockMoment.month.mockReturnValue(11);      // 11 + 1 = 12 (December)
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            
            const schedule = {
                time: ["14:00", "15:00"],
                weekday: [3, 4],          // Wednesday, Thursday
                day: [25, 26],
                month: [12]               // December
            };

            expect(checkSchedule(schedule)).toBe(true);
        });
    });

    // Year Validation Tests
    describe('Year Validation', () => {
        test('should validate specific year', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);
            mockMoment.month.mockReturnValue(11);
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            mockMoment.seconds.mockReturnValue(0);
            mockMoment.year.mockReturnValue(2024);  // Add year mock
            
            const schedule = {
                time: ["14:00"],
                weekday: [],
                day: [],
                month: [12],
                year: [2024]
            };

            expect(checkSchedule(schedule)).toBe(true);
        });

        test('should validate multiple years', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);
            mockMoment.month.mockReturnValue(11);
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            mockMoment.seconds.mockReturnValue(0);
            mockMoment.year.mockReturnValue(2024);
            
            const schedule = {
                time: ["14:00"],
                weekday: [],
                day: [],
                month: [12],
                year: [2024, 2025]  // Multiple years
            };

            expect(checkSchedule(schedule)).toBe(true);
        });

        test('should reject wrong year', () => {
            const mockMoment = moment();
            mockMoment.isoWeekday.mockReturnValue(3);
            mockMoment.month.mockReturnValue(11);
            mockMoment.date.mockReturnValue(25);
            mockMoment.format.mockReturnValue('14:00');
            mockMoment.seconds.mockReturnValue(0);
            mockMoment.year.mockReturnValue(2024);
            
            const schedule = {
                time: ["14:00"],
                weekday: [],
                day: [],
                month: [12],
                year: [2025]  // Different year
            };

            expect(checkSchedule(schedule)).toBe(false);
        });
    });
}); 