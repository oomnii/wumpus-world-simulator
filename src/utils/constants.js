export const GRID_SIZES = [4, 5, 6, 7, 8, 9, 10];

export const DEFAULT_GRID_SIZE = 10;
export const DEFAULT_PIT_DENSITY = 25;
export const DEFAULT_AI_INTERVAL_MS = 500;

export const SPEED_OPTIONS = [
  { label: '0.25s', ms: 250 },
  { label: '0.5s', ms: 500 },
  { label: '1s', ms: 1000 },
  { label: '2s', ms: 2000 },
];

export const DIRECTIONS = {
  UP: { dx: 0, dy: -1, name: 'up' },
  DOWN: { dx: 0, dy: 1, name: 'down' },
  LEFT: { dx: -1, dy: 0, name: 'left' },
  RIGHT: { dx: 1, dy: 0, name: 'right' },
};

export const ACTION = {
  MOVE_UP: 'MOVE_UP',
  MOVE_DOWN: 'MOVE_DOWN',
  MOVE_LEFT: 'MOVE_LEFT',
  MOVE_RIGHT: 'MOVE_RIGHT',
  SHOOT: 'SHOOT',
  GRAB: 'GRAB',
  CLIMB: 'CLIMB',
};

export const GAME_STATUS = {
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
  STUCK: 'stuck',
};

export const MODE = {
  AI: 'ai',
  MANUAL: 'manual',
};

export const SCORE = {
  MOVE: -1,
  GRAB_GOLD: 1000,
  SHOOT: -10,
  CLIMB_WITH_GOLD: 1000,
  DEATH: -1000,
};

export const AI_STAGE = {
  OBSERVE: 'OBSERVE',
  UPDATE_KNOWLEDGE: 'UPDATE KNOWLEDGE',
  INFER: 'INFER',
  DECIDE: 'DECIDE',
  EXECUTE: 'EXECUTE ACTION',
  IDLE: 'IDLE',
};

export const HISTORY_STORAGE_KEY = 'wumpus_world_game_history_v1';

export const WORLD_GEN_MAX_RETRIES = 80;
