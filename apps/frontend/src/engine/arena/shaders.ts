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
      
      // Base grass color intersecting with rim
      vec3 color = vec3(0.04, 0.1, 0.05); // dark stadium green
      vec3 peakColor = vec3(0.08, 0.2, 0.1); 
      
      // Add artificial texture strips (Mowing lines)
      float stripe = step(0.5, fract(vPosition.z * 0.25));
      vec3 finalColor = mix(color, peakColor, stripe * 0.4) * alpha;

      gl_FragColor = vec4(finalColor, 1.0);
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
