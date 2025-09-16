# Slack Bot Microservice

A comprehensive microservice for automating Slack message delivery with advanced data visualization capabilities. This service handles everything from BigQuery data execution to beautiful table rendering and automated Slack posting.

## Overview

This microservice provides a complete solution for:
- **Automated Data Reports**: Execute BigQuery SQL and generate visualizations
- **Scheduled Messaging**: Create recurring messages using cron expressions
- **Manual Execution**: Trigger messages immediately via API
- **Rich Visualizations**: Render HTML tables to images with conditional formatting
- **Queue Management**: Reliable job processing with BullMQ and Redis
- **Monitoring**: Built-in Prometheus metrics and health checks

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Fastify API   │───▶│   BullMQ Queue  │───▶│  Job Processor  │
│                 │    │                 │    │                 │
│ • /health       │    │ • Redis Backend │    │ • Slack Client  │
│ • /metrics      │    │ • Job Scheduling│    │ • BigQuery      │
│ • /jobs         │    │ • Retry Logic   │    │ • Puppeteer     │
│ • /execute-slack│    │                 │    │ • GCS Upload    │
│ • /send-message │    │                 │    │ • Supabase      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

- **Node.js** 20+
- **Redis** (for job queue)
- **Supabase** (for data persistence)
- **Google Cloud Platform** (BigQuery and Cloud Storage)
- **Google Cloud Run** (for deployment)
- **Slack Bot Token** (with appropriate scopes)

## Installation

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd slack-bot-microservice

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Build the project
npm run build

# Start development server
npm run dev
```

### Environment Variables

```bash
# Server Configuration
PORT=8080
NODE_ENV=development

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Supabase Configuration
SUPABASE_URL=https://supabaseurl.co/
SUPABASE_SERVICE_ROLE_KEY=supabasekey
# Note: Supabase authentication uses:
# Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
# apikey: {SUPABASE_SERVICE_ROLE_KEY}

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CREDENTIALS={"type":"service_account",...}
# OR use file path:
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account.json

# Google Cloud Storage
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_CLOUD_STORAGE_CREDENTIALS={"type":"service_account",...}

# Puppeteer Configuration
RENDER_MODE=puppeteer

# Queue Configuration
QUEUE_NAME=slack-render
JOB_QUEUE_NAME=slack-jobs
RENDER_QUEUE_NAME=slack-render
```

### Supabase Authentication

**Service Role Key Usage:**
The Supabase Service Role Key is used for server-side operations with full database access.

**Authentication Headers:**
```bash
Authorization: Bearer {{SUPABASE_SERVICE_ROLE_KEY}}
apikey: {{SUPABASE_SERVICE_ROLE_KEY}}
```
## Deployment

### Google Cloud Run Updates

Since the initial deployment is already configured, here's how to update the service with new changes:

#### Quick Update Commands

**1. Pull latest changes:**
```bash
git pull origin main
```

**2. Set new version tag:**
```bash
export TAG="v1.0.1"  # Update version number
export IMAGE_RENDER="us-central1-docker.pkg.dev/orcaanalytics/ms/slack-render:$TAG"
```

**3. Build and deploy:**
```bash
gcloud builds submit . --config cloudbuild.puppeteer.yaml --substitutions=_IMAGE_NAME="$IMAGE_RENDER"
gcloud run deploy slack-render --image "$IMAGE_RENDER" --region us-central1
```

#### Monitor Live Logs

**Follow live logs during deployment:**
```bash
gcloud beta logging tail 'resource.type="cloud_run_revision" AND resource.labels.service_name="slack-render"' --project=orcaanalytics
```

**View service status:**
```bash
gcloud run services describe slack-render --region us-central1 --format="value(status.url)"
```

#### Cloud Build Configuration

The `cloudbuild.puppeteer.yaml` file:
```yaml
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-t', '${_IMAGE_NAME}', '-f', 'Dockerfile.puppeteer', '.']
images:
- '${_IMAGE_NAME}'
```

#### Troubleshooting

**Common issues:**
- **Memory issues:** Increase memory allocation to 2Gi or 4Gi
- **Timeout errors:** Increase timeout to 900s
- **Puppeteer errors:** Ensure using `Dockerfile.puppeteer` with Chrome installed
- **Permission errors:** Check IAM roles for Cloud Run and Secret Manager

**Rollback if needed:**
```bash
# List revisions
gcloud run revisions list --service=slack-render --region=us-central1

# Rollback to specific revision
gcloud run services update-traffic slack-render --to-revisions=REVISION_NAME=100 --region=us-central1
```

### Docker

```bash
# Build Puppeteer-enabled image
docker build -f Dockerfile.puppeteer -t slack-bot-microservice .

