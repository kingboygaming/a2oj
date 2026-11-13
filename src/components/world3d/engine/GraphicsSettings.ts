export type GraphicsQuality = 'LOW' | 'MEDIUM' | 'HIGH';

export interface GraphicsConfig {
  shadowMapSize: number;
  shadowEnabled: boolean;
  vegetationDensity: number;
  maxNPCs: number;
  postProcessing: boolean;
  textureQuality: 'low' | 'medium' | 'high';
  drawDistance: number;
  animationEnabled: boolean;
  terrainSegments: number;
  antialias: boolean;
  waterReflection: boolean;
  fogDensity: number;
}

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsConfig> = {
  LOW: {
    shadowMapSize: 512,
    shadowEnabled: false,
    vegetationDensity: 0.3,
    maxNPCs: 20,
    postProcessing: false,
    textureQuality: 'low',
    drawDistance: 300,
    animationEnabled: true,
    terrainSegments: 64,
    antialias: false,
    waterReflection: false,
    fogDensity: 0.008,
  },
  MEDIUM: {
    shadowMapSize: 1024,
    shadowEnabled: true,
    vegetationDensity: 0.6,
    maxNPCs: 50,
    postProcessing: false,
    textureQuality: 'medium',
    drawDistance: 500,
    animationEnabled: true,
    terrainSegments: 128,
    antialias: true,
    waterReflection: false,
    fogDensity: 0.005,
  },
  HIGH: {
    shadowMapSize: 2048,
    shadowEnabled: true,
    vegetationDensity: 1.0,
    maxNPCs: 100,
    postProcessing: true,
    textureQuality: 'high',
    drawDistance: 800,
    animationEnabled: true,
    terrainSegments: 256,
    antialias: true,
    waterReflection: true,
    fogDensity: 0.003,
  },
};
