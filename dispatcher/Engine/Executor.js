const fs = require('fs');
const path = require('path');
const https = require('https');

// Make delay function configurable for testing purposes
// Default implementation uses standard setTimeout
let delayFn = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Utility function for consistent timestamp logging
function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// Allow tests to override the delay function
function setDelayFunction(fn) {
    delayFn = fn;
}

async function executeEvent(event) {
    let attempt = 0;
    const maxAttempts = 3;  // Maximum number of retry attempts

    // Retry loop for handling transient failures
    while (attempt < maxAttempts) {
        try {
            log(`Attempt ${attempt + 1}/${maxAttempts} for event: ${event.name}`);
            
            // Prepare request payload
            const data = JSON.stringify({
                inputs: event.flow.input,
                version: event.flow.version
            });

            log(`Sending request to API: ${event.flow.api}`);

            // Make HTTP request using Promise wrapper
            const response = await new Promise((resolve, reject) => {
                // Configure request options
                const options = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': data.length,
                        'Authorization': `Bearer ${process.env.WORDWARE_API_KEY}`  
                    }
                };

                // Create HTTPS request
                const req = https.request(event.flow.api, options);

                // Handle response
                req.on('response', (res) => {
                    let responseData = '';

                    log(`Response status: ${res.statusCode}`);

                    // Check for non-200 status codes
                    if (res.statusCode !== 200) {
                        reject(new Error(`Server responded with status ${res.statusCode}`));
                        return;
                    }

                    // Collect response data chunks
                    res.on('data', chunk => {
                        responseData += chunk;
                    });

                    // Process complete response
                    res.on('end', () => {
                        try {
                            log(`Raw API Response: ${responseData}`);  
                            resolve(JSON.parse(responseData));
                        } catch (e) {
                            reject(new Error(`Invalid JSON response. Raw response: ${responseData}`));
                        }
                    });
                });

                // Handle request errors
                req.on('error', (e) => {
                    log(`Request error: ${e.message}`);
                    reject(e);
                });

                // Send request data
                req.write(data);
                req.end();
            });

            log(`Event completed successfully: ${event.name}`);
            return response;

        } catch (error) {
            attempt++;
            log(`Attempt ${attempt} failed: ${error.message}`);
            
            // Only retry on specific types of errors
            // - Server status errors (e.g., 500, 503)
            // - Timeout errors
            // - Connection reset errors
            if (!error.message.includes('Server responded with status') && 
                !error.message.includes('timeout') && 
                !error.message.includes('ECONNRESET')) {
                log(`Error doesn't warrant retry, stopping attempts`);
                throw error;
            }
            
            // If we've exhausted all attempts, throw the last error
            if (attempt === maxAttempts) {
                log(`All ${maxAttempts} attempts failed for event: ${event.name}`);
                throw error;
            }
            
            // Exponential backoff: wait longer between each retry
            const waitTime = 1000 * Math.pow(2, attempt);  // 2^attempt seconds
            log(`Waiting ${waitTime}ms before retry...`);
            await delayFn(waitTime);
        }
    }
}

// Export functions for use in other modules
module.exports = {
    executeEvent,
    setDelayFunction,
    delay: delayFn
}; 