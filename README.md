# Virtual Exhibition

A classical museum in the browser where you walk from room to room and see photos hanging on the walls. It works on phones and computers.

## The building

- **Entrance:** carved walnut front doors in a temple front of marble columns and a pediment, then five oval marble steps with a red carpet up to the central hall.
- **Central hall:** red wallpaper, a ficus in each corner and, in the middle, a carved stone urn of pink peonies, white roses and hydrangeas on a pedestal. The floor is light oak.
- **Two wings** off the hall, each with 4 rooms walked as a loop: blue rooms on the right, green on the left, each with one of three small wallpaper patterns (fleur-de-lis, diamonds, or lily and dot).
- **Doorways:** arched, in a moulded stone frame with a keystone.
- **Ceilings** are 7.5 m high. The entrance, the central halls and the stair hall have an arched glass roof; the rooms have a moulded ceiling with a rosette.
- **The sky** through the glass follows the visitor's clock: sun and drifting clouds by day, a warm sunset, and stars, the Milky Way and the moon (in its real phase) at night. `?time=21` shows a chosen hour.
- **Imperial staircase** at the far end of the hall: red-carpeted, with one central flight up to a landing, then two flights back to the next floor, which has the same plan. Behind the landing, a large arched window between two smaller ones looks out at the sky. Tap the stairs or the **↑ Floor** button to go up or down.

**Live:** https://samn69.github.io/virtual-exhibition/

## Walking around

| | Phone | Computer |
|---|---|---|
| Look around | Drag | Drag with the mouse |
| Walk | Tap the floor, or use the joystick | Click the floor, or use the arrow keys / WASD |
| See a photo up close | Tap it: the view glides up to the frame. **Label** (or tapping the plaque) reads its plaque; swipe for the next photo | Click it: the view glides up to the frame. **Label** (or clicking the plaque) reads its plaque; ← → for the next photo |
| Change floor | Tap the stairs, or **↑ / ↓ Floor** | Click the stairs, or **↑ / ↓ Floor** |
| Jump to a room | **Rooms** | **Rooms** |

## Adding and editing photos

Open **https://samn69.github.io/virtual-exhibition/?edit**, tap **Edit** and sign in with Google. After that, the **Edit** button stays on that device.

- **Add a photo:** walk into a room and tap **＋ Add photo**. The form fills in the camera, lens, settings and year from the photo; change anything, add a description and place, and save.
- **Change a photo:** tap it, then **Edit details**, **← Move / Move →** (its place along the walls) or **Remove**. Changing its room in the form moves it to another room.
- **Rename a room:** stand in it and tap **Rename room**. In the entrance or a hall, **Exhibition title** changes the title over the entrance.

A room holds 1 to 16 photos and arranges itself: one large photo in the middle of a wall when there are few, two per wall, then beside the doorways, and in two rows past 8.

### Where everything is kept

In the owner's Google Drive, in a folder called **Virtual Exhibition**: two copies of each photo (one sized for the wall, one up to 4096 px for close looks) and `virtual-exhibition.json`, which lists the rooms and photos. The photos are re-saved as JPEG, which leaves out the location a camera stores in a file; the files are shared "anyone with the link can view" so visitors can see them. Removed photos go to the Drive bin.

The gallery only has access to files it created itself (Google's `drive.file` permission), never the rest of the Drive. `js/config.js` holds the Google sign-in ID, the API key (restricted to this site and the Drive API) and the id of `virtual-exhibition.json`. Without that id, visitors see the sample exhibition below.

`?mockdrive` (with `?edit`) tries the editing without Google, keeping everything in the page until it's reloaded.

## Music

The ♪ button at the top opens the music. Quiet classical piano plays by default, from the visitor's first tap or click (browsers don't allow sound before that). Pause and Next are in the panel, and a paused choice is remembered. **Play my Spotify playlist instead** swaps in a Spotify player for the owner's playlist: full songs for visitors signed in to Spotify in that browser, 30-second previews for everyone else. The playlist is set in `js/music.js`.

## The sample exhibition: `exhibition.json`

```json
{
  "title": "My Exhibition",
  "subtitle": "A virtual photo gallery",
  "floors": 2,
  "rooms": [
    {
      "name": "Room I · Landscapes",
      "photos": [
        { "src": "https://…/photo.jpg", "title": "Lake Como", "year": "2025", "description": "Early morning from Varenna", "place": "Varenna, Italy", "camera": "Canon EOS R6", "lens": "RF50mm F1.8", "settings": "50 mm · f/2.8 · 1/250 s · ISO 200" }
      ]
    }
  ]
}
```

- `floors` sets the number of floors (1 to 8). Each floor has 8 rooms. If there are more rooms than the floors hold, floors are added. Rooms without photos stay empty, ready to be filled.
- A room holds up to 16 photos. If a room has more, the extra photos continue in the next room.
- A photo without `src` shows a sample picture.
- Photos aren't kept in this repo. `src` points to wherever they're stored, and that server has to allow cross-origin (CORS) access.
- `?exhibition=<url>` opens a different exhibition file.

## How it's built

Plain files with no build step. [three.js](https://threejs.org) loads from a CDN, and GitHub Pages serves the repo.

- `js/constants.js`: sizes shared by everything (room height, floor height, door size…)
- `js/building.js`: the floor plan, walls, oak floors, benches and where photos hang (for any number from 1 to 16)
- `js/doorways.js`, `js/frontdoors.js`: the stone doorway frames and the front doors
- `js/ceilings.js`: the arched glass roofs
- `js/sky.js`: the sky drawn on the glass (sun, clouds, stars, moon)
- `js/stairs.js`: the carpeted entrance steps and the imperial staircase
- `js/shapes.js`, `js/textures.js`, `js/batch.js`: wall outlines; oak, wallpaper and marble drawn in code; merging parts so phones draw them fast
- `js/decor.js`: sculptures, plants, pedestals and the hall settee
- `js/artworks.js`: frames, plaques and picture lights. It loads photos only for the room you're in and the ones next to it, shrunk to fit a phone's memory
- `js/controls.js`: walking, looking around, collisions, following steps up and down, and gliding up and down the stairs
- `js/exhibition.js`: reads the exhibition file (from Drive, or `exhibition.json`)
- `js/drive.js`, `js/config.js`: Google sign-in and Drive storage
- `js/editor.js`: edit mode (adding photos and reading their camera details, the forms, renaming)
- `js/closeup.js`: gliding up to a photo and reading its plaque
- `js/main.js`: puts it together, plus the menus

`?debug` puts the walker and photos on `window.app` for testing from the browser console.

## Credits

The marble bust, horse statue, ficus, alocasia and ceramic vase are [Poly Haven](https://polyhaven.com) models, released under CC0 (free for any use). They are in `assets/models`. The monstera, snake plant, bird of paradise and the flower urn are drawn in code.

The moon's surface is from NASA's [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) (Scientific Visualization Studio), which is in the public domain. It is in `assets/sky`.

The music in `assets/music/` is from Wikimedia Commons, free to use:
- Bach, Goldberg Variations: Aria and Prelude in C major, BWV 846, played by Kimiko Ishizaka (CC0, the Open Goldberg Variations and Open Well-Tempered Clavier projects).
- Chopin, Nocturnes Op. 9 No. 2 and Op. 27 No. 2, played by Frank Levy, and Op. 15 No. 2, played by Luke Faulkner (public domain, from Musopen).

Camera details are read with [exifr](https://github.com/MikeKovarik/exifr) (MIT licence), loaded from a CDN only in edit mode.
