# API Examples & Postman Collection

This document provides comprehensive examples for testing the Slack Bot Microservice API.

## 🔗 Base URL
```
https://slack-render-83594678211.us-central1.run.app
```

## Authentication
All endpoints (except `/health` and `/metrics`) require Bearer token authentication:

```bash
Authorization: Bearer <your-jwt-token>
```

---

## Complete API Examples

### 1. Health Check

**Endpoint:** `GET /health`

**Description:** Check if the service is running

**cURL:**
```bash
curl -X GET "https://slack-render-83594678211.us-central1.run.app/health"
```

**Postman:**
- Method: `GET`
- URL: `https://slack-render-83594678211.us-central1.run.app/health`
- Headers: None required

**Expected Response:**
```json
{
  "ok": true
}
```

---

### 2. Metrics

**Endpoint:** `GET /metrics`

**Description:** Get Prometheus metrics for monitoring

**cURL:**
```bash
curl -X GET "https://slack-render-83594678211.us-central1.run.app/metrics"
```

**Postman:**
- Method: `GET`
- URL: `https://slack-render-83594678211.us-central1.run.app/metrics`
- Headers: None required

**Expected Response:**
```
# HELP nodejs_heap_size_total_bytes Process heap size from node.js in bytes.
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes 12345678
# HELP nodejs_heap_size_used_bytes Process heap size used from node.js in bytes.
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes 8765432
...
```

---

### 3. Schedule Job - Basic Message

**Endpoint:** `POST /jobs`

**Description:** Create a scheduled job with basic text message

**cURL:**
```bash
curl -X POST "https://slack-render-83594678211.us-central1.run.app/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
    "cron": "0 9 * * 1-5",
    "timezone": "America/New_York",
    "status": "enabled",
    "payload": {
      "parentText": "Daily Standup Reminder",
      "parentBlocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "🌅 *Good morning team!* Time for our daily standup at 9:30 AM."
          }
        }
      ]
    }
  }'
```

**Postman:**
- Method: `POST`
- URL: `https://slack-render-83594678211.us-central1.run.app/jobs`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-jwt-token>`
- Body (raw JSON):
```json
{
  "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
  "cron": "0 9 * * 1-5",
  "timezone": "America/New_York",
  "status": "enabled",
  "payload": {
    "parentText": "Daily Standup Reminder",
    "parentBlocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "🌅 *Good morning team!* Time for our daily standup at 9:30 AM."
        }
      }
    ]
  }
}
```

**Expected Response:**
```json
{
  "ok": true,
  "job": {
    "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
    "cron": "0 9 * * 1-5",
    "timezone": "America/New_York"
  }
}
```

---

### 4. Schedule Job - With HTML Visualization

**Endpoint:** `POST /jobs`

**Description:** Create a scheduled job with HTML-to-image rendering

**cURL:**
```bash
curl -X POST "https://slack-render-83594678211.us-central1.run.app/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "scheduleId": "bde3b500-79cc-5b6f-0c73-b282c8c98698",
    "cron": "0 8 * * 1",
    "timezone": "America/New_York",
    "status": "enabled",
    "payload": {
      "parentText": "Weekly Performance Report",
      "parentBlocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "📊 *Weekly Performance Report* - Generated automatically every Monday"
          }
        }
      ],
      "visualization": {
        "html": "<h2>Weekly Metrics</h2><table><thead><tr><th>Metric</th><th>This Week</th><th>Last Week</th><th>Change</th></tr></thead><tbody><tr><td>Revenue</td><td class=\"num\">$25,000</td><td class=\"num\">$22,000</td><td class=\"num\">+13.6%</td></tr><tr><td>Users</td><td class=\"num\">1,250</td><td class=\"num\">1,100</td><td class=\"num\">+13.6%</td></tr><tr><td>Conversion</td><td class=\"num\">3.2%</td><td class=\"num\">2.8%</td><td class=\"num\">+14.3%</td></tr></tbody></table>",
        "fileName": "weekly-metrics.png",
        "alt": "Weekly Performance Metrics"
      }
    }
  }'
