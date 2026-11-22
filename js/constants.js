// Measurements shared by the building, the stairs and the walker (metres).
export const H = 5.5;          // room height
export const T = 0.4;          // wall thickness
export const FLOOR_H = 6;      // floor to floor
export const BASE = 1.8;       // the galleries are up the entrance steps
export const EYE = 1.65;
export const PHOTO_Y = 1.85;   // centre of the photos above the floor
export const DOOR = { width: 2.4, spring: 2.6 };
export const ROOMS_PER_FLOOR = 8;
export const floorY = f => BASE + f * FLOOR_H;
// classic gallery wall colours: Pompeian red, green, blue, ochre, plum…
export const WALL_COLORS = ['#7a2a2c', '#35523f', '#2c3b57', '#8c6331', '#583049', '#6a3526', '#40525c', '#5e4a24', '#38483a', '#52283a'];
