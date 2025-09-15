# Slack Bot Microservice

A robust microservice for scheduling and executing Slack messages with advanced visualization capabilities, including HTML-to-image rendering using Puppeteer.

## Overview

This microservice provides a comprehensive solution for:
- **Scheduled Slack Messages**: Create recurring messages using cron expressions
- **Manual Execution**: Trigger messages immediately via API
- **Rich Visualizations**: Render HTML content to images and post as Slack threads
- **Queue Management**: Reliable job processing with BullMQ and Redis
- **Monitoring**: Built-in Prometheus metrics and health checks

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Fastify API   │───▶│   BullMQ Queue  │───▶│  Job Processor  │
│                 │    │                 │    │                 │
│ • /health       │    │ • Redis Backend │    │ • Slack Client  │
│ • /metrics      │    │ • Job Scheduling│    │ • Puppeteer     │
│ • /jobs         │    │ • Retry Logic   │    │ • Supabase      │
│ • /execute-now  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

- **Node.js** 20+
- **Redis** (for job queue)
- **Supabase** (for data persistence)
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

### Google Cloud Run

```bash
# Set up variables
export TAG=v1.0.0
export IMAGE_NAME="us-central1-docker.pkg.dev/your-project/ms/slack-render:$TAG"

# Build and deploy
gcloud builds submit . --config cloudbuild.puppeteer.yaml --substitutions=_IMAGE_NAME="$IMAGE_NAME"
gcloud run deploy slack-render --image "$IMAGE_NAME" --region us-central1
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

### 4. Execute Now

**POST** `/execute-now`

Execute a job immediately without scheduling.

**Request Body:**
```json
{
  "scheduleId": "{REAL-UUID-SCHEDULE}",
  "payload": {
    "parentText": "Manual Execution Test",
    "parentBlocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Manual Execution*"
        }
      }
    ],
    "visualization": {
      "html": "<h2>Test Metrics</h2><table><thead><tr><th>Date</th><th>Spend</th><th>ROAS</th></tr></thead><tbody><tr><td>2025-09-12</td><td class='num'>24404</td><td class='num'>3.49</td></tr></tbody></table>",
      "fileName": "table.png",
      "alt": "Test Metrics"
    }
  }
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
curl -X POST "http://localhost:8080/execute-now" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "scheduleId": "{REAL-UUID-SCHEDULE}",
    "payload": {
      "parentText": "Manual Execution Test",
      "parentBlocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "*Manual Execution*"
          },
        },
      ],
      "visualization": {
        "html": "<h2>Test Metrics</h2><table><thead><tr><th>Date</th><th>Spend</th><th>ROAS</th></tr></thead><tbody><tr><td>2025-09-12</td><td class='num'>24404</td><td class='num'>3.49</td></tr></tbody></table>",
        "fileName": "table.png",
        "alt": "Test Metrics"
      },
      "messageId": "custom-message-id-123"
    }
  }'
