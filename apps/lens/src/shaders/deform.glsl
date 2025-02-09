// Vertex shader
#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;
in vec3 normal;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
uniform float deformStrength;
uniform int deformType; // 0: Wave, 1: Twist, 2: Bulge, 3: Ripple
uniform vec3 deformCenter;
uniform vec3 deformAxis;

out vec2 vUv;
out vec3 vNormal;
out vec3 vPosition;

// Noise functions
float random(vec3 st) {
    return fract(sin(dot(st.xyz, vec3(12.9898,78.233,45.164))) * 43758.5453123);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    
    f = f * f * (3.0 - 2.0 * f);
    
    float n = mix(
        mix(
            mix(random(i), random(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(random(i + vec3(0.0, 1.0, 0.0)), random(i + vec3(1.0, 1.0, 0.0)), f.x),
            f.y
        ),
        mix(
            mix(random(i + vec3(0.0, 0.0, 1.0)), random(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(random(i + vec3(0.0, 1.0, 1.0)), random(i + vec3(1.0, 1.0, 1.0)), f.x),
            f.y
        ),
        f.z
    );
    
    return n;
}

// Wave deformation
vec3 waveDeform(vec3 pos) {
    float frequency = 5.0;
    float amplitude = deformStrength;
    float phase = time * 2.0;
    
    vec3 direction = normalize(deformAxis);
    float displacement = sin(dot(pos, direction) * frequency + phase) * amplitude;
    
    return pos + normal * displacement;
}

// Twist deformation
vec3 twistDeform(vec3 pos) {
    vec3 toCenter = pos - deformCenter;
    float distance = length(toCenter);
    float angle = distance * deformStrength + time;
    
    vec3 axis = normalize(deformAxis);
    float cosA = cos(angle);
    float sinA = sin(angle);
    
    mat3 rotMat = mat3(
        cosA + axis.x * axis.x * (1.0 - cosA),
        axis.x * axis.y * (1.0 - cosA) - axis.z * sinA,
        axis.x * axis.z * (1.0 - cosA) + axis.y * sinA,
        
        axis.y * axis.x * (1.0 - cosA) + axis.z * sinA,
        cosA + axis.y * axis.y * (1.0 - cosA),
        axis.y * axis.z * (1.0 - cosA) - axis.x * sinA,
        
        axis.z * axis.x * (1.0 - cosA) - axis.y * sinA,
        axis.z * axis.y * (1.0 - cosA) + axis.x * sinA,
        cosA + axis.z * axis.z * (1.0 - cosA)
    );
    
    return deformCenter + rotMat * toCenter;
}

// Bulge deformation
vec3 bulgeDeform(vec3 pos) {
    vec3 toCenter = pos - deformCenter;
    float distance = length(toCenter);
    float falloff = 1.0 - smoothstep(0.0, 1.0, distance);
    
    return pos + normal * deformStrength * falloff;
}

// Ripple deformation
vec3 rippleDeform(vec3 pos) {
    vec3 toCenter = pos - deformCenter;
    float distance = length(toCenter);
    float wave = sin(distance * 10.0 - time * 5.0) * 0.5 + 0.5;
    float displacement = wave * deformStrength * exp(-distance * 2.0);
    
    return pos + normal * displacement;
}

void main() {
    vec3 deformedPosition = position;
    
    // Apply deformation based on type
    switch(deformType) {
        case 0: // Wave
            deformedPosition = waveDeform(position);
            break;
        case 1: // Twist
            deformedPosition = twistDeform(position);
            break;
        case 2: // Bulge
            deformedPosition = bulgeDeform(position);
            break;
        case 3: // Ripple
            deformedPosition = rippleDeform(position);
            break;
    }
    
    // Calculate new normal
    vec3 tangent = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
    vec3 bitangent = normalize(cross(normal, tangent));
    float delta = 0.01;
    
    vec3 deltaPos1 = position + tangent * delta;
    vec3 deltaPos2 = position + bitangent * delta;
    
    vec3 deformedDeltaPos1;
    vec3 deformedDeltaPos2;
    
    switch(deformType) {
        case 0:
            deformedDeltaPos1 = waveDeform(deltaPos1);
            deformedDeltaPos2 = waveDeform(deltaPos2);
            break;
        case 1:
            deformedDeltaPos1 = twistDeform(deltaPos1);
            deformedDeltaPos2 = twistDeform(deltaPos2);
            break;
        case 2:
            deformedDeltaPos1 = bulgeDeform(deltaPos1);
            deformedDeltaPos2 = bulgeDeform(deltaPos2);
            break;
        case 3:
            deformedDeltaPos1 = rippleDeform(deltaPos1);
            deformedDeltaPos2 = rippleDeform(deltaPos2);
            break;
        default:
            deformedDeltaPos1 = deltaPos1;
            deformedDeltaPos2 = deltaPos2;
    }
    
    vec3 deformedTangent = normalize(deformedDeltaPos1 - deformedPosition);
    vec3 deformedBitangent = normalize(deformedDeltaPos2 - deformedPosition);
    vec3 deformedNormal = normalize(cross(deformedTangent, deformedBitangent));
    
    vUv = uv;
    vNormal = deformedNormal;
    vPosition = deformedPosition;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(deformedPosition, 1.0);
}

// Fragment shader
#version 300 es
precision highp float;

in vec2 vUv;
in vec3 vNormal;
in vec3 vPosition;

uniform vec3 lightPosition;
uniform vec3 lightColor;
uniform vec3 ambientColor;
uniform float shininess;
uniform sampler2D tDiffuse;

out vec4 fragColor;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(lightPosition - vPosition);
    
    // Diffuse lighting
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = lightColor * diff;
    
    // Specular lighting
    vec3 viewDir = normalize(-vPosition);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    vec3 specular = lightColor * spec;
    
    // Final color
    vec4 texColor = texture(tDiffuse, vUv);
    vec3 color = (ambientColor + diffuse) * texColor.rgb + specular;
    
    fragColor = vec4(color, texColor.a);
} 