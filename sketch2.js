let textInput, fontSelect, sizeSlider, colorPicker, wordRotationSlider, letterRotationSlider, modeSelect, speedSlider, glitchSlider, mouseInteractionSelect, darkModeToggle, resetBtn, exportBtn, wordSpacingSlider, lineSpacingSlider;
let poem = '';
let settings = {
    font: 'Courier New',
    size: 30,
    color: '#ffffff',
    wordRotation: 0,
    letterRotation: 0,
    mode: 'linear',
    speed: 1,
    glitchLevel: 2,
    mouseInteraction: 'none',
    darkMode: false,
    wordSpacing: 50,
    lineSpacing: 60
};
let words = [];
let draggingWord = null;
let bgVideo;

// ---------------- WORD CLASS ----------------
class Word {
    constructor(text, x, y, index) {
        this.text = text;
        this.baseX = x;
        this.baseY = y;
        this.x = x;
        this.y = y;
        this.index = index;
        this.broken = false;
        this.letters = [];
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.fixed = false;
        this.isGrowing = false;
        this.currentSize = settings.size;

        // offsets para float/flow
        this.dxOffset = 0;
        this.dyOffset = 0;
        this.perlinX = random(1000);
        this.perlinY = random(1000);
    }

    isMouseOver() {
        let w = textWidth(this.text);
        let h = this.currentSize;
        return dist(mouseX, mouseY, this.x, this.y) < max(w, h) / 2;
    }

    breakWord() {
        if (!this.broken) {
            this.broken = true;
            this.letters = this.text.split('').map(letter => ({
                char: letter,
                x: this.x,
                y: this.y,
                vx: random(-5, 5),
                vy: random(-10, 0),
                rotation: random(-0.3, 0.3),
                size: settings.size,
                color: settings.color
            }));
        }
    }

    update() {
        let t = frameCount * 0.02 * settings.speed;

        // --- grow ---
        if (settings.mode === 'grow' && this.isGrowing) {
            this.currentSize = min(this.currentSize + 1, 120);
        } else {
            this.currentSize = settings.size;
        }

        // --- modos dinámicos ---
        let dx = 0, dy = 0;

        if (!this.broken && settings.mode !== 'linear' && settings.mode !== 'grow') {
            switch (settings.mode) {
                case 'spiral':
                    let radius = this.index * 20 + sin(t + this.index) * 10;
                    dx = cos(this.index * 0.5 + t) * radius;
                    dy = sin(this.index * 0.5 + t) * radius;
                    break;
                case 'dna':
                    dx = sin(t + this.index * 0.5) * 200;
                    dy = cos(t + this.index * 0.5) * 60 * sin(t * 0.8);
                    break;
                case 'float':
                    this.dxOffset += sin(t + this.index) * 0.5;
                    this.dyOffset += cos(t + this.index) * 0.5;
                    dx += this.dxOffset;
                    dy += this.dyOffset;
                    break;
                case 'flow':
                    this.perlinX += 0.01 * settings.speed;
                    this.perlinY += 0.01 * settings.speed;
                    this.dxOffset += map(noise(this.perlinX + this.index), 0, 1, -2, 2);
                    this.dyOffset += map(noise(this.perlinY + this.index), 0, 1, -2, 2);
                    dx += this.dxOffset;
                    dy += this.dyOffset;
                    break;
                case 'kaleidoscope':
                case 'mirror':
                    break;
            }
        }

        // --- mouse interactions ---
        if (this.isMouseOver() && settings.mouseInteraction === 'break' && mouseIsPressed) {
            this.breakWord();
        }

        if (draggingWord === this && settings.mouseInteraction === 'drag') {
            this.x = mouseX + this.dragOffsetX;
            this.y = mouseY + this.dragOffsetY;
            this.fixed = true;
        } else if (settings.mouseInteraction === 'pull' && mouseIsPressed) {
            let d = dist(mouseX, mouseY, this.x, this.y);
            if (d < 200) {
                let force = (200 - d) * 0.02;
                dx += (mouseX - this.x) * force * 0.05;
                dy += (mouseY - this.y) * force * 0.05;
            }
        } else if (settings.mouseInteraction === 'repel' && mouseIsPressed) {
            let d = dist(mouseX, mouseY, this.x, this.y);
            if (d < 200) {
                let force = (200 - d) * 0.02;
                dx -= (mouseX - this.x) * force * 0.05;
                dy -= (mouseY - this.y) * force * 0.05;
            }
        }

        // --- aplicar offsets a baseX/baseY ---
        if (!this.fixed) {
            this.x = this.baseX + dx;
            this.y = this.baseY + dy;
        }

        if (this.broken) {
            this.letters.forEach(l => {
                l.x += l.vx;
                l.y += l.vy;
                l.vy += 0.3;
            });
        }
    }

    display() {
        push();
        translate(this.x, this.y);
        rotate(radians(settings.wordRotation));
        textFont(settings.font);
        textSize(this.currentSize);

        if (settings.glitchLevel > 0 && frameCount % int(10 - settings.glitchLevel) === 0) {
            translate(random(-2, 2), random(-2, 2));
        }

        fill(settings.color);
        textStyle(this.isGrowing ? BOLD : NORMAL);

        if (this.broken) {
            this.letters.forEach(l => {
                push();
                translate(l.x - this.x, l.y - this.y);
                rotate(l.rotation);
                textSize(l.size);
                fill(l.color);
                text(l.char, 0, 0);
                pop();
            });
        } else {
            text(this.text, 0, 0);
        }

        if (settings.mode === 'kaleidoscope') {
            push(); scale(-1, 1); text(this.text, 0, 0); pop();
            push(); scale(1, -1); text(this.text, 0, 0); pop();
            push(); scale(-1, -1); text(this.text, 0, 0); pop();
        }

        if (settings.mode === 'mirror') {
            push(); scale(-1, 1); text(this.text, 0, 0); pop();
        }

        pop();
    }
}