```

**Note:** The `messageId` in the payload will override the schedule's default `message_id` for this specific execution.

**Example - Empty Payload (uses template):**
```json
{
  "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
  "payload": {}
}
```
This will automatically fetch and use the content from the `message_id` in the `slack_messages` table.

**Example - Custom Payload (overrides template):**
```json
{
  "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
  "payload": {
    "parentText": "Custom Message",
    "parentBlocks": [{"type": "section", "text": {"type": "mrkdwn", "text": "Hello!"}}]
  }
}
```
This will use the custom content instead of the template.

**Example - Template + HTML Visualization (Recommended):**
```json
{
  "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
  "payload": {
    "visualization": {
      "html": "<h2>MTD Metrics</h2><table><thead><tr><th>Date</th><th>Spend</th><th>ROAS</th></tr></thead><tbody><tr><td>2025-09-12</td><td class='num'>123456</td><td class='num'>3.50</td></tr></tbody></table>",
      "fileName": "table.png",
      "alt": "MTD Metrics"
    }
  }
}
```
**Result:** 
- **Main Message:** "Test KPI's" (extracted from template header)
- **Thread Image:** Your HTML table rendered as PNG

**Example - Complete Override:**
```json
{
  "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
  "payload": {
    "parentText": "Custom Daily Report",
    "parentBlocks": [
      {"type": "section", "text": {"type": "mrkdwn", "text": "*Custom content here*"}}
    ],
    "visualization": {
      "html": "<h2>Custom Chart</h2><div>Your custom visualization</div>",
      "fileName": "custom-chart.png"
    }
  }
}
```
**Result:** Completely ignores template, uses your custom text + renders your HTML as thread image.

---

## Template Flexibility Guide

### **Scenario 1: Template + Your Data (Most Common)**
```json
{
  "scheduleId": "your-schedule-id",
  "payload": {
    "visualization": {
      "html": "<h2>Your Data</h2><table>...</table>"
    }
  }
}
```
✅ **Uses:** Template header text + Your HTML as image

### **Scenario 2: Complete Custom Message**
```json
{
  "scheduleId": "your-schedule-id", 
  "payload": {
    "parentText": "My Custom Title",
    "parentBlocks": [{"type": "section", "text": {"type": "mrkdwn", "text": "Custom content"}}],
    "visualization": {"html": "<h2>Custom Chart</h2>"}
  }
}
```
✅ **Uses:** Your custom text + Your HTML as image (ignores template)

### **Scenario 3: Template Only**
```json
{
  "scheduleId": "your-schedule-id",
  "payload": {}
}
```
✅ **Uses:** Template as-is (removes problematic image blocks)

### **Key Benefits:**
- 🎯 **Override Control:** Payload always takes priority over template
- 📊 **Data Integration:** Seamlessly combine template styling with your data
- 🔄 **Fallback Safety:** Empty payloads gracefully use templates
- 🖼️ **Visual Flexibility:** HTML tables/charts render as high-quality images

---

## Data Models

### Schedule Payload Schema

```typescript
{
  scheduleId: string;        // UUID
  cron?: string;            // Cron expression (required for enabled jobs)
  timezone?: string;        // Default: "UTC"
  status?: "enabled" | "disabled";
  payload: {
    parentText?: string;     // Main message text
    parentBlocks?: Block[];  // Slack Block Kit blocks (optional)
    replyBlocks?: Block[][]; // Optional reply blocks
    visualization?: {
      imageUrl?: string;     // Direct image URL
      html?: string;         // HTML to render as image
      fileName?: string;     // Image filename
      alt?: string;          // Alt text for image
    };
    messageId?: string;      // Override schedule's message ID
  };
}
```

**Note:** Each schedule has a unique `message_id` that can be used to track and identify specific messages across the system. 

**Smart Content Loading & Template System:**

The system provides maximum flexibility for message templates:

**Payload Override Priority:**
- **Custom Payload:** If you provide `parentText` or `parentBlocks` in the payload, it completely overrides the template
- **Template Fallback:** If the payload is empty, it automatically uses the template from the `message_id` in `slack_messages` table

**Template Text Extraction:**
- **Header Blocks:** Automatically extracts text from `header` blocks (e.g., "Test KPI's")
- **Section Blocks:** Falls back to `section` blocks if no header is found
- **Smart Fallback:** Uses template message ID if no text blocks are found

**Visualization Templates:**
- **HTML Rendering:** Pass `visualization.html` in payload to render tables/charts as images
- **Template Integration:** Uses template's header text + renders your HTML as thread image
- **Placeholder Support:** Templates with `{{visualization_url}}` placeholders work seamlessly with HTML payloads

**Flexible Combinations:**
- **Template + HTML:** Use template text + your custom HTML visualization
- **Custom Everything:** Override template completely with your own content
- **Template Only:** Use template as-is when payload is empty

### Execute Now Schema

```typescript
{
  scheduleId: string;
  payload: {
    parentText?: string;
    parentBlocks?: Block[];  // Optional - will use template if empty
    replyBlocks?: Block[][];
    visualization?: {
      imageUrl?: string;
      html?: string;
      fileName?: string;
      alt?: string;
    };
    messageId?: string;      // Override schedule's message ID
  };
}
```

---

## Visualization Features

### HTML Rendering

The service can render HTML content to PNG images using Puppeteer:

```html
<h2>MTD Metrics</h2>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Spend</th>
      <th>ROAS</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>2025-09-12</td>
      <td class="num">24404</td>
      <td class="num">3.49</td>
    </tr>
  </tbody>
</table>
```

**CSS Classes Available:**
- `.num`: Right-aligned numbers with tabular numerals
- Automatic styling for tables, headers, and content

### Image Handling

1. **HTML Content**: Rendered to PNG using Puppeteer
2. **Direct URLs**: Validated and embedded as Slack blocks
3. **Thread Upload**: Images posted as replies to main message
4. **Fallback**: Graceful degradation if rendering fails

---

## 🔧 Configuration

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

Use the `/execute-now` endpoint to test your configurations:

```bash
# Test basic message
curl -X POST "http://localhost:8080/execute-now" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "scheduleId": "test-uuid",
    "payload": {
      "parentText": "Test Message",
      "parentBlocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "Hello World!"
          }
        }
      ]
    }
  }'
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

- **Queue Processing**: Asynchronous job processing
- **Image Caching**: Efficient image handling
- **Connection Pooling**: Redis and Supabase connections
- **Memory Management**: Proper cleanup of Puppeteer instances

### Scaling

- **Horizontal Scaling**: Multiple worker instances
- **Queue Distribution**: Redis-based job distribution
- **Resource Limits**: Configurable memory and CPU limits

---

## Development

### Project Structure

```
src/
├── api/           # Fastify API routes
├── clients/       # External service clients
├── config/        # Configuration management
├── data/          # Data access layer
├── jobs/          # Job processing logic
├── lib/           # Shared utilities
├── metrics/       # Prometheus metrics
├── queue/         # BullMQ configuration
└── utils/         # Helper functions
```

---

## Support

For issues and questions:
- Check the logs for detailed error information
- Verify your Slack bot token and scopes
- Ensure Redis is accessible
- Check Supabase connection

---

