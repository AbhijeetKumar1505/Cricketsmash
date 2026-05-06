export const GrassShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float time;

    void main() {
      vUv = uv;
      vPosition = position;
      
      // Keep vertex positions stable, we only use 'time' for optional fragment-level visual shifts
      vec3 transformed = vec3(position.x, position.y, position.z);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vPosition;

    void main() {
      // Very subtle grass gradient based on radius
      float dist = length(vPosition.xz);
      float alpha = smoothstep(60.0, 5.0, dist);
      
      // Cinematic grass palette — vibrant but natural broadcast green
      vec3 color = vec3(0.12, 0.22, 0.1);      // Deep stadium grass
      vec3 peakColor = vec3(0.18, 0.38, 0.12);  // Lit stripe highlights
      
      // Add artificial texture strips (Mowing lines)
      float stripe = step(0.5, fract(vPosition.z * 0.24));
      vec3 finalColor = mix(color, peakColor, stripe * 0.65);
      
      // Warm Sunlight Tint Gradient
      float warmShift = smoothstep(-40.0, 40.0, vPosition.x + vPosition.z) * 0.12;
      finalColor += vec3(warmShift, warmShift * 0.8, 0.0);

      // Subtle Vignette (Darkens edges to focus center)
      float vignette = smoothstep(65.0, 30.0, dist);
      finalColor *= mix(0.7, 1.0, vignette);

      gl_FragColor = vec4(finalColor * alpha, 1.0);
    }
  `
};

export const DustShader = {
  vertexShader: `
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (30.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    void main() {
      // Soft circle
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.2, dist) * 0.15;
      gl_FragColor = vec4(vColor, alpha);
    }
  `
};
