# Virtual Exhibition

A classical museum in the browser where you walk from room to room and see photos hanging on the walls. It works on phones and computers.

## The building

- **Entrance:** front doors, then oval marble steps up to the central hall.
- **Central hall:** a skylit hall with sculptures and plants. The floor is light oak.
- **Two wings** off the hall, each with 4 rooms walked as a loop. The doorways are centred and arched. Each room has its own wallpaper colour and one of three small patterns: fleur-de-lis, diamonds, or lily and dot.
- **Spiral staircase** at the far end of the hall, with a bronze railing and a domed skylight. It leads to the next floor, which has the same plan. Tap the steps or the **↑ Floor** button on the landing to go up or down.

**Live:** https://samn69.github.io/virtual-exhibition/

## Walking around

| | Phone | Computer |
|---|---|---|
| Look around | Drag | Drag with the mouse |
| Walk | Tap the floor, or use the joystick | Click the floor, or use the arrow keys / WASD |
| See a photo up close | Tap it (swipe for the next one) | Click it (← → for the next one) |
| Change floor | Tap the stairs, or **↑ / ↓ Floor** | Click the stairs, or **↑ / ↓ Floor** |
| Jump to a room | **Rooms** | **Rooms** |

**Your photos** puts pictures from your device on the walls to try it out. They stay on the device and nothing is uploaded. On a computer, **Choose a folder** turns each subfolder into a room.

## What's on show: `exhibition.json`

```json
{
  "title": "My Exhibition",
  "subtitle": "A virtual photo gallery",
  "floors": 2,
  "rooms": [
    {
      "name": "Room I · Landscapes",
      "color": "#35523f",
      "photos": [
        { "src": "https://…/photo.jpg", "title": "Lake Como", "date": "May 2025", "caption": "Early morning from Varenna" }
      ]
    }
  ]
}
```

- `floors` sets the number of floors (1 to 8). Each floor has 8 rooms. If there are more rooms than the floors hold, floors are added. Rooms without photos stay empty, ready to be filled.
- A room holds up to 8 photos. If a room has more, the extra photos continue in the next room.
- `color` is optional. Without it, each room gets the next classic wall colour.
- A photo without `src` shows a sample picture.
- Photos aren't kept in this repo. `src` points to wherever they're stored, and that server has to allow cross-origin (CORS) access.
- `?exhibition=<url>` opens a different exhibition file.

## How it's built

Plain files with no build step. [three.js](https://threejs.org) loads from a CDN, and GitHub Pages serves the repo.

- `js/constants.js`: sizes shared by everything (room height, floor height, door size…)
- `js/building.js`: the floor plan, walls, arched doorways, oak floors, skylights, benches and where photos hang
- `js/stairs.js`: the oval entrance steps and the spiral staircase
- `js/shapes.js`, `js/textures.js`, `js/batch.js`: wall outlines; oak, wallpaper and marble drawn in code; merging parts so phones draw them fast
- `js/decor.js`: sculptures, plants, pedestals and the hall settee
- `js/artworks.js`: frames, plaques and picture lights. It loads photos only for the room you're in and the ones next to it, shrunk to fit a phone's memory
- `js/controls.js`: walking, looking around, collisions, following steps up and down, and gliding round the spiral stairs
- `js/exhibition.js`: reads `exhibition.json`, or photos picked on the device
- `js/main.js`: puts it together, plus the menus and the photo viewer

`?debug` puts the walker and photos on `window.app` for testing from the browser console.

## Credits

The marble bust, horse statue, ficus, alocasia and ceramic vase are [Poly Haven](https://polyhaven.com) models, released under CC0 (free for any use). They are in `assets/models`. The monstera, snake plant and bird of paradise are drawn in code.
