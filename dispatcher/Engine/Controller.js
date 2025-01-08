const fs = require('fs');
const path = require('path');
const { checkSchedule } = require('./Validator');
const { executeEvent } = require('./Executor');
const moment = require('moment');

class EventController {
    // Initialize controller with default events path and load initial events
    constructor(eventsPath = path.join(__dirname, '../Events')) {
        this.eventsPath = eventsPath;
        this.events = [];
        this.isTest = process.env.NODE_ENV === 'test';  // Track if we're in test mode
        this.loadEvents();  // Load events on instantiation
    }

    // Logging utilities that respect test mode
    log(message) {
        if (!this.isTest) {
            console.log(message);
        }
    }

    error(message, error) {
        if (!this.isTest) {
            console.error(message, error);
        }
    }

    // Check if an event should execute based on its schedule
    shouldExecute(event) {
        const shouldRun = checkSchedule(event.schedule);
        if (shouldRun) {
            this.log(`[DEBUG] Schedule validated for event: ${event.name}`);
        }
        return shouldRun;
    }

    // Main event processing loop
    async processEvents() {
        console.log('[DEBUG] Processing events...');
        console.log('[DEBUG] Current events in memory:', this.events.map(e => e.name).join(', '));
        
        // Capture current validation time once for all events in this cycle
        const validationTime = moment().utc();
        
        for (const event of this.events) {
            console.log('[DEBUG] Checking event:', event.name);
            
            // Use checkSchedule directly instead of this.validator.checkSchedule
            if (checkSchedule(event.schedule, validationTime)) {
                console.log(`[DEBUG] Executing scheduled event: ${event.name}`);
                try {
                    await this.executeEventOrPipeline(event);
                } catch (error) {
                    console.error(`[ERROR] Failed to process event ${event.name}:`, error);
                }
            } else {
                console.log(`[DEBUG] Skipping event ${event.name} - schedule not met`);
            }
        }
    }

    // Router function to handle different types of events
    async executeEventOrPipeline(event) {
        if (event.flow) {
            // Execute external API-based flows
            return await executeEvent(event);
        } else if (event.pipeline) {
            // Execute internal pipeline-based flows
            return await this.executePipeline(event);
        } else {
            // Throw error if event configuration is invalid
            throw new Error(`Event ${event.name} has neither flow nor pipeline configuration`);
        }
    }

    // Handle execution of internal pipeline events
    async executePipeline(event) {
        try {
            this.log(`[DEBUG] Starting pipeline execution for event: ${event.name}`);
            
            // Construct absolute path to pipeline file
            const pipelinePath = path.join(__dirname, '..', event.pipeline.path);
            this.log(`[DEBUG] Loading pipeline from: ${pipelinePath}`);
            
            // Verify pipeline file exists
            if (!fs.existsSync(pipelinePath)) {
                this.log(`[ERROR] Pipeline file not found: ${pipelinePath}`);
                throw new Error(`Pipeline file not found: ${pipelinePath}`);
            }

            // Load pipeline module
            const pipeline = require(pipelinePath);
            this.log(`[DEBUG] Pipeline module loaded successfully`);
            
            // Verify pipeline has required execute function
            if (typeof pipeline.execute !== 'function') {
                this.log(`[ERROR] Pipeline ${pipelinePath} missing execute function`);
                throw new Error(`Pipeline ${pipelinePath} does not export an execute function`);
            }

            // Execute pipeline with provided input
            this.log(`[DEBUG] Executing pipeline with input:`, event.pipeline.input);
            const result = await pipeline.execute(event.pipeline.input);
            this.log(`[DEBUG] Pipeline execution completed with result:`, result);
            return result;
        } catch (error) {
            this.error(`[ERROR] Pipeline execution failed for ${event.name}:`, error);
            throw error;
        }
    }

    // Load all event files from the events directory
    loadEvents() {
        try {
            this.log('[DEBUG] Starting event initialization...');
            const files = this.getAllFiles(this.eventsPath);
            this.log(`[DEBUG] Found event files: ${files.join(', ')}`);
            
            this.events = [];
            
            // Process each JSON file in the events directory
            for (const file of files) {
                if (file.endsWith('.json')) {
                    this.log(`[DEBUG] Loading event from: ${file}`);
                    
                    const eventData = fs.readFileSync(file, 'utf8');
                    this.log(`[DEBUG] File contents: ${eventData}`);
                    
                    const event = JSON.parse(eventData);
                    this.events.push(event);
                }
            }
            
            this.log('[INIT] Loaded events: ' + JSON.stringify(this.events, null, 2));
        } catch (error) {
            this.error('[ERROR] Failed to load events:', error);
            // Continue running with existing events if any
        }
    }

    // Recursively get all files in directory and subdirectories
    getAllFiles(dirPath, arrayOfFiles = []) {
        const files = fs.readdirSync(dirPath);

        files.forEach((file) => {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isDirectory()) {
                this.getAllFiles(filePath, arrayOfFiles);
            } else {
                arrayOfFiles.push(filePath);
            }
        });

        return arrayOfFiles;
    }

    // Start the event processing loop
    start() {
        setInterval(() => this.processEvents(), 1000);
    }

    // Clean up event files after execution (for non-scheduled events)
    deleteEventFile(eventName) {
        try {
            const filePath = path.join(this.eventsPath, `${eventName}.json`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                this.log(`[DEBUG] Deleted event file: ${filePath}`);
            } else {
                this.log(`[DEBUG] Event file not found for deletion: ${filePath}`);
            }
        } catch (error) {
            this.error(`[ERROR] Failed to delete event file for ${eventName}:`, error);
        }
    }
}

module.exports = EventController; 