# Incident Response Runbook

## Overview
This runbook provides step-by-step procedures for responding to common incidents in the TikTokToe platform.

## Incident Severity Levels

### SEV1 (Critical) - Service Outage
- Response Time: Immediate (< 15 minutes)
- Escalation: Immediate to on-call engineer and team lead
- Examples:
  - Complete service unavailability
  - Data loss or corruption
  - Security breach

### SEV2 (High) - Service Degradation
- Response Time: < 30 minutes
- Escalation: On-call engineer, escalate if not resolved in 1 hour
- Examples:
  - Significant performance degradation
  - Partial feature unavailability
  - Authentication issues

### SEV3 (Medium) - Minor Issues
- Response Time: < 2 hours
- Escalation: Handle during business hours
- Examples:
  - Non-critical bugs
  - Minor UI/UX issues
  - Warning conditions

## Common Incidents and Resolution Steps

### 1. High Error Rate Alert

#### Initial Assessment
1. Check Kibana dashboard for error patterns
2. Review recent deployments
3. Check external service dependencies
4. Analyze affected user segments

#### Resolution Steps
1. **If deployment-related:**
   ```bash
   # Roll back to last known good version
   kubectl rollout undo deployment/tiktok-toe
   
   # Verify rollback
   kubectl rollout status deployment/tiktok-toe
   ```

2. **If database-related:**
   ```bash
   # Check database connections
   kubectl exec -it $(kubectl get pod -l app=db-primary -o jsonpath='{.items[0].metadata.name}') -- psql -U postgres -c '\conninfo'
   
   # Check active queries
   kubectl exec -it $(kubectl get pod -l app=db-primary -o jsonpath='{.items[0].metadata.name}') -- psql -U postgres -c 'SELECT * FROM pg_stat_activity;'
   ```

3. **If memory-related:**
   ```bash
   # Check memory usage
   kubectl top pods
   
   # Scale up if needed
   kubectl scale deployment tiktok-toe --replicas=5
   ```

### 2. High Latency Alert

#### Initial Assessment
1. Check APM for slow transactions
2. Review database query performance
3. Check cache hit rates
4. Monitor network metrics

#### Resolution Steps
1. **Check slow queries:**
   ```bash
   # Connect to database
   psql -U postgres
   
   # Find slow queries
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
   FROM pg_stat_activity 
   WHERE state = 'active' 
   ORDER BY duration DESC;
   ```

2. **Clear cache if needed:**
   ```bash
   # Connect to Redis
   redis-cli
   
   # Clear specific cache
   DEL "cache:slow_key"
   
   # Monitor cache hits
   INFO stats
   ```

3. **Scale services:**
   ```bash
   # Scale application
   kubectl scale deployment tiktok-toe --replicas=5
   
   # Scale database connections
   kubectl edit configmap pgbouncer-config
   ```

### 3. Security Incident

#### Initial Assessment
1. Review security logs
2. Check authentication logs
3. Monitor API rate limiting
4. Review network traffic

#### Resolution Steps
1. **Block suspicious IPs:**
   ```bash
   # Add to nginx deny list
   kubectl edit configmap nginx-config
   
   # Reload nginx
   kubectl rollout restart deployment/nginx
   ```

2. **Reset compromised tokens:**
   ```bash
   # Invalidate all tokens
   kubectl exec -it $(kubectl get pod -l app=redis -o jsonpath='{.items[0].metadata.name}') -- redis-cli FLUSHDB
   
   # Rotate JWT secret
   kubectl create secret generic jwt-secret --from-literal=JWT_SECRET=$(openssl rand -base64 32)
   ```

3. **Enable enhanced logging:**
   ```bash
   # Update log level
   kubectl set env deployment/tiktok-toe LOG_LEVEL=debug
   
   # Enable audit logging
   kubectl patch configmap app-config --patch '{"data":{"AUDIT_LOGGING":"true"}}'
   ```

## Recovery Procedures

### Database Recovery
```bash
# Check backup status
aws s3 ls s3://backup-bucket/postgres/

# Restore from backup
pg_restore -h localhost -U postgres -d tiktok_toe latest.dump

# Verify data integrity
psql -U postgres -d tiktok_toe -c 'SELECT COUNT(*) FROM users;'
```

### Cache Recovery
```bash
# Clear corrupted cache
redis-cli FLUSHALL

# Warm up cache
curl -X POST http://localhost:3000/api/cache/warm

# Monitor cache metrics
redis-cli INFO stats
```

### Service Recovery
```bash
# Restart all pods
kubectl rollout restart deployment tiktok-toe

# Verify health
kubectl get pods
kubectl logs -l app=tiktok-toe --tail=100

# Check endpoints
curl -I http://localhost:3000/health
```

## Post-Incident Procedures

1. **Create Incident Report**
   - Incident timeline
   - Root cause analysis
   - Resolution steps taken
   - Preventive measures

2. **Update Documentation**
   - Add new scenarios
   - Update procedures
   - Document lessons learned

3. **Implement Preventive Measures**
   - Add monitoring
   - Update alerts
   - Improve automation

## Communication Templates

### SEV1 Incident
```
[SEV1] TikTokToe Service Disruption
Impact: Complete service outage
Status: Investigation in progress
Actions: Team engaged, initial assessment underway
ETA: Updates every 15 minutes
```

### SEV2 Incident
```
[SEV2] TikTokToe Performance Degradation
Impact: Increased latency in API responses
Status: Root cause identified
Actions: Implementing fix
ETA: Resolution expected within 1 hour
```

### Resolution Notice
```
[RESOLVED] TikTokToe Incident
Duration: XX hours
Impact: Description of impact
Resolution: Steps taken to resolve
Prevention: Measures to prevent recurrence
```

## Contact Information

### Primary Contacts
- On-call Engineer: +1-XXX-XXX-XXXX
- Team Lead: +1-XXX-XXX-XXXX
- Security Team: security@company.com

### Escalation Path
1. On-call Engineer
2. Team Lead
3. Engineering Manager
4. CTO

## Useful Commands Reference

### Kubernetes
```bash
# Get pod logs
kubectl logs -l app=tiktok-toe --tail=100

# Describe pod
kubectl describe pod $(kubectl get pod -l app=tiktok-toe -o jsonpath='{.items[0].metadata.name}')

# Port forward for debugging
kubectl port-forward service/tiktok-toe 3000:3000
```

### Database
```bash
# Check connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Kill long queries
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"
```

### Monitoring
```bash
# Check metrics
curl localhost:9090/metrics

# Query Prometheus
curl -G 'http://localhost:9090/api/v1/query' --data-urlencode 'query=rate(http_requests_total[5m])'
```
