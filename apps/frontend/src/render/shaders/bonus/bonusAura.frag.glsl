uniform vec3 uEmissiveColor;
uniform float uTime;
uniform float uGlowIntensity;
uniform float uPulseSpeed;

varying vec2 vUv;

void main() {
  vec2 p = vUv - 0.5;
  float d = length(p) * 2.0;
  float ring = smoothstep(0.95, 0.35, d);
  float pulse = 0.65 + 0.35 * sin(uTime * uPulseSpeed + d * 5.0);
  float alpha = ring * pulse * uGlowIntensity * 0.7;
  gl_FragColor = vec4(uEmissiveColor, alpha);
}