// ---------------- SETUP ----------------
function setup() {
    let canvas = createCanvas(windowWidth - 300, windowHeight);
    canvas.parent('canvas-container');

    // --- VIDEO BACKGROUND ---
    bgVideo = select('#bgVideo');
    let videoInput = select('#videoUpload');
    videoInput.changed(() => {
        const file = videoInput.elt.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            bgVideo.elt.src = url;
            bgVideo.elt.play();
        }
    });

    setupControls();
    updatePoem();
}

// ---------------- DRAW ----------------
function draw() {
    // Video ya se reproduce automáticamente, solo ponemos un fondo si no hay video
    if (!bgVideo.elt.src) {
        background(settings.darkMode ? 20 : 245);
    }

    applySpacing(); // recalcular spacing cada frame
    words.forEach(w => {
        w.update();
        w.display();
    });
}

// ---------------- SPACING ----------------
function applySpacing() {
    let lines = poem.split(/\r?\n/);
    let y = height / 2 - (lines.length * settings.lineSpacing) / 2;
    let index = 0;

    for (let line of lines) {
        let pieces = line.trim().split(/\s+/);
        let totalWidth = 0;
        textFont(settings.font);
        textSize(settings.size);
        for (let p of pieces) totalWidth += textWidth(p) + parseFloat(settings.wordSpacing);

        let x = width / 2 - totalWidth / 2;

        for (let p of pieces) {
            if (words[index]) {
                words[index].baseX = x;
                words[index].baseY = y;
            }
            x += textWidth(p) + parseFloat(settings.wordSpacing);
            index++;
        }
        y += parseFloat(settings.lineSpacing);
    }
}

// ---------------- CONTROLS ----------------
function setupControls() {
    textInput = select('#textInput');
    fontSelect = select('#fontSelect');
    sizeSlider = select('#sizeSlider');
    colorPicker = select('#colorPicker');
    wordRotationSlider = select('#wordRotationSlider');
    letterRotationSlider = select('#letterRotationSlider');
    modeSelect = select('#modeSelect');
    speedSlider = select('#speedSlider');
    glitchSlider = select('#glitchSlider');
    mouseInteractionSelect = select('#mouseInteractionSelect');
    darkModeToggle = select('#darkModeToggle');
    resetBtn = select('#resetBtn');
    exportBtn = select('#exportBtn');
    wordSpacingSlider = select('#wordSpacingSlider');
    lineSpacingSlider = select('#lineSpacingSlider');

    textInput.input(updatePoem);
    fontSelect.changed(updateSettings);
    sizeSlider.input(updateSettings);
    colorPicker.input(updateSettings);
    wordRotationSlider.input(updateSettings);
    letterRotationSlider.input(updateSettings);
    modeSelect.changed(updateSettings);
    speedSlider.input(updateSettings);
    glitchSlider.input(updateSettings);
    mouseInteractionSelect.changed(updateSettings);
    darkModeToggle.changed(toggleDarkMode);
    resetBtn.mousePressed(resetEverything);
    exportBtn.mousePressed(() => saveCanvas('visual_poem', 'png'));
    wordSpacingSlider.input(updateSettings);
    lineSpacingSlider.input(updateSettings);
}

// ---------------- UPDATE ----------------
function updatePoem() {
    poem = textInput.value();
    let pieces = poem.split(/\s+/);
    words = [];
    for (let i = 0; i < pieces.length; i++) {
        words.push(new Word(pieces[i], width / 2, height / 2, i));
    }
}

function updateSettings() {
    settings.font = fontSelect.value();
    settings.size = sizeSlider.value();
    settings.color = colorPicker.value();
    settings.wordRotation = wordRotationSlider.value();
    settings.letterRotation = letterRotationSlider.value();
    settings.mode = modeSelect.value();
    settings.speed = speedSlider.value();
    settings.glitchLevel = glitchSlider.value();
    settings.mouseInteraction = mouseInteractionSelect.value();
    settings.wordSpacing = wordSpacingSlider.value();
    settings.lineSpacing = lineSpacingSlider.value();
}

function toggleDarkMode() {
    settings.darkMode = darkModeToggle.checked();
}

// ---------------- MOUSE ----------------
function mousePressed() {
    if (settings.mode === 'grow') {
        words.forEach(w => { if (w.isMouseOver()) w.isGrowing = true; });
    }
    if (settings.mouseInteraction === 'drag') {
        for (let w of words) {
            if (w.isMouseOver()) {
                draggingWord = w;
                w.dragOffsetX = w.x - mouseX;
                w.dragOffsetY = w.y - mouseY;
                break;
            }
        }
    }
}

function mouseReleased() {
    words.forEach(w => w.isGrowing = false);
    draggingWord = null;
}

// ---------------- RESET ----------------
function resetEverything() {
    textInput.value('');
    settings = {
        font: 'Courier New', size: 30, color: '#ffffff',
        wordRotation: 0, letterRotation: 0,
        mode: 'linear', speed: 1, glitchLevel: 2,
        mouseInteraction: 'none', darkMode: false,
        wordSpacing: 50, lineSpacing: 60
    };
    updatePoem();
}
