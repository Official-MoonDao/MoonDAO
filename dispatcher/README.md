# Dispatcher

The dispatcher is designed to execute tasks based on predefined specifications stored in JSON files within the `Events` folder. Each JSON file represents an "Event" that contains all necessary information to trigger a specific flow at a specified time. Times can be set dynamically using the schedule object.

## Setup

### Google Cloud Configuration

1. **Create a Project**:
   ```bash
   gcloud projects create wordware-dispatcher
   gcloud config set project wordware-dispatcher
   ```

2. **Enable Required APIs**:
   - Cloud Run API
   - Cloud Build API
   - Secret Manager API

3. **Create Service Account**:
   ```bash
   gcloud iam service-accounts create dispatcher-client \
       --display-name="Dispatcher Client Service Account"
   ```

4. **Grant Permissions**:
   ```bash
   gcloud run services add-iam-policy-binding dispatcher-service \
       --region=us-central1 \
       --member="serviceAccount:dispatcher-client@wordware-dispatcher.iam.gserviceaccount.com" \
       --role="roles/run.invoker"
   ```

5. **Store API Key in Secret Manager**:
   ```bash
   echo -n "your-api-key" | gcloud secrets create wordware-api-key \
       --data-file=- \
       --replication-policy="automatic"
   ```

### Deployment

1. **Build and Deploy**:
   ```bash
   gcloud builds submit --config cloudbuild-trigger.yaml
   ```

2. **Verify Deployment**:
   ```bash
   gcloud run services describe dispatcher-service --region us-central1
   ```

## Events

Events are defined in JSON files within the `Events` directory. Each event specifies when it should run and what API call it should make.

Example event:
```json
{
    "name": "morning_notification",
    "flow": {
        "input": { 
            "webhook_url": "https://discord.com/api/webhooks/...",
            "message": "GM!"
        },
        "version": "^1.0",
        "api": "https://app.wordware.ai/api/released-app/.../run"
    },
    "schedule": {
        "time": ["09:00"],
        "weekday": [7],
        "day": [],
        "month": [12]
    }
}
```

### Execution Logic

The dispatcher runs continuously in Cloud Run and processes events every second:
- Checks the current time and date against each event's schedule
- If schedule conditions are met, executes the flow by sending the input data to the specified API endpoint
- Uses temporary files to manage upcoming executions within a 10-minute window

### Authentication

#### Service Authentication
The service uses Google Cloud service accounts for authentication. The service account key is automatically managed by Cloud Run.

#### API Authentication
Flows require a Wordware API key for authentication, stored in Secret Manager and accessed via environment variables:
```
WORDWARE_API_KEY=<YOUR_API_KEY>
```

### Infrastructure

The service runs on Google Cloud Run with the following configuration:
- Memory: 512Mi
- Min Instances: 1
- Max Instances: 1
- Region: us-central1

### Response Handling

The Wordware API supports streaming responses, allowing real-time processing of generated content. Responses can include:
- Generation events (start/end)
- Content chunks
- Final outputs

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Up Authentication**:
   ```bash
   gcloud auth application-default login
   ```

3. **Run Locally**:
   ```bash
   npm run start-orchestrator
   ```
