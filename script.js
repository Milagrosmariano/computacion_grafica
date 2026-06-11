const pinceles = {};
let pincelActual;
let pincelNombre = "aerosol";

const coloresBase = {
    yellow: [244, 183, 25],
    orange: [219, 92, 11],
    red: [130, 13, 9],
    green: [152, 176, 95],
    black: [0, 0, 0],
    white: [255, 248, 209],
    purple: [39, 29, 79],
    blue: [93, 185, 225]
};

// 6 Paletas predefinidas 
const paletas = [
    // Paleta 1
    {
        yellow: 10,
        red: 25,
        black: 15,
        white: 25,
        purple: 25,
    },
    // Paleta 2
    {
        blue: 10,
        green: 25,
        white: 35,
        black: 15,
        orange: 15,
    },
    // Paleta 3
    {
        red: 20,
        yellow: 30,
        green: 25,
        purple: 10,
        orange: 15,
    },
    // Paleta 4
    {
        yellow: 15,
        orange: 15,
        purple: 25,
        white: 30,
        black: 15,
    },
    // Paleta 5
    {
        black: 40,
        red: 25,
        purple: 15,
        blue: 10,
        white: 10,
    },
    // Paleta 6
    {
        white: 40,
        yellow: 20,
        blue: 15,
        purple: 10,
        red: 15,
    }
];

// frecuencia baja = chasquido/click, frecuencia alta = grito/chillido
const soundToBrush = {
    click: 1,      // Chasquido de lengua: baja frecuencia (30-240 Hz)
    lowTone: 2,    // Tono bajo (241-419 Hz)
    midTone: 3,    // Tono medio (420-699 Hz)
    highTone: 4,   // Tono alto / grito agudo (700-999 Hz)
    veryHigh: 5,   // Muy agudo (1000+ Hz)
};

let paletaActual = {};
let paletaIndex = 0;

let mic;
let fft;
let audioIniciado = false;

let usosPinceles = {
    aerosol: 0,
    centradas: 0,
    lineas: 0,
    muchaslineas: 0,
    nose: 0,
    splash: 0
};

let maximoPorPincel = 200;
let mapaZonas = {};
let maximoPorZona = 200;
let tamañoCelda = 100;

let lastDrawTime = 0;
let drawDelay = 100;
let lastSoundDetectionTime = 0;
let soundDetectionDelay = 20; // Evitar cambios de pincel muy rápido

// Variables para análisis de sonido
let soundDuration = 0; // Duración del sonido actual
let lastSignificantSoundTime = 0;
let soundThreshold = 0.01;

// ==========================================
// CORRECCIÓN 1: Usar obligatoriamente loadImage()
// ==========================================
function preload() {
    pinceles.aerosol = loadImage("imagenes/aerosol.png");
    pinceles.centradas = loadImage("imagenes/centradas.png");
    pinceles.lineas = loadImage("imagenes/lineas.png");
    pinceles.muchaslineas = loadImage("imagenes/muchaslineas.png");
    pinceles.nose = loadImage("imagenes/nose.png");
    pinceles.splash = loadImage("imagenes/splash.png");
   
    
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    background(255);
    
    let pincelesList = Object.keys(pinceles);
    pincelActual = pinceles[pincelesList[0]];
    pincelNombre = pincelesList[0];

    mic = new p5.AudioIn();
    fft = new p5.FFT();
    fft.setInput(mic);
    
    cargarPaleta(0);
}

// Cargar una paleta específica
function cargarPaleta(index) {
    if (index < 0 || index >= paletas.length) return;
    
    paletaIndex = index;
    let paletaDatos = paletas[index];
    paletaActual = {};
    
    let totalTrazosPermitidos = 240; // 20 strokes * 12 brushes
    
    for (let color in paletaDatos) {
        let porcentaje = paletaDatos[color];
        
        paletaActual[color] = {
            rgb: coloresBase[color],
            porcentaje: porcentaje,
            trazosMaximos: Math.floor((porcentaje / 100) * totalTrazosPermitidos),
            trazosActuales: 0
        };
    }
    
    console.log("Paleta " + (index + 1) + " cargada:", paletaActual);
}

// Obtener un color disponible de la paleta actual
function obtenerColorDisponible() {
    let coloresDisponibles = [];
    
    for (let color in paletaActual) {
        let datos = paletaActual[color];
        if (datos.trazosActuales < datos.trazosMaximos) {
            coloresDisponibles.push(color);
        }
    }
    
    if (coloresDisponibles.length === 0) {
        return null;
    }
    
    return coloresDisponibles[Math.floor(Math.random() * coloresDisponibles.length)];
}

