# Scaling Playbook

## Overview

This playbook provides guidelines and procedures for scaling the TikTokToe platform both horizontally and vertically. It covers different scenarios and provides step-by-step instructions for each scaling operation.

## Table of Contents

1. [Monitoring Thresholds](#monitoring-thresholds)
2. [Automatic Scaling](#automatic-scaling)
3. [Manual Scaling](#manual-scaling)
4. [Emergency Scaling](#emergency-scaling)
5. [Database Scaling](#database-scaling)
6. [Cache Scaling](#cache-scaling)
7. [Storage Scaling](#storage-scaling)
8. [Network Scaling](#network-scaling)

## Monitoring Thresholds

### Application Servers
```yaml
cpu:
  warning: 70%
  critical: 85%
  duration: 5m

memory:
  warning: 75%
  critical: 90%
  duration: 5m

requests:
  warning: 1000/sec
  critical: 2000/sec
  duration: 1m
```

### Database
```yaml
connections:
  warning: 80%
  critical: 90%
  duration: 5m

cpu:
  warning: 70%
  critical: 85%
  duration: 5m

storage:
  warning: 75%
  critical: 90%
  duration: 15m
```

### Cache
```yaml
memory:
  warning: 75%
  critical: 90%
  duration: 5m

hits:
  warning: <85%
  critical: <70%
  duration: 5m
```

## Automatic Scaling

### Kubernetes HPA Configuration
```yaml
apiVersion: autoscaling/v2beta2
kind: HorizontalPodAutoscaler
metadata:
  name: tiktok-toe
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tiktok-toe
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 75
```

### Verification Steps
1. Check HPA status:
   ```bash
   kubectl get hpa
   kubectl describe hpa tiktok-toe
   ```

2. Monitor scaling events:
   ```bash
   kubectl get events --field-selector reason=Scaling
   ```

3. Verify pod health:
   ```bash
   kubectl get pods -l app=tiktok-toe
   ```

## Manual Scaling

### Application Scaling
1. Scale deployment:
   ```bash
   kubectl scale deployment tiktok-toe --replicas=5
   ```

2. Verify new replicas:
   ```bash
   kubectl get pods -l app=tiktok-toe
   ```

3. Monitor health:
   ```bash
   kubectl get pods -l app=tiktok-toe -w
   ```

### Database Scaling
1. Add read replica:
   ```bash
   kubectl apply -f k8s/database/read-replica.yaml
   ```

2. Verify replication:
   ```bash
   psql -c "SELECT * FROM pg_stat_replication;"
   ```

3. Update connection pool:
   ```bash
   kubectl edit configmap pgbouncer-config
   ```

## Emergency Scaling

### High Load Response
1. Immediate scale-up:
   ```bash
   kubectl scale deployment tiktok-toe --replicas=10
   ```

2. Enable circuit breakers:
   ```bash
   kubectl patch configmap app-config --patch '{"data":{"CIRCUIT_BREAKER_ENABLED":"true"}}'
   ```

3. Adjust rate limits:
   ```bash
   kubectl edit configmap nginx-config
   ```

### Recovery Steps
1. Monitor stabilization:
   ```bash
   watch kubectl top pods
   ```

2. Gradually reduce capacity:
   ```bash
   kubectl scale deployment tiktok-toe --replicas=7
   # Wait and monitor
   kubectl scale deployment tiktok-toe --replicas=5
   ```

3. Reset circuit breakers:
   ```bash
   kubectl patch configmap app-config --patch '{"data":{"CIRCUIT_BREAKER_ENABLED":"false"}}'
   ```

## Database Scaling

### Vertical Scaling
1. Backup current data:
   ```bash
   ./scripts/backup/backup.sh
   ```

2. Update resource requests:
   ```bash
   kubectl edit statefulset postgresql
   ```

3. Rolling restart:
   ```bash
   kubectl rollout restart statefulset postgresql
   ```

### Horizontal Scaling
1. Add read replica:
   ```bash
   kubectl apply -f k8s/database/read-replica.yaml
   ```

2. Configure replication:
   ```bash
   psql -c "ALTER SYSTEM SET max_wal_senders = 10;"
   psql -c "SELECT pg_reload_conf();"
   ```

3. Verify replication:
   ```bash
   psql -c "SELECT * FROM pg_stat_replication;"
   ```

## Cache Scaling

### Memory Allocation
1. Update Redis configuration:
   ```bash
   kubectl edit configmap redis-config
   ```

2. Apply changes:
   ```bash
   kubectl rollout restart statefulset redis
   ```

3. Verify new settings:
   ```bash
   redis-cli INFO memory
   ```

### Cluster Expansion
1. Add new node:
   ```bash
   kubectl apply -f k8s/cache/new-node.yaml
   ```

2. Rebalance slots:
   ```bash
   redis-cli --cluster rebalance redis-cluster:6379
   ```

3. Verify cluster health:
   ```bash
   redis-cli cluster info
   ```

## Storage Scaling

### Volume Expansion
1. Update PVC:
   ```bash
   kubectl patch pvc data-postgresql-0 -p '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'
   ```

2. Verify expansion:
   ```bash
   kubectl get pvc
   ```

### Archive Strategy
1. Identify old data:
   ```sql
   SELECT COUNT(*) FROM table_name WHERE created_at < NOW() - INTERVAL '90 days';
   ```

2. Archive to cold storage:
   ```bash
   ./scripts/archive/archive-data.sh
   ```

3. Verify archival:
   ```bash
   aws s3 ls s3://archive-bucket/
   ```

## Network Scaling

### Load Balancer
1. Update annotations:
   ```bash
   kubectl edit service tiktok-toe
   ```

2. Adjust timeout:
   ```yaml
   service.beta.kubernetes.io/aws-load-balancer-connection-idle-timeout: "60"
   ```

### CDN Configuration
1. Update origins:
   ```bash
   aws cloudfront update-distribution --id DISTID --distribution-config file://cdn-config.json
   ```

2. Invalidate cache:
   ```bash
   aws cloudfront create-invalidation --distribution-id DISTID --paths "/*"
   ```

## Post-Scaling Verification

### Health Checks
1. Application health:
   ```bash
   curl https://api.tiktok-toe.com/health
   ```

2. Database connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

3. Cache hit rate:
   ```bash
   redis-cli INFO stats | grep hit_rate
   ```

### Performance Metrics
1. Response times:
   ```bash
   curl -w "%{time_total}\n" -o /dev/null -s https://api.tiktok-toe.com/health
   ```

2. Error rates:
   ```bash
   kubectl logs -l app=tiktok-toe --tail=1000 | grep ERROR | wc -l
   ```

### Rollback Procedures
1. Application:
   ```bash
   kubectl rollout undo deployment tiktok-toe
   ```

2. Database:
   ```bash
   kubectl rollout undo statefulset postgresql
   ```

3. Cache:
   ```bash
   kubectl rollout undo statefulset redis
   ```
