// Vertex shader
#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;
in vec3 velocity;
in float life;
in float size;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
uniform float deltaTime;
uniform vec3 gravity;
uniform float turbulence;
uniform int effectType; // 0: Sparkles, 1: Smoke, 2: Fire, 3: Snow

out vec2 vUv;
out float vLife;
out vec3 vVelocity;

// Noise functions
float random(vec3 st) {
    return fract(sin(dot(st.xyz, vec3(12.9898,78.233,45.164))) * 43758.5453123);
}

vec3 curl(vec3 p) {
    const float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    
    vec3 p_x0 = vec3(random(p - dx), random(p), random(p + dx));
    vec3 p_x1 = vec3(random(p + dx), random(p), random(p - dx));
    vec3 p_y0 = vec3(random(p - dy), random(p), random(p + dy));
    vec3 p_y1 = vec3(random(p + dy), random(p), random(p - dy));
    vec3 p_z0 = vec3(random(p - dz), random(p), random(p + dz));
    vec3 p_z1 = vec3(random(p + dz), random(p), random(p - dz));
    
    float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
    float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
    float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
    
    return normalize(vec3(x, y, z));
}

void main() {
    vUv = uv;
    vLife = life - deltaTime;
    
    // Base position
    vec3 pos = position;
    vec3 vel = velocity;
    
    // Apply effect-specific behavior
    switch(effectType) {
        case 0: // Sparkles
            // Add spiral motion
            float angle = time * 2.0 + random(position) * 6.28;
            vec3 spiral = vec3(cos(angle), sin(angle), 0.0) * size;
            pos += spiral;
            // Add upward drift
            vel.y += 0.5 * deltaTime;
            break;
            
        case 1: // Smoke
            // Add turbulent motion
            vec3 noise = curl(pos * 0.1 + time * 0.1) * turbulence;
            vel += noise * deltaTime;
            // Add buoyancy
            vel.y += (1.0 - life) * 0.5 * deltaTime;
            break;
            
        case 2: // Fire
            // Add flickering motion
            float flicker = sin(time * 10.0 + random(position) * 6.28) * 0.2;
            pos.x += flicker * size;
            // Add upward acceleration
            vel.y += (1.0 - life) * 2.0 * deltaTime;
            break;
            
        case 3: // Snow
            // Add swirling motion
            vec3 swirl = curl(pos * 0.2 + time * 0.05) * turbulence;
            vel += swirl * deltaTime;
            // Add gravity
            vel.y -= 0.5 * deltaTime;
            break;
    }
    
    // Apply physics
    vel += gravity * deltaTime;
    pos += vel * deltaTime;
    
    // Update velocity
    vVelocity = vel;
    
    // Calculate size attenuation based on life
    float sizeScale = mix(0.0, size, smoothstep(0.0, 0.1, life) * smoothstep(0.0, 0.1, vLife));
    
    // Billboard the particle to face camera
    vec3 cameraRight = vec3(modelViewMatrix[0].x, modelViewMatrix[1].x, modelViewMatrix[2].x);
    vec3 cameraUp = vec3(modelViewMatrix[0].y, modelViewMatrix[1].y, modelViewMatrix[2].y);
    
    pos += (uv.x - 0.5) * cameraRight * sizeScale + (uv.y - 0.5) * cameraUp * sizeScale;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}

// Fragment shader
#version 300 es
precision highp float;

in vec2 vUv;
in float vLife;
in vec3 vVelocity;

uniform sampler2D particleTexture;
uniform vec3 particleColor;
uniform int effectType;
uniform float time;

out vec4 fragColor;

// Color gradients
vec3 fireGradient(float t) {
    vec3 a = vec3(1.0, 0.0, 0.0);    // Red
    vec3 b = vec3(1.0, 0.5, 0.0);    // Orange
    vec3 c = vec3(1.0, 0.8, 0.0);    // Yellow
    vec3 d = vec3(1.0, 1.0, 1.0);    // White
    
    if(t < 0.33) {
        return mix(a, b, t * 3.0);
    } else if(t < 0.66) {
        return mix(b, c, (t - 0.33) * 3.0);
    } else {
        return mix(c, d, (t - 0.66) * 3.0);
    }
}

vec3 smokeGradient(float t) {
    vec3 a = vec3(0.2);              // Dark gray
    vec3 b = vec3(0.5);              // Medium gray
    vec3 c = vec3(0.8);              // Light gray
    
    if(t < 0.5) {
        return mix(a, b, t * 2.0);
    } else {
        return mix(b, c, (t - 0.5) * 2.0);
    }
}

void main() {
    // Calculate base color from texture
    vec4 texColor = texture(particleTexture, vUv);
    
    // Calculate radial gradient for particle
    float dist = length(vUv - 0.5);
    float radialFalloff = 1.0 - smoothstep(0.0, 0.5, dist);
    
    // Calculate life factor
    float lifeFactor = smoothstep(0.0, 0.1, vLife);
    
    // Effect-specific color calculations
    vec3 color;
    float alpha;
    
    switch(effectType) {
        case 0: // Sparkles
            // Sparkle effect with time-based twinkling
            float twinkle = sin(time * 10.0 + random(vec3(vUv, 0.0)) * 6.28) * 0.5 + 0.5;
            color = particleColor * (1.0 + twinkle * 0.5);
            alpha = texColor.a * radialFalloff * lifeFactor;
            break;
            
        case 1: // Smoke
            // Smoke effect with gradient and turbulence
            float turbulence = random(vec3(vUv * 10.0, time)) * 0.1;
            color = smokeGradient(vLife + turbulence);
            alpha = texColor.a * radialFalloff * lifeFactor * 0.8;
            break;
            
        case 2: // Fire
            // Fire effect with gradient based on velocity and life
            float intensity = length(vVelocity) * 0.5;
            color = fireGradient(vLife + intensity);
            alpha = texColor.a * radialFalloff * lifeFactor;
            break;
            
        case 3: // Snow
            // Snow effect with subtle color variation
            float shimmer = sin(time * 2.0 + random(vec3(vUv, 0.0)) * 6.28) * 0.1 + 0.9;
            color = vec3(shimmer);
            alpha = texColor.a * radialFalloff * lifeFactor * 0.9;
            break;
            
        default:
            color = particleColor;
            alpha = texColor.a * radialFalloff * lifeFactor;
    }
    
    // Output final color
    fragColor = vec4(color, alpha);
} 