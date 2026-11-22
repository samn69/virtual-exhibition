# Virtual Exhibition

A classical museum in the browser where you walk from room to room and see photos hanging on the walls. It works on phones and computers.

**Live:** https://samn69.github.io/virtual-exhibition/

## Walking around

| | Phone | Computer |
|---|---|---|
| Look around | Drag | Drag with the mouse |
| Walk | Tap the floor, or use the joystick | Click the floor, or use the arrow keys / WASD |
| See a photo up close | Tap it (swipe for the next one) | Click it (← → for the next one) |
| Jump to a room | **Rooms** | **Rooms** |

**Your photos** puts pictures from your device on the walls to try it out. They stay on the device and nothing is uploaded. On a computer, **Choose a folder** turns each subfolder into a room.

## What's on show: `exhibition.json`

```json
{
  "title": "My Exhibition",
  "subtitle": "A virtual photo gallery",
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

- A room holds up to 12 photos. If a room has more, the extra photos continue in a second room.
- `color` is optional. Without it, each room gets the next classic wall colour.
- A photo without `src` shows a sample picture.
- Photos aren't kept in this repo. `src` points to wherever they're stored, and that server has to allow cross-origin (CORS) access.
- `?exhibition=<url>` opens a different exhibition file.

## How it's built

Plain files with no build step. [three.js](https://threejs.org) loads from a CDN, and GitHub Pages serves the repo.

- `js/building.js`: the rooms, including walls, arched doorways, marble floor, skylights, benches and where photos hang
- `js/artworks.js`: frames, plaques and picture lights. It loads photos only for the room you're in and the ones next to it, shrunk to fit a phone's memory
- `js/controls.js`: walking, looking around, and collisions
- `js/exhibition.js`: reads `exhibition.json`, or photos picked on the device
- `js/main.js`: puts it together, plus the menus and the photo viewer

`?debug` puts the walker and photos on `window.app` for testing from the browser console.
