// Measurements shared by the building, the stairs and the walker (metres).
export const H = 7.5;            // room height
export const FLOOR_H = 8.1;      // floor to floor
export const HALL_HALF = 5;      // half the width of the central hall
export const ENTRANCE_HALF = 6;  // half the width of the entrance hall
export const T = 0.4;          // wall thickness
export const ENTRANCE_STEPS = 5;
export const BASE = 0.9;       // the galleries are up the entrance steps
export const EYE = 1.65;
export const PHOTO_Y = 1.85;   // centre of the photos above the floor
export const DOOR = { width: 2.4, spring: 2.6 };
export const ROOMS_PER_FLOOR = 8;
export const floorY = f => BASE + f * FLOOR_H;

// wallpaper colours: red for the entrance, halls and stairs; blue rooms on the right, green on the left
export const HALL_COLOR = '#6a2626';
export const WING_COLORS = { R: '#2b4166', L: '#2f5240' };
export const WALL_COLORS = [WING_COLORS.R, WING_COLORS.L];