# Run container
docker run -p 8080:8080 --env-file .env slack-bot-microservice
```

## API Documentation

### Base URL
```
Local: http://localhost:8080/
Cloud: https://slack-render-83594678211.us-central1.run.app
```

### Authentication
All endpoints (except `/health` and `/metrics`) require Bearer token authentication:

```bash
Authorization: Bearer {{SUPABASE_SERVICE_ROLE_KEY}}
```

---

## Endpoints

### 1. Health Check

**GET** `/health`

Check if the service is running.

**Response:**
```json
{
  "ok": true
}
```

**cURL:**
```bash
curl -X GET "http://localhost:8080/health"
```

---

### 2. Metrics

**GET** `/metrics`

Get Prometheus metrics for monitoring.

**Response:**
```
# HELP nodejs_heap_size_total_bytes Process heap size from node.js in bytes.
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes 12345678
...
```

**cURL:**
```bash
curl -X GET "http://localhost:8080/metrics"
```

---

### 3. Schedule Job

**POST** `/jobs`

Create, update, or disable a scheduled job.

**Request Body:**
```json
{
  "scheduleId": "{REAL-UUID-SCHEDULE}",
  "cron": "0 9 * * 1-5",
  "timezone": "America/New_York",
  "status": "enabled",
  "payload": {
    "parentText": "Daily Metrics Report",
    "parentBlocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "📊 *Daily Performance Metrics*"
        }
      }
    ],
    "replyBlocks": [
      [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "Additional details..."
          }
        }
      ]
    ],
    "visualization": {
      "html": "<h2>Performance Metrics</h2><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody><tr><td>Revenue</td><td>$10,000</td></tr></tbody></table>",
      "fileName": "daily-metrics.png",
      "alt": "Daily Performance Metrics"
    }
  }
}
```

**Response:**
```json
{
  "ok": true,
  "job": {
    "scheduleId": "{REAL-UUID-SCHEDULE}",
    "cron": "0 9 * * 1-5",
    "timezone": "America/New_York"
  }
}
```

**Disable Job:**
```json
{
  "scheduleId": "{REAL-UUID-SCHEDULE}",
  "status": "disabled"
}
```

**cURL:**
```bash
curl -X POST "http://localhost:8080/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "scheduleId": "{REAL-UUID-SCHEDULE}",
    "cron": "0 9 * * 1-5",
    "timezone": "America/New_York",
    "status": "enabled",
    "payload": {
      "parentText": "Daily Metrics Report",
      "parentBlocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "📊 *Daily Performance Metrics*"
          }
        }
      ],
      "visualization": {
        "html": "<h2>Performance Metrics</h2><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody><tr><td>Revenue</td><td>$10,000</td></tr></tbody></table>",
        "fileName": "daily-metrics.png",
        "alt": "Daily Performance Metrics"
      }
    }
  }'
```

---

### 4. Execute Slack Message

**POST** `/execute-slack-message`

Execute a Slack message job immediately without scheduling. This endpoint processes messages from the database, executes BigQuery SQL, generates visualizations, and sends to Slack.

**Request Body:**
```json
{
  "scheduleId": "{REAL-UUID-SCHEDULE}",
  "payload": {
    "messageId": "optional-message-id-override"
  }
}
```

**Simple Message Execution:**
```json
{
  "scheduleId": "{REAL-UUID-SCHEDULE}",
  "payload": {}
}
```

**Response:**
```json
{
  "ok": true,
  "id": "12345"
}
```

**cURL:**
```bash
curl -X POST "http://localhost:8080/execute-slack-message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "scheduleId": "{REAL-UUID-SCHEDULE}",
    "payload": {}
  }'
```

**Note:** The `messageId` in the payload will override the schedule's default `message_id` for this specific execution.

This endpoint automatically:
1. Fetches the message template from Supabase
2. Executes BigQuery SQL if present
3. Generates table visualizations with conditional formatting
4. Uploads images to Google Cloud Storage
5. Sends formatted messages to Slack
6. Handles parent and child message threads

---

### 5. Send Message Simple

**POST** `/send-message-simple`

Send a message directly without using the job queue. Useful for quick testing and debugging.

**Request Body:**
```json
{
  "messageId": "message-uuid-from-database"
}
```

**Response:**
```json
{
  "ok": true,
  "success": true,
  "slack_ts": "1234567890.123456",
  "channel": "C1234567890",
  "childResults": []
}
```

**cURL:**
```bash
curl -X POST "http://localhost:8080/send-message-simple" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "messageId": "6d5f7b30-4366-4041-b57f-97c5be1694e2"
  }'
