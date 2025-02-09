// Vertex shader
#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment shader
#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tDiffuse;
uniform float smoothingStrength;
uniform float brightnessBoost;
uniform float saturationBoost;
uniform float skinToneCorrection;

// Gaussian blur kernel
const float kernel[9] = float[](
    0.0625, 0.125, 0.0625,
    0.125,  0.25,  0.125,
    0.0625, 0.125, 0.0625
);

// Skin tone detection
bool isSkinTone(vec3 color) {
    float r = color.r;
    float g = color.g;
    float b = color.b;
    
    return (r > 0.4 && g > 0.2 && b > 0.2) && // Basic skin tone range
           (r > g) && (r > b) && // Red channel dominance
           (abs(r - g) > 0.1); // Difference between red and green
}

// Color space conversions
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)),
                d / (q.x + e),
                q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 texelSize = 1.0 / vec2(textureSize(tDiffuse, 0));
    vec3 color = vec3(0.0);
    
    // Apply Gaussian blur
    for(int i = -1; i <= 1; i++) {
        for(int j = -1; j <= 1; j++) {
            vec2 offset = vec2(float(i), float(j)) * texelSize;
            vec3 sampleColor = texture(tDiffuse, vUv + offset * smoothingStrength).rgb;
            color += sampleColor * kernel[(i + 1) * 3 + (j + 1)];
        }
    }
    
    // Original color
    vec3 originalColor = texture(tDiffuse, vUv).rgb;
    
    // Detect skin tones
    float skinMask = isSkinTone(originalColor) ? 1.0 : 0.0;
    
    // Apply skin tone correction
    if(skinMask > 0.0) {
        // Convert to HSV for better control
        vec3 hsv = rgb2hsv(color);
        
        // Adjust saturation for natural look
        hsv.y *= mix(1.0, 0.8, skinToneCorrection);
        
        // Slightly warm up the skin tone
        hsv.x = mix(hsv.x, 0.05, skinToneCorrection * 0.3); // Shift hue towards warm tones
        
        // Convert back to RGB
        color = hsv2rgb(hsv);
    }
    
    // Blend smoothed and original color based on skin mask
    color = mix(originalColor, color, skinMask * smoothingStrength);
    
    // Apply brightness boost
    color = pow(color, vec3(1.0 / (1.0 + brightnessBoost)));
    
    // Apply saturation boost
    vec3 luminance = vec3(dot(color, vec3(0.299, 0.587, 0.114)));
    color = mix(luminance, color, 1.0 + saturationBoost);
    
    // Output final color
    fragColor = vec4(color, 1.0);
} 