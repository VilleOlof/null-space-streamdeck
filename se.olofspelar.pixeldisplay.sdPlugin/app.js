
/**
 * Converts a color to a hex string
 * 
 * @param {number} color
 * @returns {string}
 */
const ColorToHex = {
    0: "#f23624",
    1: "#45ff45",
    2: "#29abfd",
    3: "#f4f227",
    4: "#f18e02",
    5: "#aa00ff",
    6: "#40ffff",
    7: "#ffffff",
    8: "#2e2e2e",
    9: "#cacaca",
    10: "#ac2215",
    11: "#009900",
    12: "#3062f1",
    13: "#cca81a",
    14: "#9a642e",
    15: "#ff00ff",
    16: "#00e099",
    17: "#858585",
    18: "#ff99ff",
    19: "#f3d7aa",
};

/**
 * The websocket to the stream deck
 * 
 * @type {WebSocket}
 */
let websocket = null;

/**
 * All contexts that are currently active
 * 
 * @type {string[]}
 */
let contexts = [];

/**
 * @typedef {Object} BoardData
 * @property {number} width
 * @property {number} height
 * @property {number[]} pixels
 */

/**
 * @type {BoardData}
 */
let board = {
    width: 64,
    height: 64,
    pixels: []
};

/**
 * Connects to the stream deck socket
 * 
 * @param {number} inPort 
 * @param {string} inPluginUUID 
 * @param {string} inRegisterEvent 
 * @param {string} inInfo  // json string
 */
function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    websocket = new WebSocket(`ws:///127.0.0.1:${inPort}`);

    websocket.onopen = () => {
        Open(inPluginUUID, inRegisterEvent);
    }
    websocket.onmessage = OnMessage;
}

/**
 * Opens the websocket
 * 
 * @param {string} uuid 
 * @param {string} event 
 */
function Open(uuid, event) {
    const json = {
        event: event,
        uuid: uuid
    };

    websocket.send(JSON.stringify(json));

    Main();
}

/**
 * Handles a message from the stream deck
 * 
 * @param {MessageEvent} evt 
 */
function OnMessage(evt) {
    let jsonObj = JSON.parse(evt.data);
    let event = jsonObj.event;
    let action = jsonObj.action;
    let context = jsonObj.context;

    switch (event) {
        case "keyDown": {
            if (action === "se.olofspelar.pixeldisplay.action") {
                OpenSite();
            }
            break;
        }
        case "willAppear": {
            contexts.push(context);

            SetImage();
            break;
        }
        case "willDisappear": {
            contexts = contexts.filter(x => x !== context);
            break;
        }
    }
}

/**
 * Main function after connecting to the stream deck
 */
function Main() {
    let display_socket = new WebSocket("wss://display.stamsite.nu/server");

    display_socket.onopen = () => {
        console.log("Connected to display socket");
    };

    display_socket.onmessage = (evt) => {
        let msg = JSON.parse(evt.data);
        console.log(msg);

        switch (msg.type) {
            case "GetBoard": GetBoard(msg); break;
            case "PixelUpdate": PixelUpdate(msg); break;
        }
    }
}

function OpenSite() {
    websocket.send(JSON.stringify({
        "event": "openUrl",
        "payload": {
            "url": "https://display.stamsite.nu"
        }
    }));
}

/**
 * Sets the entire board
 * 
 * @param {*} msg
 * @returns {void}
 */
function GetBoard(msg) {
    board = msg.data.board;

    SetImage();
}

/**
 * Changes the pixel on the board
 * 
 * @param {*} msg 
 * @returns {void}
 */
function PixelUpdate(msg) {
    const [x, y, color] = [msg.data.pixelChanged.x, msg.data.pixelChanged.y, msg.data.pixelChanged.color];

    board.pixels[x * board.width + y] = color;

    SetImage();
}
/**
 * Sets the image on the stream deck
 * 
 * @returns {void}
 */
function SetImage() {
    if (contexts.length === 0 || board.pixels.length === 0) {
        return;
    }

    const canvas = BuildCanvas();

    const base64 = canvas.toDataURL("image/png");

    for (let context of contexts) {
        websocket.send(JSON.stringify({
            "event": "setImage",
            "context": context,
            "payload": {
                "image": base64,
                "target": 0
            }
        }));
    }
}

/**
 * Builds a canvas with the current board
 * 
 * @returns {HTMLCanvasElement}
 */
function BuildCanvas() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = 288;
    canvas.height = 288;

    const scale = canvas.width / board.width;

    ctx.scale(scale, scale);

    for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
            ctx.fillStyle = ColorToHex[board.pixels[y * board.width + x]];
            ctx.fillRect(x, y, 1, 1);
        }
    }

    ctx.imageSmoothingEnabled = false;

    return canvas;
}