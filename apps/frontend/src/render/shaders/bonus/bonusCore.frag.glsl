uniform vec3 uBaseColor;
uniform vec3 uEmissiveColor;
uniform float uTime;
uniform float uPulseSpeed;
uniform float uGlowIntensity;
uniform float uRarityTier;

varying vec3 vNormalW;
varying vec3 vViewDirW;

void main() {
  float rim = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDirW)), 0.0), 2.6);
  float pulse = 0.75 + 0.25 * sin(uTime * uPulseSpeed);
  float rarityBoost = 1.0 + uRarityTier * 0.28;
  vec3 color = uBaseColor + uEmissiveColor * rim * uGlowIntensity * pulse * rarityBoost;
  gl_FragColor = vec4(color, 1.0);
}
