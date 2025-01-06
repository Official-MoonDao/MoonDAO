# Engine Components

The dispatcher engine consists of three main components that work together to handle scheduled API calls.

## Controller (Controller.js)
The controller is the main orchestrator that:

1. Runs continuously, checking events every second
2. Loads events from the `Events` directory
3. Passes schedules to the Validator
4. Triggers execution when validation passes

Example:

<p>Example flow:</p>
<pre><code>// 1. Load event
const event = {
    "name": "morning_notification",
    "schedule": {
        "time": ["09:00"],
        "weekday": [1],  // Monday
        "month": [12]    // December
    }
};

// 2. Check schedule every second
if (checkSchedule(event.schedule)) {
    // 3. Execute if schedule validates
    await executeEvent(event);
}</code></pre>

<h2>Validator (Validator.js)</h2>
<p>The validator checks if an event should run by comparing its schedule against the current time.</p>

<p>Example validations:</p>
<pre><code>// Matches exactly 9 AM on Mondays in December
{
    "time": ["09:00"],
    "weekday": [1],
    "month": [12]
} 
// Returns true when:
// - Current time is exactly 09:00
// - Current day is Monday
// - Current month is December

// Matches any time in December
{
    "time": [],
    "weekday": [],
    "month": [12]
}
// Returns true when:
// - Current month is December
// (empty arrays mean "match any value")</code></pre>

<h2>Executor (Executor.js)</h2>
<p>The executor handles the API calls with:</p>

1. Retry logic (max 3 attempts)
2. Exponential backoff
3. Error handling
4. Authentication

<p>Example execution:</p>
<pre><code>const event = {
    "name": "example_notification",
    "flow": {
        "input": { 
            "message": "Hello World"
        },
        "version": "^1.0",
        "api": "https://api.example.com/endpoint"
    }
};

// Executor will:
// 1. Add authentication headers
// 2. Make the API call
// 3. Retry on failure (up to 3 times)
// 4. Handle response/errors
const response = await executeEvent(event);</code></pre>

<h2>Authentication (Config/auth.js)</h2>
<p>Handles Google Cloud authentication for the service:</p>

1. Automatically manages service account credentials
2. Provides tokens for API calls
3. Integrates with Cloud Run's security features

<h2>Interaction Flow</h2>
<p>1. <strong>Controller</strong> (every second):</p>
<pre><code>events = loadEvents();
for (event of events) {
    if (checkSchedule(event.schedule)) {  // Validator
        executeEvent(event);              // Executor
    }
}</code></pre>

<p>2. <strong>Validator</strong> (when checking schedule):</p>
<pre><code>currentTime = "09:00";
currentWeekday = 1;
currentMonth = 12;

// All conditions must be true
return (
    timeMatches &&
    weekdayMatches &&
    monthMatches
);</code></pre>

<p>3. <strong>Executor</strong> (when schedule validates):</p>
<pre><code>try {
    token = await getAuthToken();
    response = await makeApiCall(event, token);
    return response;
} catch (error) {
    // Retry logic
}</code></pre>