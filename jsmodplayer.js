function ModFile(mod) {
  function trimNulls(str) {
    return str.replace(/\x00+$/, '');
  }
  function getWord(str, pos) {
    return (str.charCodeAt(pos) << 8) + str.charCodeAt(pos+1)
  }

  this.data = mod;
  this.samples = [];
  this.sampleData = [];
  this.positions = [];
  this.patternCount = 0;
  this.patterns = [];
  
  this.sampleCount = 31;

  for (var i = 0; i < this.sampleCount; i++) {
    var sampleInfo = mod.substr(20 + i*30, 30);
    var sampleName = trimNulls(sampleInfo.substr(0, 22));
    this.samples[i] = {
      length: getWord(sampleInfo, 22) * 2,
      finetune: sampleInfo.charCodeAt(24),
      volume: sampleInfo.charCodeAt(25),
      repeatOffset: getWord(sampleInfo, 26) * 2,
      repeatLength: getWord(sampleInfo, 28) * 2
    }
  }
  
  this.positionCount = mod.charCodeAt(950);
  this.positionLoopPoint = mod.charCodeAt(951);
  for (var i = 0; i < 128; i++) {
    this.positions[i] = mod.charCodeAt(952+i);
    if (this.positions[i] >= this.patternCount) {
      this.patternCount = this.positions[i]+1;
    }
  }
  
  var identifier = mod.substr(1080, 4);
  
  this.channelCount = 4;
  
  var patternOffset = 1084;
  for (var pat = 0; pat < this.patternCount; pat++) {
    this.patterns[pat] = [];
    for (var row = 0; row < 64; row++) {
      this.patterns[pat][row] = [];
      for (var chan = 0; chan < this.channelCount; chan++) {
        b0 = mod.charCodeAt(patternOffset);
        b1 = mod.charCodeAt(patternOffset + 1);
        b2 = mod.charCodeAt(patternOffset + 2);
        b3 = mod.charCodeAt(patternOffset + 3);
        var eff = b2 & 0x0f;
        this.patterns[pat][row][chan] = {
          sample: (b0 & 0xf0) | (b2 >> 4),
          period: ((b0 & 0x0f) << 8) | b1,
          effect: eff,
          effectParameter: b3
        };
        if (eff == 0x0E) {
          this.patterns[pat][row][chan].extEffect = (b3 & 0xF0) >> 4;
          this.patterns[pat][row][chan].extEffectParameter = (b3 & 0x0F);
        }
        patternOffset += 4;
      }
    }
  }
  
  var sampleOffset = patternOffset;
  for (var s = 0; s < this.sampleCount; s++) {
    this.samples[s].startOffset = sampleOffset;
    this.sampleData[s] = new Uint8Array(this.samples[s].length);
    var i = 0;
    for (var o = sampleOffset, e = sampleOffset + this.samples[s].length; o < e; o++) {
      this.sampleData[s][i] = mod.charCodeAt(o);
      i++;
    }
    sampleOffset += this.samples[s].length;
  }
  
}
/*
  Useful docs
    Explains effect calculations: http://www.mediatel.lu/workshop/audio/fileformat/h_mod.html
*/

/*
ModPeriodTable[ft][n] = the period to use for note number n at finetune value ft.
Finetune values are in twos-complement, i.e. [0,1,2,3,4,5,6,7,-8,-7,-6,-5,-4,-3,-2,-1]
The first table is used to generate a reverse lookup table, to find out the note number
for a period given in the MOD file.
*/
var ModPeriodTable = [
  [1712, 1616, 1524, 1440, 1356, 1280, 1208, 1140, 1076, 1016, 960 , 906,
   856 , 808 , 762 , 720 , 678 , 640 , 604 , 570 , 538 , 508 , 480 , 453,
   428 , 404 , 381 , 360 , 339 , 320 , 302 , 285 , 269 , 254 , 240 , 226,
   214 , 202 , 190 , 180 , 170 , 160 , 151 , 143 , 135 , 127 , 120 , 113,
   107 , 101 , 95  , 90  , 85  , 80  , 75  , 71  , 67  , 63  , 60  , 56 ]];
   
var ModPeriodToNoteNumber = {};
for (var i = 0; i < ModPeriodTable[0].length; i++) {
  ModPeriodToNoteNumber[ModPeriodTable[0][i]] = i;
}