// Detectar el tipo de sonido por análisis avanzado
function detectarSonido() {
    let currentTime = millis();
    if (currentTime - lastSoundDetectionTime < soundDetectionDelay) {
        return;
    }

    let volumen = mic.getLevel();
    
    // Track sound duration
    if (volumen > soundThreshold) {
        soundDuration = currentTime - lastSignificantSoundTime;
        lastSignificantSoundTime = currentTime;
    } else {
        soundDuration = 0;
    }

    if (volumen < soundThreshold) {
        return;
    }

    // ===== ANÁLISIS DE CARACTERÍSTICAS DE SONIDO =====
    
    let spectrum = fft.analyze();
    
    // 1. INTENSIDAD (Amplitude/Volume)
    let intensity = volumen; // 0 a 1
    
    // 2. TONO (Frequency - fundamental frequency)
    let peakFreq = 0;
    let peak = 0;
    for (let i = 0; i < spectrum.length; i++) {
        if (spectrum[i] > peak) {
            peak = spectrum[i];
            peakFreq = i;
        }
    }

    
    
    // 3. TIMBRE (Spectral distribution - harmonic content)
    // Convertir Hz a índices del espectro
    // Asumiendo 44100 Hz sample rate y FFT de 2048 bins
    // Cada bin = 22050 / 1024 ≈ 21.5 Hz
    
    let binSize = 22050 / spectrum.length; // Hz por bin

    let peakFreqHz = peakFreq * binSize;
    
    // Calcular índices para cada rango de frecuencia
    let lowStart = Math.floor(30 / binSize);
    let lowEnd = Math.floor(240 / binSize);
    
    let midStart = Math.floor(241 / binSize);
    let midEnd = Math.floor(419 / binSize);
    
    let highStart = Math.floor(420 / binSize);
    let highEnd = Math.floor(699 / binSize);
    
    let veryHighStart = Math.floor(700 / binSize);
    let veryHighEnd = Math.floor(999 / binSize);
    
    // Calcular energía en cada rango
    let lowEnergy = 0;
    for (let i = lowStart; i <= lowEnd && i < spectrum.length; i++) {
        lowEnergy += spectrum[i];
    }
    
    let midEnergy = 0;
    for (let i = midStart; i <= midEnd && i < spectrum.length; i++) {
        midEnergy += spectrum[i];
    }
    
    let highEnergy = 0;
    for (let i = highStart; i <= highEnd && i < spectrum.length; i++) {
        highEnergy += spectrum[i];
    }
    
    let veryHighEnergy = 0;
    for (let i = veryHighStart; i <= veryHighEnd && i < spectrum.length; i++) {
        veryHighEnergy += spectrum[i];
    }
    
    let totalEnergy = lowEnergy + midEnergy + highEnergy + veryHighEnergy;
    
    // Evitar división por cero
    if (totalEnergy === 0) {
        totalEnergy = 1;
    }
    
    // Normalizar timbre
    let timbralBalance = {
        low: lowEnergy / totalEnergy,
        mid: midEnergy / totalEnergy,
        high: highEnergy / totalEnergy,
        veryHigh: veryHighEnergy / totalEnergy
    };
    
    // 4. DURACIÓN (Sound duration in milliseconds)
    let duration = soundDuration;
    
    // ===== LÓGICA DE SELECCIÓN DE PINCEL =====
    // Cada pincel corresponde a la banda de frecuencia dominante
  
let brushName = "splash";

// Frecuencia dominante
if (peakFreqHz >= 30 && peakFreqHz <= 180) {
    brushName = "aerosol";
}
else if (peakFreqHz <= 500) {
    brushName = "centradas";
}
else if (peakFreqHz <= 800) {
    brushName = "lineas";
}
else if (peakFreqHz <= 1200) {
    brushName = "muchaslineas";
}
else {
    brushName = "nose";
}

    console.log(
    "Frecuencia:",
    Math.round(peakFreqHz),
    "Hz",
    "Pincel:",
    brushName
);
    
    pincelActual = pinceles[brushName];
    pincelNombre = brushName;
    
    lastSoundDetectionTime = currentTime;
}

function draw() {
    if (!audioIniciado) return;

    // Detectar sonido y cambiar pincel automáticamente
    detectarSonido();

    let volumen = mic.getLevel();

    if (volumen < 0.005) return;

    // Throttle: solo crear nuevo stroke cada 100ms
    let currentTime = millis();
    if (currentTime - lastDrawTime < drawDelay) {
        return;
    }
    lastDrawTime = currentTime;

    console.log(
    pincelNombre,
    usosPinceles[pincelNombre]
);

    // Verificar si este pincel ya llegó al límite de 20 usos
    if (usosPinceles[pincelNombre] >= maximoPorPincel) {
        return;
    }

    // Generar posición aleatoria
    let x = random(-10, width + 10);
    let y = random(-10, height + 10);

    // Calcular la zona (celda 100x100px)
    let celdaX = Math.floor(x / tamañoCelda);
    let celdaY = Math.floor(y / tamañoCelda);
    let claveZona = celdaX + "_" + celdaY;

    // Inicializar la zona si no existe
    if (!mapaZonas[claveZona]) {
        mapaZonas[claveZona] = 0;
    }

    // Verificar si esta zona ya llegó al límite
    if (mapaZonas[claveZona] >= maximoPorZona) {
        return;
    }

    // Tamaño dinámico basado en el nivel de sonido
    let tamañoDinamico = map(volumen, 0.005, 0.5, 300, 700);
    tamañoDinamico = constrain(tamañoDinamico, 300, 700);

    // Rotación basada en el nivel de sonido - rango completo
    let rotacion = map(volumen, 0, 1, 0, TWO_PI * 2);

    // Obtener un color disponible de la paleta actual
    let colorNombre = obtenerColorDisponible();
    
    if (!colorNombre) {
        return;
    }
    
    let colorRGB = paletaActual[colorNombre].rgb;

    // Dibujar con rotación y color
    push();
    translate(x, y);
    rotate(rotacion);
    tint(colorRGB[0], colorRGB[1], colorRGB[2]);
    imageMode(CENTER);
    image(pincelActual, 0, 0, tamañoDinamico, tamañoDinamico);
    imageMode(CORNER);
    noTint();
    pop();

    // Incrementar contadores
    usosPinceles[pincelNombre]++;
    mapaZonas[claveZona]++;
    paletaActual[colorNombre].trazosActuales++;

}

function mousePressed() {
    if (audioIniciado) {
        background(255);
        return;
    }

    userStartAudio().then(() => {
        mic.start(); 
        audioIniciado = true;
        background(255); 
        console.log("Micrófono activado. Haz ruido para dibujar.");
    }).catch(e => {
        console.error("Error al iniciar el audio:", e);
    });
}