```

---

### 6. Test SQL

**POST** `/test-sql`

Test BigQuery SQL execution without sending to Slack.

**Request Body:**
```json
{
  "sql": "SELECT * FROM your_table LIMIT 10",
  "companyId": "company-123"
}
```

**Response:**
```json
{
  "ok": true,
  "result": {
    "data": [
      {"column1": "value1", "column2": "value2"}
    ],
    "rows": []
  }
}
```

---

### 7. Debug Template

**GET** `/debug-template/:messageId`

Get detailed information about a message template for debugging.

**Response:**
```json
{
  "ok": true,
  "message": {
    "id": "message-uuid",
    "templateId": "template-uuid",
    "templateName": "Daily Report",
    "hasSqlText": true,
    "sqlTextLength": 1500,
    "hasSlackBlocks": true,
    "slackBlocksCount": 3,
    "hasVizConfig": true,
    "companyId": "company-123"
  }
}
```

---

## Data Models

### Message Processing Flow

The microservice processes messages through the following steps:

1. **Template Retrieval**: Fetches message template from Supabase with SQL, Slack blocks, and visualization config
2. **SQL Execution**: Runs BigQuery queries with company-specific data
3. **Data Processing**: Formats query results and applies conditional formatting
4. **Visualization Generation**: Creates HTML tables with conditional colors and renders to PNG
5. **Image Upload**: Uploads generated images to Google Cloud Storage
6. **Placeholder Replacement**: Replaces `{{visualization_url}}` and other variables in Slack blocks
7. **Message Delivery**: Sends formatted messages to Slack with proper threading

### Database Schema

**slack_messages table:**
- `id`: Unique message identifier
- `template_id`: Reference to slack_templates
- `slack_channel_id`: Target Slack channel
- `workspace_id`: Slack workspace reference
- `is_parent`: Whether this is a parent message
- `parent_message_id`: Reference to parent (for child messages)
- `position`: Order for child messages

**slack_templates table:**
- `id`: Template identifier
- `name`: Template name
- `sql_text`: BigQuery SQL query
- `slack_blocks`: Slack Block Kit JSON
- `viz_config_json`: Visualization configuration

**slack_schedules table:**
- `id`: Schedule identifier
- `message_id`: Reference to slack_messages
- `cron_expr`: Cron expression for scheduling
- `timezone`: Timezone for execution
- `status`: enabled/disabled

### Visualization Configuration

The `viz_config_json` field controls table formatting:

```json
{
  "tableConfig": {
    "column_name": {
      "alignment": "Left|Center|Right",
      "format": "Text|Number|Currency|Percent",
      "decimalPlaces": 2,
      "currency": "$ (USD)",
      "conditionalFormatting": "Yes|No",
      "colorScale": "Low green, high red|Low red, high green|Low green, high white|Low white, high green"
    }
  }
}
```

### Placeholder Variables

Supported placeholders in Slack blocks:
- `{{template_name}}`: Template name
- `{{workspace_id}}`: Slack workspace ID
- `{{company_id}}`: Company identifier
- `{{channel_id}}`: Slack channel ID
- `{{visualization_url}}`: Generated image URL
- Any column from BigQuery results: `{{column_name}}`

---

## Visualization Features

### Automated Table Generation

The service automatically generates beautiful HTML tables from BigQuery data with:

- **Conditional Formatting**: Color-coded cells based on data values
- **Professional Styling**: Clean, modern table design
- **Responsive Layout**: Optimized for Slack display
- **Data Formatting**: Numbers, currency, percentages with proper alignment

### Conditional Formatting

Tables support four color scales:
- **Low green, high red**: Green for low values, red for high values
- **Low red, high green**: Red for low values, green for high values  
- **Low green, high white**: Green fades to white
- **Low white, high green**: White fades to green

### Image Processing Pipeline

1. **Data Query**: Execute BigQuery SQL with company context
2. **Table Generation**: Create HTML with conditional formatting
3. **Image Rendering**: Convert HTML to PNG using Puppeteer
4. **Cloud Upload**: Store image in Google Cloud Storage
5. **URL Generation**: Create signed URLs for Slack access
6. **Message Assembly**: Replace placeholders and send to Slack

### Thread Management

- **Parent Messages**: Main message with optional visualization
- **Child Messages**: Thread replies with additional data
- **Automatic Ordering**: Child messages processed in position order
- **Error Handling**: Failed child messages don't affect parent

---

## Configuration

### Cron Expressions

Supported cron format: `minute hour day month dayOfWeek`

**Examples:**
- `"0 9 * * 1-5"` - Weekdays at 9 AM
- `"0 0 1 * *"` - First day of every month
- `"*/15 * * * *"` - Every 15 minutes

### Timezones

Use IANA timezone identifiers:
- `"America/New_York"`
- `"Europe/London"`
- `"Asia/Tokyo"`
- `"UTC"` (default)

### Slack Scopes Required

```
chat:write
files:write
```

---

## Testing

### Run Tests

```bash
npm test
```

### Test Coverage

The test suite covers:
- Job processing logic
- Slack API integration
- Image rendering
- Queue management
- Metrics collection

### Manual Testing

Use the `/send-message-simple` endpoint to test your configurations:

```bash
# Test message execution
curl -X POST "http://localhost:8080/send-message-simple" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "messageId": "6d5f7b30-4366-4041-b57f-97c5be1694e2"
  }'

