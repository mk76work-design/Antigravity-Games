export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 32;

export const COLORS = {
    I: '#00b4d8', // Cyan (Water)
    J: '#0077b6', // Blue
    L: '#fb8500', // Orange
    O: '#ffb703', // Yellow
    S: '#2a9d8f', // Green
    T: '#9d4edd', // Purple
    Z: '#e63946', // Red
    DRAIN: '#00ff88', // 排水ブロック (Neon Green)
    FRAGMENT: '#475569' // 濃いグレー (沈んだ破片感)
};

export const SHAPES = {
    I: [[1, 1, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    T: [[0, 1, 0], [1, 1, 1]],
    Z: [[1, 1, 0], [0, 1, 1]]
};

export const STATE = {
    BALLOONED: 1,
    FRAGMENT: 2,
    DRAIN: 3
};