```

**Postman:**
- Method: `POST`
- URL: `https://slack-render-83594678211.us-central1.run.app/jobs`
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <your-jwt-token>`
- Body (raw JSON):
```json
{
  "scheduleId": "bde3b500-79cc-5b6f-0c73-b282c8c98698",
  "cron": "0 8 * * 1",
  "timezone": "America/New_York",
  "status": "enabled",
  "payload": {
    "parentText": "Weekly Performance Report",
    "parentBlocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "📊 *Weekly Performance Report* - Generated automatically every Monday"
        }
      }
    ],
    "visualization": {
      "html": "<h2>Weekly Metrics</h2><table><thead><tr><th>Metric</th><th>This Week</th><th>Last Week</th><th>Change</th></tr></thead><tbody><tr><td>Revenue</td><td class=\"num\">$25,000</td><td class=\"num\">$22,000</td><td class=\"num\">+13.6%</td></tr><tr><td>Users</td><td class=\"num\">1,250</td><td class=\"num\">1,100</td><td class=\"num\">+13.6%</td></tr><tr><td>Conversion</td><td class=\"num\">3.2%</td><td class=\"num\">2.8%</td><td class=\"num\">+14.3%</td></tr></tbody></table>",
      "fileName": "weekly-metrics.png",
      "alt": "Weekly Performance Metrics"
    }
  }
}
```

---

### 5. Schedule Job - With Reply Blocks

**Endpoint:** `POST /jobs`

**Description:** Create a scheduled job with main message and reply threads

**cURL:**
```bash
curl -X POST "https://slack-render-83594678211.us-central1.run.app/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "scheduleId": "cde4c600-8add-6c7g-1d84-c393d9d09709",
    "cron": "0 17 * * 5",
    "timezone": "America/New_York",
    "status": "enabled",
    "payload": {
      "parentText": "Friday Wrap-up",
      "parentBlocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "🎉 *Happy Friday!* Here is your weekly summary:"
          }
        }
      ],
      "replyBlocks": [
        [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "📈 *This Week Highlights:*\n• Completed 15 tasks\n• 3 new features deployed\n• Team velocity: 85%"
            }
          }
        ],
        [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "🎯 *Next Week Focus:*\n• Bug fixes priority\n• Performance optimization\n• Code review sessions"
            }
          }
        ]
      ]
    }
  }'
```

---

### 6. Disable Scheduled Job

**Endpoint:** `POST /jobs`

**Description:** Disable/remove a scheduled job

**cURL:**
```bash
curl -X POST "https://slack-render-83594678211.us-central1.run.app/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
    "status": "disabled"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "removed": 1
}
```

---

### 7. Execute Now - Simple Message

**Endpoint:** `POST /execute-now`

**Description:** Execute a job immediately without scheduling

**cURL:**
```bash
curl -X POST "https://slack-render-83594678211.us-central1.run.app/execute-now" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
    "payload": {
      "parentText": "Test Message",
      "parentBlocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "🚀 *Manual Test Execution* - This message was triggered manually!"
          }
        }
      ]
    }
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "id": "12345"
}
```

---

### 8. Execute Now - With HTML Visualization

**Endpoint:** `POST /execute-now`

**Description:** Execute a job with HTML-to-image rendering immediately

**cURL:**
```bash
curl -X POST "https://slack-render-83594678211.us-central1.run.app/execute-now" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "scheduleId": "ade2a400-68bb-4a5e-9b62-a171b7b87587",
    "payload": {
      "parentText": "Render mode test",
      "parentBlocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "METRICS"
          }
        }
      ],
      "visualization": {
        "html": "<h2>MTD Metrics</h2><table><thead><tr><th>Date</th><th>Spend</th><th>ROAS</th></tr></thead><tbody><tr><td>2025-09-12</td><td class=\"num\">24404</td><td class=\"num\">3.49</td></tr></tbody></table>",
        "fileName": "table.png",
        "alt": "MTD Metrics"
      }
    }
  }'
