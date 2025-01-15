# Performance Baselines

## Response Time Baselines

### API Endpoints
```yaml
user_endpoints:
  get_profile:
    p50: 50ms
    p90: 100ms
    p99: 200ms
  update_profile:
    p50: 100ms
    p90: 200ms
    p99: 400ms

content_endpoints:
  get_feed:
    p50: 100ms
    p90: 200ms
    p99: 400ms
  create_post:
    p50: 200ms
    p90: 400ms
    p99: 800ms
  upload_media:
    p50: 500ms
    p90: 1000ms
    p99: 2000ms

interaction_endpoints:
  like_post:
    p50: 50ms
    p90: 100ms
    p99: 200ms
  comment_post:
    p50: 100ms
    p90: 200ms
    p99: 400ms
```

## Resource Utilization Baselines

### Application Servers
```yaml
cpu:
  idle: 20-30%
  normal: 40-60%
  peak: 70-80%
  critical: >85%

memory:
  idle: 30-40%
  normal: 50-70%
  peak: 75-85%
  critical: >90%

network:
  idle: 100MB/s
  normal: 300MB/s
  peak: 500MB/s
  critical: >700MB/s
```

### Database
```yaml
cpu:
  idle: 20-30%
  normal: 40-60%
  peak: 70-80%
  critical: >85%

memory:
  idle: 40-50%
  normal: 60-75%
  peak: 80-90%
  critical: >95%

connections:
  idle: 100-200
  normal: 200-300
  peak: 300-400
  critical: >450

iops:
  idle: 1000/s
  normal: 2000/s
  peak: 3000/s
  critical: >4000/s
```

### Cache
```yaml
memory:
  idle: 30-40%
  normal: 50-70%
  peak: 75-85%
  critical: >90%

connections:
  idle: 1000-2000
  normal: 2000-3000
  peak: 3000-4000
  critical: >4500

hit_rate:
  excellent: >95%
  good: 85-95%
  fair: 70-85%
  poor: <70%
```

## Error Rate Baselines

### System Errors
```yaml
http_5xx:
  normal: <0.1%
  warning: 0.1-0.5%
  critical: >0.5%

http_4xx:
  normal: <1%
  warning: 1-5%
  critical: >5%

timeouts:
  normal: <0.1%
  warning: 0.1-0.5%
  critical: >0.5%
```

### Application Errors
```yaml
validation_errors:
  normal: <1%
  warning: 1-3%
  critical: >3%

business_logic_errors:
  normal: <0.5%
  warning: 0.5-2%
  critical: >2%

integration_errors:
  normal: <0.1%
  warning: 0.1-0.5%
  critical: >0.5%
```

## Throughput Baselines

### Request Rates
```yaml
api_requests:
  idle: 100/s
  normal: 500/s
  peak: 1000/s
  max: 2000/s

media_uploads:
  idle: 10/s
  normal: 50/s
  peak: 100/s
  max: 200/s

database_queries:
  idle: 1000/s
  normal: 5000/s
  peak: 10000/s
  max: 15000/s
```

### Data Transfer
```yaml
inbound_traffic:
  idle: 50MB/s
  normal: 200MB/s
  peak: 400MB/s
  max: 600MB/s

outbound_traffic:
  idle: 100MB/s
  normal: 400MB/s
  peak: 800MB/s
  max: 1200MB/s

cdn_traffic:
  idle: 500MB/s
  normal: 2GB/s
  peak: 4GB/s
  max: 6GB/s
```

## Availability Baselines

### Service Availability
```yaml
api_services:
  target: 99.99%
  warning: <99.9%
  critical: <99%

database:
  target: 99.999%
  warning: <99.99%
  critical: <99.9%

cache:
  target: 99.99%
  warning: <99.9%
  critical: <99%
```

### Recovery Time
```yaml
service_restart:
  target: <10s
  warning: 10-30s
  critical: >30s

failover:
  target: <30s
  warning: 30-60s
  critical: >60s

full_recovery:
  target: <5m
  warning: 5-15m
  critical: >15m
```

## Load Testing Baselines

### Concurrent Users
```yaml
normal_load:
  users: 1000
  ramp_up: 5m
  duration: 30m
  error_rate: <0.1%

peak_load:
  users: 5000
  ramp_up: 10m
  duration: 30m
  error_rate: <0.5%

stress_test:
  users: 10000
  ramp_up: 15m
  duration: 30m
  error_rate: <1%
```

### Response Times Under Load
```yaml
normal_load:
  p50: within_baseline
  p90: within_baseline * 1.2
  p99: within_baseline * 1.5

peak_load:
  p50: within_baseline * 1.2
  p90: within_baseline * 1.5
  p99: within_baseline * 2

stress_test:
  p50: within_baseline * 1.5
  p90: within_baseline * 2
  p99: within_baseline * 3
```

## Resource Scaling Baselines

### Horizontal Scaling
```yaml
trigger_up:
  cpu: >70% for 5m
  memory: >80% for 5m
  requests: >80% capacity for 5m

trigger_down:
  cpu: <30% for 15m
  memory: <40% for 15m
  requests: <40% capacity for 15m

cooldown:
  scale_up: 5m
  scale_down: 15m
```

### Vertical Scaling
```yaml
trigger_up:
  cpu: >85% for 5m
  memory: >90% for 5m
  disk: >85% for 15m

trigger_down:
  cpu: <20% for 30m
  memory: <30% for 30m
  disk: <30% for 1h

cooldown:
  scale_up: 1h
  scale_down: 24h
```

## Monitoring and Alerting

### Metrics Collection
```yaml
system_metrics:
  collection_interval: 10s
  retention_period: 30d
  resolution: 1m

application_metrics:
  collection_interval: 30s
  retention_period: 90d
  resolution: 5m

business_metrics:
  collection_interval: 5m
  retention_period: 365d
  resolution: 1h
```

### Alert Thresholds
```yaml
urgent_alerts:
  response_time: >2s for 5m
  error_rate: >1% for 5m
  availability: <99% for 5m

warning_alerts:
  response_time: >1s for 15m
  error_rate: >0.5% for 15m
  availability: <99.9% for 15m

info_alerts:
  response_time: >500ms for 30m
  error_rate: >0.1% for 30m
  availability: <99.99% for 30m
```
