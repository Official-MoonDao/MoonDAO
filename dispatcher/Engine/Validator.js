const moment = require('moment-timezone');

function checkSchedule(schedule, validationTime) {
    // Use provided validation time or get current time
    const currentDate = validationTime || moment().utc();
    const currentSeconds = currentDate.seconds();

    // Initialize empty schedule if none provided
    // This ensures we have a consistent structure even if schedule is null/undefined
    if (!schedule) {
        schedule = {
            time: [],
            weekday: [],
            day: [],
            month: [],
            year: []
        };
    }

    // Get current date/time components in UTC
    const currentWeekday = currentDate.isoWeekday();  // 1-7 (Monday-Sunday)
    const currentMonth = currentDate.month() + 1;      // 1-12 (moment returns 0-11)
    const currentDateOfMonth = currentDate.date();     // 1-31
    const currentTime = currentDate.format('HH:mm');   // 24-hour format in UTC (e.g., "14:30")
    const currentYear = currentDate.year();            // e.g., 2024

    // Only proceed if we're at exactly 0 seconds
    // This prevents multiple executions within the same minute
    if (currentSeconds !== 0) {
        return false;
    }

    // Debug logging for schedule validation
    console.log(`[DEBUG] Schedule check at ${currentDate.format('YYYY-MM-DD HH:mm:ss')} UTC`);
    console.log(`[DEBUG] Current values - Time: ${currentTime}, Month: ${currentMonth}, Weekday: ${currentWeekday}, Day: ${currentDateOfMonth}, Year: ${currentYear}`);
    console.log(`[DEBUG] Schedule values:`, JSON.stringify(schedule, null, 2));

    // Check year if specified
    // If years are specified, current year must be in the list
    if (schedule.year && schedule.year.length > 0) {
        if (!schedule.year.includes(currentYear)) {
            console.log(`[DEBUG] ✗ Year check failed: ${currentYear} not in [${schedule.year}]`);
            return false;
        }
        console.log(`[DEBUG] ✓ Year check passed`);
    }

    // Check month if specified
    // If months are specified, current month must be in the list
    if (schedule.month && schedule.month.length > 0) {
        if (!schedule.month.includes(currentMonth)) {
            console.log(`[DEBUG] ✗ Month check failed: ${currentMonth} not in [${schedule.month}]`);
            return false;
        }
        console.log(`[DEBUG] ✓ Month check passed`);
    }

    // Check time if specified
    // If times are specified, current time must be in the list
    if (schedule.time && schedule.time.length > 0) {
        if (!schedule.time.includes(currentTime)) {
            console.log(`[DEBUG] ✗ Time check failed: ${currentTime} not in [${schedule.time}]`);
            return false;
        }
        console.log(`[DEBUG] ✓ Time check passed`);
    }

    // If all checks pass (or no checks were specified), return true
    console.log('[DEBUG] ✓ All checks passed');
    return true;
}

// Export the function for use in other modules
module.exports = { checkSchedule }; 