```

---

## HTML Visualization Examples

### Basic Table
```html
<h2>Sales Report</h2>
<table>
  <thead>
    <tr>
      <th>Product</th>
      <th>Sales</th>
      <th>Revenue</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Product A</td>
      <td class="num">150</td>
      <td class="num">$7,500</td>
    </tr>
    <tr>
      <td>Product B</td>
      <td class="num">200</td>
      <td class="num">$12,000</td>
    </tr>
  </tbody>
</table>
```

### Complex Dashboard
```html
<h2>Monthly Dashboard</h2>
<div style="display: flex; gap: 20px;">
  <div style="flex: 1;">
    <h3>Revenue</h3>
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th>Amount</th>
          <th>Growth</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Jan</td>
          <td class="num">$50,000</td>
          <td class="num">+5%</td>
        </tr>
        <tr>
          <td>Feb</td>
          <td class="num">$55,000</td>
          <td class="num">+10%</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div style="flex: 1;">
    <h3>Users</h3>
    <table>
      <thead>
        <tr>
          <th>Segment</th>
          <th>Count</th>
          <th>Active</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Free</td>
          <td class="num">1,200</td>
          <td class="num">800</td>
        </tr>
        <tr>
          <td>Premium</td>
          <td class="num">300</td>
          <td class="num">280</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## Cron Expression Examples

| Expression | Description |
|------------|-------------|
| `"0 9 * * 1-5"` | Weekdays at 9 AM |
| `"0 0 1 * *"` | First day of every month |
| `"*/15 * * * *"` | Every 15 minutes |
| `"0 8 * * 1"` | Every Monday at 8 AM |
| `"0 17 * * 5"` | Every Friday at 5 PM |
| `"0 12 1,15 * *"` | 1st and 15th of every month at noon |
| `"0 9 * * 0"` | Every Sunday at 9 AM |

---

## Timezone Examples

| Timezone | Description |
|----------|-------------|
| `"America/New_York"` | Eastern Time |
| `"America/Chicago"` | Central Time |
| `"America/Denver"` | Mountain Time |
| `"America/Los_Angeles"` | Pacific Time |
| `"Europe/London"` | GMT/BST |
| `"Europe/Paris"` | CET/CEST |
| `"Asia/Tokyo"` | JST |
| `"UTC"` | Coordinated Universal Time |

---

## Error Examples

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 400 Bad Request - Missing Cron
```json
{
  "error": "cron is required when enabling a job"
}
```

### 400 Bad Request - Invalid UUID
```json
{
  "error": "Invalid scheduleId format"
}
```

---

## Postman Collection

To import into Postman, create a new collection with these requests:

### Environment Variables
Create a Postman environment with:
- `base_url`: `https://slack-render-83594678211.us-central1.run.app`
- `jwt_token`: `example.example-token-here`

### Collection Structure
```
Slack Bot Microservice
├── Health Check
├── Metrics
├── Schedule Jobs
│   ├── Basic Message
│   ├── With HTML Visualization
│   ├── With Reply Blocks
│   └── Disable Job
└── Execute Now
    ├── Simple Message
    └── With HTML Visualization
```

---

## Testing Tips

1. **Start Simple**: Test with basic text messages first
2. **Validate HTML**: Ensure your HTML is valid before testing
3. **Check Permissions**: Verify your Slack bot has required scopes
4. **Monitor Logs**: Check service logs for detailed error information
5. **Test Timezones**: Verify cron expressions work in your timezone
6. **Image Sizes**: Keep HTML content reasonable for image rendering

---

## Troubleshooting

### Common Issues

**Job not executing:**
- Check cron expression format
- Verify timezone is correct
- Ensure job status is "enabled"

**Images not appearing:**
- Verify HTML is valid
- Check Puppeteer configuration
- Review service logs for rendering errors

**Authentication errors:**
- Verify JWT token is valid
- Check token expiration
- Ensure proper Bearer format

**Slack API errors:**
- Verify bot token permissions
- Check channel access
- Review Slack API rate limits