# Test SQL execution
curl -X POST "http://localhost:8080/test-sql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "sql": "SELECT * FROM your_table LIMIT 5",
    "companyId": "company-123"
  }'

# Debug template
curl -X GET "http://localhost:8080/debug-template/6d5f7b30-4366-4041-b57f-97c5be1694e2" \
  -H "Authorization: Bearer <token>"
```

---

## Monitoring

### Metrics

The service exposes Prometheus metrics at `/metrics`:

- **Job Processing**: Success/failure rates, duration
- **System Metrics**: Memory usage, CPU, heap size
- **Queue Metrics**: Job counts, processing times
- **Slack API**: Request counts, response times

### Health Checks

Monitor service health with `/health` endpoint:

```bash
curl http://localhost:8080/health
```

### Logging

Structured logging with Pino:
- Job execution details
- Error tracking
- Performance metrics
- Slack API interactions

---

## Error Handling

### Common Errors

**401 Unauthorized**
```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request**
```json
{
  "error": "cron is required when enabling a job"
}
```

**500 Internal Server Error**
- Check logs for detailed error information
- Verify Redis connection
- Ensure Slack token is valid

### Retry Logic

- **Job Failures**: Automatic retry with exponential backoff
- **Slack API**: Built-in retry for rate limits
- **Image Rendering**: Fallback to direct URL if Puppeteer fails

---

## Security

### Authentication

- JWT-based authentication for all endpoints
- Bearer token validation
- Configurable JWT secret

### Data Protection

- Environment variable configuration
- Secure token storage
- Input validation with Zod schemas

---

## Performance

### Optimization Features

- **Queue Processing**: Asynchronous job processing with BullMQ
- **Image Caching**: Efficient image handling and GCS storage
- **Connection Pooling**: Redis and Supabase connections
- **Memory Management**: Proper cleanup of Puppeteer instances
- **Type Safety**: Full TypeScript implementation with centralized types
- **Error Handling**: Graceful degradation and comprehensive error reporting

### Scaling

- **Horizontal Scaling**: Multiple worker instances
- **Queue Distribution**: Redis-based job distribution
- **Resource Limits**: Configurable memory and CPU limits
- **Database Optimization**: Efficient Supabase queries with proper indexing

---

## Development

### Project Structure

```
src/
├── api/           # Fastify API routes and schemas
├── clients/       # External service clients (BigQuery, GCS, Slack)
├── config/        # Configuration management
├── jobs/          # Job processing logic
├── lib/           # Shared utilities and processors
├── metrics/       # Prometheus metrics
├── queue/         # BullMQ configuration
├── types/         # Centralized TypeScript interfaces
└── utils/         # Helper functions
```

### Key Components

- **SlackMessageProcessor**: Core orchestrator for message processing
- **TableGenerator**: Creates HTML tables with conditional formatting
- **PlaceholderProcessor**: Handles variable replacement in Slack blocks
- **BigQueryClient**: Executes SQL queries with proper authentication
- **GCSClient**: Manages image uploads to Google Cloud Storage
- **SlackClient**: Handles Slack API communication

---

## Support

For issues and questions:
- Check the logs for detailed error information
- Verify your Slack bot token and scopes
- Ensure Redis is accessible
- Check Supabase connection
- Verify Google Cloud credentials and permissions
- Test individual components using the debug endpoints

### Common Issues

**BigQuery Authentication**: Ensure `GOOGLE_CLOUD_CREDENTIALS` or `GOOGLE_APPLICATION_CREDENTIALS` is properly configured

**GCS Upload Failures**: Check bucket permissions and `GCS_BUCKET_NAME` configuration

**Slack API Errors**: Verify bot token has `chat:write` and `files:write` scopes

**Template Processing**: Use `/debug-template/:messageId` to inspect template configuration

**SQL Execution**: Test queries with `/test-sql` endpoint before scheduling

---