function ModPlayer(mod, rate) {
  /* timing calculations */
  var ticksPerSecond = 7093789.2; /* PAL frequency */
  var ticksPerFrame; /* calculated by setBpm */
  var ticksPerOutputSample = Math.round(ticksPerSecond / rate);
  var ticksSinceStartOfFrame = 0;
  
  function setBpm(bpm) {
    /* x beats per minute => x*4 rows per minute */
    ticksPerFrame = Math.round(ticksPerSecond * 2.5/bpm);
  }
  setBpm(125);
  
  /* initial player state */
  var framesPerRow = 6;
  var currentFrame = 0;
  var currentPattern;
  var currentPosition;
  var currentRow;
  var exLoop = false;    //whether E6x looping is currently set
  var exLoopStart = 0;  //loop point set up by E60
  var exLoopEnd = 0;    //end of loop (where we hit a E6x cmd) for accurate counting
  var exLoopCount = 0;  //loops remaining
  var doBreak = false;  //Bxx, Dxx - jump to order and pattern break
  var  breakPos = 0;
  var  breakRow = 0;
  var delayRows = false; //EEx pattern delay.
  
  var channels = [];
  for (var chan = 0; chan < mod.channelCount; chan++) {
    channels[chan] = {
      playing: false,
      sample: mod.samples[0],
      finetune: 0,
      volume: 0,
      pan: 0x7F,  //unimplemented
      volumeDelta: 0,
      periodDelta: 0,
      fineVolumeDelta: 0,
      finePeriodDelta: 0,
      tonePortaTarget: 0, //target for 3xx, 5xy as period value
      tonePortaDelta: 0,
      tonePortaVolStep: 0, //remember pitch slide step for when 5xx is used
      tonePortaActive: false,
      cut: false,      //tick to cut at, or false if no cut
      delay: false,    //tick to delay note until, or false if no delay
      arpeggioActive: false
    };
  }
  
  function loadRow(rowNumber) {
    currentRow = rowNumber;
    currentFrame = 0;
    doBreak = false;
    breakPos = 0;
    breakRow = 0;

    for (var chan = 0; chan < mod.channelCount; chan++) {
      var channel = channels[chan];
      var prevNote = channel.prevNote;
      var note = currentPattern[currentRow][chan];
      if (channel.sampleNum == undefined) {
          channel.sampleNum = 0;
      }
      if (note.period != 0 || note.sample != 0) {
        channel.playing = true;
        channel.samplePosition = 0;
        channel.ticksSinceStartOfSample = 0; /* that's 'sample' as in 'individual volume reading' */
        if (note.sample != 0) {
          channel.sample = mod.samples[note.sample - 1];
          channel.sampleNum = note.sample - 1;
          channel.volume = channel.sample.volume;
          channel.finetune = channel.sample.finetune;
        }
        if (note.period != 0) { // && note.effect != 0x03
          //the note specified in a tone porta command is not actually played
          channel.noteNumber = ModPeriodToNoteNumber[note.period];
          channel.ticksPerSample = ModPeriodTable[channel.finetune][channel.noteNumber] * 2;
        }
      }
      channel.finePeriodDelta = 0;
      channel.fineVolumeDelta = 0;
      channel.cut = false;
      channel.delay = false;
      channel.retrigger = false;
      channel.tonePortaActive = false;
      if (note.effect != 0 || note.effectParameter != 0) {
        channel.volumeDelta = 0; /* new effects cancel volumeDelta */
        channel.periodDelta = 0; /* new effects cancel periodDelta */
        channel.arpeggioActive = false;
        switch (note.effect) {
          case 0x00: /* arpeggio: 0xy */
            channel.arpeggioActive = true;
            channel.arpeggioNotes = [
              channel.noteNumber,
              channel.noteNumber + (note.effectParameter >> 4),
              channel.noteNumber + (note.effectParameter & 0x0f)
            ]
            channel.arpeggioCounter = 0;
            break;
          case 0x0A: /* volume slide - Axy */
            /* volume decrease by y */
            channel.volumeDelta = -note.effectParameter;
            break;
          case 0x0C: /* volume */
            channel.volume = note.effectParameter;
            break;
          case 0x0F: /* tempo change. <=32 sets ticks/row, greater sets beats/min instead */
            var newSpeed = (note.effectParameter == 0) ? 1 : note.effectParameter; /* 0 is treated as 1 */
            if (newSpeed <= 32) { 
              framesPerRow = newSpeed;
            } else {
              setBpm(newSpeed);
            }
            break;
        }
      }
      
      //for figuring out tone portamento effect
      if (note.period != 0) { channel.prevNote = note; }
      
      if (channel.tonePortaActive == false) {        channel.tonePortaDelta = 0;
        channel.tonePortaTarget = 0;
        channel.tonePortaVolStep = 0;
      }
    }
    
  }
  
  function loadPattern(patternNumber) {
    var row = doBreak ? breakRow : 0;
    currentPattern = mod.patterns[patternNumber];
    loadRow(row);
  }
  
  function loadPosition(positionNumber) {
    //Handle invalid position numbers that may be passed by invalid loop points
    positionNumber = (positionNumber > mod.positionCount - 1) ? 0 : positionNumber;  
    currentPosition = positionNumber;
    loadPattern(mod.positions[currentPosition]);
  }
  
  loadPosition(0);
  
  function getNextPosition() {
    loadPosition(mod.positionLoopPoint);
  }
  
  function getNextRow() {
    /*
      Determine where we're gonna go based on active effect.
      Either:
        break (jump to new pattern),
        do extended loop,
        advance normally
    */
    if (currentRow == 63) {
      getNextPosition();
    } else {
      loadRow(currentRow + 1);
    }
  }

  function doFrame() {
    /* apply volume/pitch slide before fetching row, because the first frame of a row does NOT
    have the slide applied */

    for (var chan = 0; chan < mod.channelCount; chan++) {
      var channel = channels[chan];
      var finetune = channel.finetune;
      if (currentFrame == 0) { /* apply fine slides only once */
        channel.ticksPerSample += channel.finePeriodDelta * 2;
        channel.volume += channel.fineVolumeDelta;
      }
      channel.volume += channel.volumeDelta;
      channel.ticksPerSample += channel.periodDelta * 2;
      
      if (channel.arpeggioActive) {
        channel.arpeggioCounter++;
        var noteNumber = channel.arpeggioNotes[channel.arpeggioCounter % 3];
        channel.ticksPerSample = ModPeriodTable[finetune][noteNumber] * 2;
      }
    }

    currentFrame++;
    if (currentFrame == framesPerRow) {
      currentFrame = 0;
      //Don't advance to reading more rows if pattern delay effect is active
      getNextRow();
    }
  }
  
  this.getSamples = function(sampleCount) {
    samples = new Uint16Array(sampleCount);
    var i = 0;
    while (i < sampleCount) {
      ticksSinceStartOfFrame += ticksPerOutputSample;
      while (ticksSinceStartOfFrame >= ticksPerFrame) {
        doFrame();
        ticksSinceStartOfFrame -= ticksPerFrame;
      }
      
      leftOutputLevel = 0;
      rightOutputLevel = 0;
      for (var chan = 0; chan < mod.channelCount; chan++) {
        var channel = channels[chan];
        if (channel.playing) {
          channel.ticksSinceStartOfSample += ticksPerOutputSample;
          while (channel.ticksSinceStartOfSample >= channel.ticksPerSample) {
            channel.samplePosition++;
            if (channel.sample.repeatLength > 2 && channel.samplePosition >= channel.sample.repeatOffset + channel.sample.repeatLength) {
              channel.samplePosition = channel.sample.repeatOffset;
            } else if (channel.samplePosition >= channel.sample.length) {
              channel.playing = false;
              break;
            } else 
            channel.ticksSinceStartOfSample -= channel.ticksPerSample;
          }
          if (channel.playing) {
            var rawVol = mod.sampleData[channel.sampleNum][channel.samplePosition];
            var vol = (((rawVol + 128) & 0xff) - 128) * channel.volume; /* range (-128*64)..(127*64) */
            if (chan & 3 == 0 || chan & 3 == 3) { /* hard panning(?): left, right, right, left */
              leftOutputLevel += (vol + channel.pan) * 3;
              rightOutputLevel += (vol + 0xFF - channel.pan);
            } else {
              leftOutputLevel += (vol + 0xFF - channel.pan)
              rightOutputLevel += (vol + channel.pan) * 3;
            }
            /* range of outputlevels is 128*64*2*channelCount */
            /* (well, it could be more for odd channel counts) */
          }
        }
      }

      samples[i] = parseInt(32000.0 * leftOutputLevel / (128 * 128 * mod.channelCount) * 0.8);
      samples[i+1] = parseInt(32000.0 * rightOutputLevel / (128 * 128 * mod.channelCount) * 0.8);
      i+=2;
    }
    return samples;
  }
}
