from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentation
from opentelemetry.instrumentation.redis import RedisInstrumentation
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentation
from opentelemetry.instrumentation.elasticsearch import ElasticsearchInstrumentation
from opentelemetry.instrumentation.requests import RequestsInstrumentation
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes
import os

def setup_tracing():
    """Initialize OpenTelemetry tracing with all necessary instrumentations"""
    
    # Create a resource identifying our service
    resource = Resource.create({
        ResourceAttributes.SERVICE_NAME: "tiktok-toe-api",
        ResourceAttributes.SERVICE_VERSION: "1.0.0",
        ResourceAttributes.DEPLOYMENT_ENVIRONMENT: os.getenv("ENVIRONMENT", "development"),
    })

    # Initialize TracerProvider
    trace.set_tracer_provider(TracerProvider(resource=resource))

    # Create OTLP exporter
    otlp_exporter = OTLPSpanExporter(
        endpoint="http://otel-collector:4317",
        insecure=True
    )

    # Create and register BatchSpanProcessor
    span_processor = BatchSpanProcessor(otlp_exporter)
    trace.get_tracer_provider().add_span_processor(span_processor)

    # Initialize automatic instrumentation
    FastAPIInstrumentation().instrument()
    RedisInstrumentation().instrument()
    SQLAlchemyInstrumentation().instrument()
    ElasticsearchInstrumentation().instrument()
    RequestsInstrumentation().instrument()

def create_custom_span(name: str, attributes: dict = None):
    """Create a custom span for manual instrumentation"""
    tracer = trace.get_tracer(__name__)
    if attributes is None:
        attributes = {}
    return tracer.start_span(name, attributes=attributes)

def add_span_attributes(span, attributes: dict):
    """Add attributes to an existing span"""
    for key, value in attributes.items():
        span.set_attribute(key, value)

def record_exception(span, exception: Exception, attributes: dict = None):
    """Record an exception in the current span"""
    if attributes is None:
        attributes = {}
    span.record_exception(exception, attributes=attributes)

# Context manager for custom spans
class TracingSpan:
    def __init__(self, name: str, attributes: dict = None):
        self.name = name
        self.attributes = attributes or {}
        self.span = None

    def __enter__(self):
        self.span = create_custom_span(self.name, self.attributes)
        return self.span

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_val:
            record_exception(self.span, exc_val)
        self.span.end()
