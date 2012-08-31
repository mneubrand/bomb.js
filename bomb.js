/**
 * bomb.js
 * 
 * Copyright 2012 Markus Neubrand
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


"use strict";

/*
 * What follows is an ungodly mess of spaghetti code.
 * Good luck to anybody who tries to decipher it.
 * May the semicolons be with you...
 */

(function() {
  //Colors
  var darkGreen = "rgb(0,49,0)";
  var lightGreen = "rgb(0,59,0)";
  var veryLightGreen = "rgb(0,69,0)";
  var darkGray = "rgb(21,21,21)";
  var ninja = "rgb(32,32,32)";
  var mediumGray = "rgb(91, 82, 69)";
  var lightGray = "rgb(114,104,92)";
  var veryLightGray = "rgb(128,118,106)";
  var brown = "rgb(73,34,0)";
  var black = "rgb(0,0,0)";
  var white = "rgb(255,255,255)";
  var yellow = "rgb(255,204,0)";
  var lightYellow = "rgb(255,255,140)";
  var orange = "rgb(212,85,0)";
  var red = "rgb(255,0,0)";
  var lightRed = "rgb(255,170,170)";
  var darkRed = "rgb(160,16,0)";
  var face = "rgb(255,204,153)";
  var shade = "rgba(0,0,0,0.2)";
  var background = "rgb(50,81,40)";
  var lightBlue = "rgb(122,148,201)";
  var darkBlue = "rgb(17,42,94)";
  var pageBackground = "rgb(246,221,174)";

  var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

  //Constants
  var width = 19;
  var height = 11;
  var Direction = {
    NORTH: 0,
    EAST:  1,
    SOUTH: 2,
    WEST:  3
  };
  var Mode = {
    SINGLE_PLAYER: 0,
    MULTI_VERSUS:  1,
    MULTI_COOP: 2
  };

  //Menu
  var selectorBomb;
  var controlsDisplayed = false;

  //Globals
  var gameMode;
  var ctx;    
  var sprites;
  var enemies;
  var field = new Array(width);
  var players;
  var dead;
  
  //Timing
  var lastUpdate = 0;
  var cleared;
  var quarter;

  //Pressed keys
  var keyListener;
  var keys = new Array(4);
  var keys2 = new Array(4);

  //Sounds
  var explosionSound
  var plantSound;
  var upgradeSound;
  var movingSound;

  //Main game loop
  function step() {
    var now = Date.now();

    //Update timing
    lastUpdate = now;
    cleared = new Array();
    quarter = Math.floor((lastUpdate%1000)/250);
 
    //Draw sprites and players
    for(var i=0; i<sprites.length + enemies.length + players.length; i++) {
      var sprite;
      if(i < sprites.length) {
        sprite = sprites[i];
      } else if(i < sprites.length + enemies.length) {
        sprite = enemies[i - sprites.length];
      } else {
        sprite = players[i - sprites.length - enemies.length];
	if(sprite == null) {
          continue;
        }
      }
      
      clearField(sprite.x, sprite.y);

      var diff = lastUpdate - sprite.lastMove;
      if(sprite.moving || (sprite.dead && sprite.wasMoving)) {
        var move = getOffsetForDirection(sprite.direction);
        //Once we are over halfway done move to the next field
        if(diff>sprite.moveTime/2 && !sprite.moved) {
          //In case of a moving piece reset the old field
          if(sprite instanceof Bomb || sprite instanceof Golem) {
            field[sprite.x][sprite.y] = null;
          }

          sprite.x += move[0];
          sprite.y += move[1];
          sprite.moved = true;

          //In case of a moving bomb we move the field
          if(sprite instanceof Bomb || sprite instanceof Golem) {
            field[sprite.x][sprite.y] = sprite.field;
          }
        }

        //Clear second tile if we are moving
        var moveX = move[0] * (sprite.moved ? -1 : 1);
        var moveY = move[1] * (sprite.moved ? -1 : 1);
        clearField(sprite.x + moveX, sprite.y + moveY);
      }

      //Check for collision with player
      if(!(sprite instanceof Ninja)) {
        for(var j=0; j<players.length; j++) {
          var player = players[j];
          if(player == null) {
            continue;
          }
          if(player.x == sprite.x && player.y == sprite.y) {
            //If it is an explosion die
            if(sprite instanceof Enemy || sprite instanceof Explosion) {
              die(player);
            } else if(sprite instanceof Upgrade) {
              handleUpgrade(sprite, player);
              field[sprite.x][sprite.y] = null;
              sprites.splice(i--, 1);
            }
          }
        }
      }

      //Check for collision between explosion and enemy or upgrade
      if(sprite instanceof Explosion) {
        for(var j=0; j<enemies.length; j++) {
          if(enemies[j].x == sprite.x 
               && enemies[j].y == sprite.y) {
            enemies[j].die();
          }
        }
        for(var j=0; j<sprites.length; j++) {
          if(sprites[j] instanceof Upgrade
               && sprites[j].x == sprite.x 
               && sprites[j].y == sprite.y) {
            sprites.splice(j, 1);
          }
        }
      }

      handleInput();

      //Translate canvas to sprite position
      ctx.save();
      ctx.translate(20 + sprite.x*40, 40 + sprite.y*40);

      //Draw sprite
      if(sprite.update()) {
        sprites.splice(i--, 1);
      }

      ctx.restore();
    }

    //Draw HUD
    ctx.textAlign = "left";
    ctx.font = "bold 12pt Arial Black";
    ctx.fillStyle = pageBackground;

    if(players[0] != null) {
      rect(50,0,50,40, darkGreen);
      rect(150,0,50,40, darkGreen);
      ctx.fillText("x" + players[0].bombs, 50, 22);
      ctx.fillText("x" + players[0].explosionSize, 150, 22);
    }

    //Draw border
    path([ [20,40], [20+width*40, 40], [20+width*40, 39+height*40], [20, 39+height*40], [20,40] ], darkGreen, true, 2);

    //Draw rounded corners
    drawCorner(20, 40, 0);
    drawCorner(740, 40, Math.PI*0.5);
    drawCorner(740, 440, Math.PI);
    drawCorner(20, 440, Math.PI*1.5);

    if(gameMode != Mode.MULTI_VERSUS && enemies.length == 0) { //TODO
      //Draw game won if no enemies are left (coop/single player) or opponent is dead (versus)
      ctx.font = "bold 72pt Arial Black";
      ctx.textAlign = "center";
      ctx.fillStyle = lightBlue;
      ctx.fillText("GAME WON", 400, 240);

      player.moving = false;
      player.wasMoving = player.wasMoving;

      //Disable controls
      window.onkeydown = null;
      window.onkeyup = null;
      keys = new Array(4);

      window.setTimeout(initBombJs, 3000);
    } else if(dead && lastUpdate - dead > 1000) {
      //Draw game over if we are dead after 1000 ms
      ctx.font = "bold 72pt Arial Black";
      ctx.textAlign = "center";
      ctx.fillStyle = darkRed;
      ctx.fillText("GAME OVER", 400, 240);

      if(gameMode == Mode.MULTI_VERSUS) {
        ctx.font = "bold 48pt Arial Black";
        ctx.textAlign = "center";
        ctx.fillStyle = darkRed;
        ctx.fillText("Player " + (players[0]!=null && !players[0].dead ? "1" : "2") + " won", 400, 340);        
      }
    }

    if(dead && lastUpdate - dead > 3000) {
      initBombJs();
    }
    requestAnimationFrame(step);
  }

  function drawCorner(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    rotateBy(angle);
    var radius = 15;
    ctx.beginPath();
    ctx.moveTo(0, radius);
    ctx.arc(radius, radius, radius, Math.PI, Math.PI * 1.5, false);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, radius);
    ctx.fillStyle = darkGreen;
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }

  function clearField(x, y) {
    var index = x*100 + y;
    if(cleared.indexOf(index)==-1) {
      //Translate canvas to sprite position
      ctx.save();
      ctx.translate(20 + x*40, 40 + y*40);

      //Clear canvas underneath sprite if not already cleared
      rect(0, 0, 40, 40, background);

      //Redraw field if there is anything
      if(field[x][y]!=null) {
       field[x][y].update();
      } 

      //Prevent clearing twice
      cleared.push(index);

      ctx.restore();
    }
  }

  function handleInput() {
    for(var i=0; i<players.length; i++) {
      //Check if and which direction key was pressed last
      var maxIndex = getMaxIndex(i == 0 ? keys : keys2);
      //If we are not moving and a key is pressed trigger a move
      if(maxIndex != -1 && !players[i].moving) {
        players[i].direction = maxIndex;
        movePlayer(players[i]);
      }
    }
  }

  function getMaxIndex(keys) {
    var maximum = 0;
    var maxIndex = -1;
    for(var i=0; i<4; i++) {
      if(keys[i]>maximum) {
        maximum = keys[i];
        maxIndex = i;
      }
    }
    return maxIndex;
  }

  function die(player) {
    //Kill player
    if(!player.dead) {
      player.dead = lastUpdate;
      player.moving = false;
      player.wasMoving = player.wasMoving;
    }

    //Check how many are still alive
    var alive = 0;
    for(var i=0; i<players.length; i++) {
      if(players[i] != null && !players[i].dead) {
        alive++;
      }
    }

    if(!dead && 
         ((gameMode == Mode.MULTI_VERSUS && alive == 1) || 
         (gameMode != Mode.MULTI_VERSUS && alive == 0))) {
      dead = lastUpdate;

      //Disable controls
      window.onkeydown = null;
      window.onkeyup = null;
      keys = new Array(4);
  
      window.setTimeout(initBombJs, 3000);
    }
  }

  /************************/
  /*       Sprites        */
  /************************/
  function Sprite(x, y, draw) {
    this.x = x;
    this.y = y;
    this.initialized = lastUpdate;
    this.draw = draw;
    this.offset = [0, 0];
  }
  Sprite.prototype.update = function() {
    return this.draw();
  }

  //Sprite which can move
  function MovingSprite(x, y, draw) {
    Sprite.call(this, x, y, draw);
    this.moveTime = 400;

    this.lastMove = 0;
    this.moving = false;
    this.moved = false;

    this.move = function() {
      this.lastMove = lastUpdate;         
      this.moving = true;
      this.moved = false;
    }
  }
  MovingSprite.prototype = new Sprite();

  //Sprite which blocks the field underneath it (e.g. Bomb or Upgrade)
  function SpriteField(x, y, sprite) {
    Sprite.call(this, x, y, function() { 
      if(sprite instanceof Bomb) {
       rect(0,0,40,40,darkGreen);
      } else if(sprite instanceof Upgrade) {
       rect(0,0,40,40,red); 
      } else {
       rect(0,0,40,40,yellow); 
      }
    });
    this.sprite = sprite;
  }
  SpriteField.prototype = new Sprite();

  //Sprite which blocks the field underneath player
  function PlayerField(x, y, sprite) {
    this.sprite = sprite;
    Sprite.call(this, x, y, function() { 
       rect(0,0,40,40,darkBlue);
    });
  }
  PlayerField.prototype = new SpriteField();

  function Upgrade(x, y, draw) {
    Sprite.call(this, x, y, draw);
  }
  Upgrade.prototype = new Sprite();

  function Bomb(x, y, player) {
    MovingSprite.call(this, x, y);
    this.scale = 0;
    this.moveTime = 250;
    this.player = player;
    this.draw = function() {
      ctx.translate(2,2);

      if(this.moving) {
        //Update position of the field
        movingOffset(this);
        if(!this.moving) {
          //If move just stopped try scheduling another one
          moveSprite(this);
        }
      }

      //Animate bomb scale
      this.scale++;
      var x = (this.scale%30)/30; //between 0-29
      var scaleFactor = 1.0 + 0.1 * (x > 15 ? 30-x : x);
      ctx.scale(scaleFactor, scaleFactor);

      //Animate spark with 0.25 sec between 2 keyframes
      drawBomb(quarter == 0 || quarter == 2);

      //Trigger explosion when countdown reaches 0
      if(!this.player.timer) {
        var diff = lastUpdate - this.initialized;
        if(diff > 3000) {
          this.explode();
        }
      }
    }
    this.explode = function() {
      explosionSound.play();
      this.player.plantedBombs--;
      field[this.x][this.y] = null;
      triggerExplosion(this);
      sprites.splice(sprites.indexOf(this), 1);
      return true;
    }
  }
  Bomb.prototype = new MovingSprite();

  function DisappearingSprite(x, y, draw) {
    Sprite.call(this, x, y);
    this.draw = function() {
      if(this.clear) {
        ctx.translate(this.clear[0]*40, this.clear[1]*40);
        clear();
        ctx.translate(-this.clear[0]*40, -this.clear[1]*40);
      }
      if(lastUpdate - this.initialized > 750) { 
        //Remove sprite
        clear();
        //Spawn upgrades
        if(draw == drawBurnedTree) {
          spawnUpgrades(this.x, this.y);
        }
        return true;
      } else {
        ctx.translate(this.offset[0], this.offset[1]);        
        draw();
      }
    }    
  }
  DisappearingSprite.prototype = new Sprite();

  function Explosion(x, y, explosion, direction) {
    Sprite.call(this, x, y);
    this.direction = direction;
    this.draw = function() {
      rotateBy(Math.PI * 0.5 * this.direction);

      //Mirror horizontally for SOUTH and WEST pieces
      if(this.direction == Direction.SOUTH || this.direction == Direction.WEST) {
        mirrorHorizontally();
      }

      var diff = lastUpdate - this.initialized;
      if(diff < 450) {
        explosion(diff < 150 ? 0 : (diff < 300 ? 1 : 2));
      } else {
        //Remove explosion after 450ms expire
        clear();
        return true;
      }
    }    
  }
  Explosion.prototype = new Sprite();

  function Ninja(x, y) {
    MovingSprite.call(this, x, y);
    this.direction = Direction.SOUTH;
    this.drawings = new Array();
    this.drawings[Direction.NORTH] = drawBackwardNinja;
    this.drawings[Direction.EAST]  = drawHorizontalNinja;
    this.drawings[Direction.SOUTH] = drawForwardNinja;
    this.drawings[Direction.WEST]  = drawHorizontalNinja;

    this.draw = function() {
      //Animate character with 250ms between keyframes
      var anim = (quarter==0 || quarter==2);

      //Mirror horizontally for WEST facing ninja
      if(this.dead) {
        movingSound.pause();
        ctx.translate(this.offset[0], this.offset[1]);
        var diff = lastUpdate - this.dead;
        //Remove sprite after 3 sec
        if(diff > 3000) {
          clear();
          players[players.indexOf(this)] = null;
        } else {
          drawDeadNinja(anim, !anim);
        }
      } else if(this.moving) {
        movingSound.play();
        movingOffset(this);
        if(this.direction == Direction.WEST) {
          mirrorHorizontally();
        }

        this.drawings[this.direction](anim, !anim);
      } else {
        movingSound.pause();
        if(this.direction == Direction.WEST) {
          mirrorHorizontally();
        }
        this.drawings[this.direction](true, true);
      }
    }    
  }
  Ninja.prototype = new MovingSprite();

  function Enemy(x, y) {
    MovingSprite.call(this, x, y);
    this.direction = Direction.SOUTH;
    this.die = function() {
      var disappear = new DisappearingSprite(this.x, this.y, this.drawDead);
      disappear.offset = this.offset;
      sprites.push(disappear);
      enemies.splice(enemies.indexOf(this), 1);
      field[this.x][this.y] = null;
      if(this.moving) {
        var move = getOffsetForDirection(this.direction);
        if(!this.moved) {
          field[this.x+move[0]][this.y+move[1]] = null;
          disappear.clear = [ move[0], move[1] ];
        } else {
          disappear.clear = [ -move[0], -move[1] ];
        }
      }
    }
  }
  Enemy.prototype = new MovingSprite();

  function Golem(x, y) {
    Enemy.call(this, x, y);

    this.wait = 0;
    this.moveTime = 700;
    this.drawDead = drawDeadGolem;

    this.drawings = new Array();
    this.drawings[Direction.NORTH] = drawForwardGolem;
    this.drawings[Direction.EAST]  = drawHorizontalGolem;
    this.drawings[Direction.SOUTH] = drawForwardGolem;
    this.drawings[Direction.WEST]  = drawHorizontalGolem;

    this.draw = function() {
      //Mirror horizontally for WEST facing golem
      if(this.moving) {
        movingOffset(this);
        if(this.direction == Direction.WEST) {
          mirrorHorizontally();
        }

        //Animate character with 250ms between keyframes
        var anim = (quarter==0 || quarter==2);
        if(anim) {
          rotateBy(0.1);
        } else {
          rotateBy(-0.1);
        }
        this.drawings[this.direction]();
      } else {
        if(this.direction == Direction.WEST) {
          mirrorHorizontally();
        }
        this.drawings[this.direction]();
      
        //Not moving decide if we should wait or move
        if(lastUpdate - this.wait > this.moveTime) {
          if(Math.random() < 0.3) {
            this.wait = lastUpdate;
          } else {
            //Find open directions and try moving
            var open = new Array();
            for(var i = 0; i < 4; i++) {
              var move = getOffsetForDirection(i);
              if(field[this.x+move[0]] != undefined
                   && (field[this.x+move[0]][this.y+move[1]] == null
	                   || field[this.x+move[0]][this.y+move[1]] instanceof PlayerField)) {
                open.push(i);
              }
            }
            if(open.length>0) {
              //Pick a random direction and go
              this.direction = open[Math.floor(Math.random()*open.length)];
              moveSprite(this);
            }
          }
        }
      }
    }    
  }
  Golem.prototype = new Enemy();

  function Ghost(x, y) {
    Enemy.call(this, x, y);

    this.moveTime = 600;
    this.drawDead =  drawDeadGhost;
    this.steps = 0;

    this.drawings = new Array();
    this.drawings[Direction.NORTH] = drawGhost;
    this.drawings[Direction.EAST]  = drawGhost;
    this.drawings[Direction.SOUTH] = drawGhost;
    this.drawings[Direction.WEST]  = drawGhost;

    this.draw = function() {
      //Mirror horizontally for WEST facing ninja
      if(this.moving) {
        movingOffset(this);

        //Animate character with 250ms between keyframes
        if(quarter == 0) {
          ctx.translate(0, 0);
        } else if(quarter == 1) {
          ctx.translate(2, -2);
        } else if(quarter == 2) {
          ctx.translate(0, -4);
        } else {
          ctx.translate(-2, -2);
        }
        var anim = (quarter==0 || quarter==2);
        this.drawings[this.direction](anim);
      } else {
        this.drawings[this.direction](true);
   
        var nearPlayer = false;
        for(var i=0; i<players.length; i++) {
          var player = players[i];
          if(player == null) {
            continue;
          }
          var diffX = this.x - player.x;
          var diffY = this.y - player.y;
          //Check if player is near
          if(Math.abs(diffX) < 3 && diffX != 0 && diffY == 0) {
            //Home in on player
            this.direction = diffX < 0 ? Direction.EAST : Direction.WEST;
            nearPlayer = true;
            break;
          } else if(Math.abs(diffY) < 3 && diffY != 0 && diffX == 0) {
            //Home in on player
            this.direction = diffY < 0 ? Direction.SOUTH : Direction.NORTH;
            nearPlayer = true;
            break;
          } 
        }

        if(!nearPlayer) {
          if(this.steps > 0) {
            this.steps--;
          } else {
            //Pick a random direction and go for 2/4/6 steps in this direction
            this.direction = Math.floor(Math.random()*4);
            this.steps = 2 + 2*(Math.random()*3);
          }
        }
        moveSprite(this);
      }
    }    
  }
  Ghost.prototype = new Enemy();

  function movingOffset(sprite) {
    var diff = lastUpdate - sprite.lastMove;

    //Calculate offset
    var offset = 40 * diff/sprite.moveTime;
    offset = sprite.moved ? -40 + offset : offset; // 0->20 -20->0
    var translateX = sprite.direction == Direction.EAST ? offset : (sprite.direction == Direction.WEST ? -offset : 0);
    var translateY = sprite.direction == Direction.SOUTH ? offset : (sprite.direction == Direction.NORTH ? -offset : 0);
    ctx.translate(translateX, translateY);

    if(diff > sprite.moveTime) {
      sprite.moving = false;
    } else {
      sprite.offset = [ translateX, translateY ];
    }
  }

  /************************/
  /*  Drawing functions   */
  /************************/
  function circle(x, y, radius, fill) {
    arc(x, y, radius, 0, 2*Math.PI, fill);
  }

  function arc(x, y, radius, begin, end, fill, isStroke) {
    ctx.beginPath();
    ctx.arc(x, y, radius, begin, end, false);
    if(isStroke) {
      ctx.strokeStyle = fill;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.closePath();
  }

  function rect(x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }

  function ellipse(x, y, w, h, fill) {
    var kappa = .5522848;
    var ox = (w / 2) * kappa; // control point offset horizontal
    var oy = (h / 2) * kappa; // control point offset vertical
    var xe = x + w;           // x-end
    var ye = y + h;           // y-end
    var xm = x + w / 2;       // x-middle
    var ym = y + h / 2;       // y-middle

    ctx.beginPath();
    ctx.moveTo(x, ym);
    ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
    ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
    ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
    ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.closePath();
  }

  function path(points, fill, isStroke, width) {
    width = width || 2;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for(var i=1; i<points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    if(isStroke) {
      ctx.strokeStyle = fill;
      ctx.lineWidth = width;
      ctx.stroke();
    } else {
      ctx.lineTo(points[0][0], points[0][1]);
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.closePath();    
  }

  function roundedRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, Math.PI*1.5);
    ctx.lineTo(x + w - 2*r, y);
    ctx.arc(x + w - r, y + r, r, Math.PI*1.5, Math.PI*2);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w - r, y + h - r, r, 0, Math.PI*0.5);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + h - r, r, Math.PI*0.5, Math.PI);
    ctx.lineTo(x, y + r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /************************/
  /*    Sprite drawing    */
  /************************/
  function clear() {
    //Clear canvas underneath sprite
    rect(0, 0, 40, 40, background);
  }

  function drawTree() {
    //Circle shade at the bottom
    ellipse(5, 28, 30, 10, shade);
    //Trunk
    path([ [9,34], [14,31], [17,20], [22,20], [24,31], [29,34], [19,33] ], brown);
    //Dark outline
    circle(10, 15, 8, darkGreen);
    circle(20, 13, 10, darkGreen);
    circle(30, 16, 8, darkGreen);
    //Light filling
    circle(10, 15, 7, lightGreen);
    circle(20, 13, 9, lightGreen);
    circle(30, 16, 7, lightGreen);
    //Highlight outline
    arc(10, 15, 5, Math.PI, Math.PI * 1.7, veryLightGreen, true);
    arc(20, 13, 7, Math.PI * 1.1, Math.PI * 1.7, veryLightGreen, true);
  }

  function drawGolemBase() {
    //Circle shade at the bottom
    ellipse(7, 30, 26, 6, shade);
    //Base shape
    roundedRect(8, 5, 24, 28, 3, ninja);
  }

  function drawForwardGolem() {
    drawGolemBase();
    //Eyes
    arc(15, 12, 4, Math.PI * 0.1, Math.PI * 1.1, black);
    circle(15, 14, 1, red);
    arc(25, 12, 4, Math.PI * 1.9, Math.PI * 0.9, black);
    circle(25, 14, 1, red);
    //Mouth
    roundedRect(10, 23, 20, 8, 2, black);
    //Teeth
    for(var i=0; i<8; i++) {
      path([ [12,23], [16,23], [14,26] ], white);
      ctx.translate(4,0);
      if(i==3) {
        ctx.translate(-16, 14);
        mirrorVertically();
      }
    }
  }

  function drawDeadGhost() {
    //Circle shade at the bottom
    ellipse(6, 33, 28, 6, shade);
    //Bottom
    circle(11, 30, 3, lightRed);
    circle(17, 30, 3, lightRed);
    circle(23, 30, 3, lightRed);
    circle(29, 30, 3, lightRed);
    //Top
    ellipse(8, 6, 24, 16, lightRed);
    //Middle
    rect(8, 14, 24, 16, lightRed);
    //Eyes
    path([ [12,12], [16,16] ], black, true);
    path([ [16,12], [12,16] ], black, true);
    path([ [24,12], [28,16] ], black, true);
    path([ [28,12], [24,16] ], black, true);
  }

  function drawGhost(anim) {
    //Circle shade at the bottom
    ellipse(6, 33, 28, 6, shade);
    //Bottom
    circle(11, 30, 3, white);
    circle(17, 30, 3, white);
    circle(23, 30, 3, white);
    circle(29, 30, 3, white);
    //Top
    ellipse(8, 6, 24, 16, white);
    //Middle
    rect(8, 14, 24, 16, white);
    //Eyes
    circle(14, 16, 4, shade);
    circle(26, 16, 4, shade);
    circle(14, 17, 2, black);
    circle(26, 17, 2, black);
    //Mouth
    if(anim) {
      ellipse(14, 24, 12, 4, mediumGray);
    } else {
      ellipse(15, 23, 10, 6, mediumGray);
    }
  }

  function drawDeadGolem() {
    drawGolemBase();
    //Eyes
    circle(15, 14, 4, white);
    circle(15, 14, 2, black);
    circle(25, 14, 3, white);
    circle(25, 14, 1, black);
    //Mouth
    roundedRect(10, 23, 20, 8, 2, black);
    //Teeth
    path([ [12,23], [16,23], [14,26] ], white);
    ctx.translate(12,0);
    path([ [12,23], [16,23], [14,26] ], white);
    ctx.translate(-4, 14);
    mirrorVertically();
    path([ [12,23], [16,23], [14,26] ], white);
  }

  function drawHorizontalGolem() {
    drawGolemBase();
    //Eyes
    arc(25, 12, 4, Math.PI * 0.1, Math.PI * 1.1, black);
    circle(26, 14, 1, red);
    //Mouth
    roundedRect(18, 23, 10, 8, 2, black);
    rect(22, 23, 10, 8, black);
    //Teeth
    ctx.translate(7,0);
    for(var i=0; i<6; i++) {
      path([ [12,23], [16,23], [14,26] ], white);
      ctx.translate(4,0);
      if(i==2) {
        ctx.translate(-12, 14);
        mirrorVertically();
      }
    }
  }

  function drawBurnedTree() {
    //Circle shade at the bottom	
    ellipse(7, 29, 26, 8, shade);
    //Trunk
    path([ [9,34], [14,31], [17,20], [22,20], [24,31], [29,34], [19,33] ], darkGray);
    //Branches
    path([ [19,21], [13,17], [7,21] ], darkGray, true);
    path([ [19,21], [13,17], [11,12] ], darkGray, true);
    path([ [20,21], [21,15], [15,8] ], darkGray, true);
    path([ [21,21], [21,15], [22,5] ], darkGray, true);
    path([ [22,21], [27,17], [30,10] ], darkGray, true);
  }

  function drawStone() {
    //Circle shade at the bottom
    ellipse(3, 25, 36, 13, shade);
    //Dark outline
    path([ [7,31], [9,12], [14,8], [28,8], [32,12], [35,30], [27,35], [14,34] ], darkGray);
    //Light filling
    path([ [8,31], [10,12], [13,9], [27,9], [31,12], [34,30], [26,34], [14,33] ], lightGray);
    //Left shade
    path([ [8,31], [10,12], [16,14], [14,33] ], mediumGray);
    //Right shade
    path([ [26,14], [31,12], [34,30], [26,34] ], mediumGray);
    //Highlight outline
    path([ [10,12], [16,15], [26,15], [31,12] ], veryLightGray, true);
  }

  function drawBomb(bigSpark) {
    //Circle shade at the bottom	
    ellipse(12, 26, 20, 8, shade);
    //Bomb body
    circle(18, 25, 9, black);
    //Highlight outline
    arc(18, 25, 7, Math.PI, Math.PI * 1.5, darkGray, true);
    //Fuse
    path([ [18,25], [27,16] ], black, true);
    //Spark
    circle(27, 16, bigSpark ? 3 : 2, orange);
    circle(27, 16, 1, yellow);
  }

  function drawUpgradeBase() {
    //Background
    rect(4, 4, 32, 32, darkBlue);
    rect(6, 6, 28, 28, lightBlue);
  }

  function drawBombUpgrade() {
    drawUpgradeBase();
    //Bomb
    ctx.save();
    ctx.translate(0,-3);
    drawBomb(true);
    ctx.restore();
  }

  function drawSkatesUpgrade() {
    drawUpgradeBase();
    //Ninja
    ctx.save();
    ctx.translate(20,20);
    ctx.scale(0.7,0.7);
    ctx.translate(-20,-20);
    ctx.translate(5,0);
    drawHorizontalNinja(true, true);
    ctx.restore();    
    //Lines
    path([ [10,12], [17,12] ], white, true, 2);
    path([ [8,17], [15,17] ], white, true, 2);
    path([ [10,22], [17,22] ], white, true, 2);
  }

  function drawKickUpgrade() {
    drawUpgradeBase();
    //Bomb
    ctx.save();
    ctx.translate(20,20);
    ctx.scale(0.7,0.7);
    ctx.translate(-20,-20);
    ctx.translate(7,-3);
    drawBomb(true);
    ctx.restore();    
    //Lines
    path([ [10,15], [17,15] ], white, true, 2);
    path([ [8,20], [15,20] ], white, true, 2);
    path([ [10,25], [17,25] ], white, true, 2);
  }

  function drawNoCollisionUpgrade() {
    drawUpgradeBase();
    //Ninja
    ctx.save();
    ctx.translate(20,20);
    ctx.scale(0.7,0.7);
    ctx.translate(-20,-20);
    ctx.globalAlpha=0.5;
    drawHorizontalNinja(true, true);
    ctx.restore();    
  }

  function drawSizeUpgrade() {
    drawUpgradeBase();
    //Explosion
    ctx.save();
    ctx.translate(20,20);
    ctx.scale(0.5,0.5);
    ctx.translate(-20,-20);
    drawExplosionCenter(2);
    ctx.restore();
  }

  function drawTimerUpgrade() {
    drawUpgradeBase();
    //Circle shade at the bottom	
    ellipse(10, 25, 20, 8, shade);
    //Wooden box
    rect(12, 19, 16, 10, brown);
    //Handle outline
    rect(18, 12, 4, 7, darkGray);
    rect(13, 8, 14, 4, darkGray);
    //Handle highlight
    rect(19, 11, 2, 8, mediumGray);
    rect(14, 9, 12, 2, mediumGray);
  }

  function drawNinjaBase() {
    //Circle shade at the bottom
    ellipse(12, 33, 16, 6, shade);
    //Head
    ellipse(10, 4, 20, 16, ninja);
    //Body
    rect(16, 18, 8, 12, ninja);
    //Bandana
    path([ [12,8], [28,8] ], red, true, 1);
  }

  function drawVerticalNinja(leftArm, rightArm, leftLeg, rightLeg) {
    drawNinjaBase();
    //Left arm
    var leftArmEnd = [13, leftArm ? 27 : 23];
    path([ [16,18], leftArmEnd ], ninja, true);
    circle(leftArmEnd[0], leftArmEnd[1], 2, ninja);
    //Right arm
    var rightArmEnd = [28, rightArm ? 27 : 23];
    path([ [24,18], rightArmEnd ], ninja, true);
    circle(rightArmEnd[0], rightArmEnd[1], 2, ninja);
    //Left leg
    var leftLegEnd = [17, leftLeg ? 36 : 33];
    path([ [18,27], leftLegEnd ], ninja, true);
    circle(leftLegEnd[0], leftLegEnd[1], 2, ninja);
    //Right leg
    var rightLegEnd = [23, rightLeg ? 36 : 33];
    path([ [22,27], rightLegEnd ], ninja, true);
    circle(rightLegEnd[0], rightLegEnd[1], 2, ninja);
  }

  function drawHorizontalNinja(left, right) {
    drawNinjaBase();
    var leftLegEnd, rightLegEnd;
    if(left) {
      leftLegEnd = [18, 36];
      rightLegEnd = [22, 36];
    } else if(right) {
      leftLegEnd = [15, 35];
      rightLegEnd = [25, 35];
    }
    //Left leg
    path([ [18,27], leftLegEnd ], ninja, true);
    circle(leftLegEnd[0], leftLegEnd[1], 2, ninja);
    //Right leg
    path([ [22,27], rightLegEnd ], black, true);
    circle(rightLegEnd[0], rightLegEnd[1], 2, ninja);
    //Arm
    var armEnd = [left ? 28 : 25, 25];
    path([ [20,20], armEnd ], ninja, true);
    circle(armEnd[0], armEnd[1], 2, ninja);
    //Face
    path([ [20,13], [20,9], [25,9], [27,13] ], face);
    //Eyes
    arc(23, 10, 2, Math.PI * 1.9, Math.PI * 0.9, black);
  }

  function drawDeadNinja(left, right) {
    drawNinjaBase();
    //Left arm
    var leftArmEnd = left ? [13, 27] : [10, 10];
    path([ [16,18], leftArmEnd ], ninja, true);
    circle(leftArmEnd[0], leftArmEnd[1], 2, ninja);
    //Right arm
    var rightArmEnd = right ? [28, 27] : [31, 10];
    path([ [24,18], rightArmEnd ], ninja, true);
    circle(rightArmEnd[0], rightArmEnd[1], 2, ninja);
    //Left leg
    var leftLegEnd = [17, left ? 37 : 33];
    path([ [18,27], leftLegEnd ], ninja, true);
    circle(leftLegEnd[0], leftLegEnd[1], 2, ninja);
    //Right leg
    var rightLegEnd = [23, right ? 37 : 33];
    path([ [22,27], rightLegEnd ], ninja, true);
    circle(rightLegEnd[0], rightLegEnd[1], 2, ninja);	
    //Face
    path([ [13,13], [15,9], [25,9], [27,13] ], face);
    //Eyes
    path([ [15,11], [19,11] ], black, true, 1);
    path([ [17,9], [17,13] ], black, true, 1);
    path([ [21,11], [25,11] ], black, true, 1);
    path([ [23,9], [23,13] ], black, true, 1);
  }

  function drawForwardNinja(left, right) {
    drawVerticalNinja(left, right, right, left);	
    //Face
    path([ [13,13], [15,9], [25,9], [27,13] ], face);
    //Eyes
    arc(17, 10, 2, Math.PI * 0.1, Math.PI * 1.1, black);
    arc(23, 10, 2, Math.PI * 1.9, Math.PI * 0.9, black);
  }

  function drawBackwardNinja(left, right) {
    drawVerticalNinja(left, right, right, left);	
    //Knot
    path([ [20,8], [17,11] ], red, true, 1);
    path([ [20,8], [23,11] ], red, true, 1);
  }

  function drawExplosionArm(stage) {
    var inner = stage == 0 ? orange : yellow;
    var outer = stage == 0 ? darkRed : orange;
    if(stage != 0) {
      path([ [8,40], [12,31], [9,20], [13,10], [8,0], [28,0], [31,10], [27,20], [32,29], [28,40] ], darkRed);    
    }
    path([ [11,40], [14,29], [11,20], [15,11], [11,0], [25,0], [27,11], [24,21], [28,30], [25,40] ], outer);
    path([ [14,40], [18,30], [13,21], [17,10], [14,0], [22,0], [25,9], [21,21], [24,30], [22,40] ], inner);
    if(stage == 2) {
      path([ [16,40], [19,30], [17,21], [19,10], [16,0], [20,0], [22,9], [20,21], [21,30], [20,40] ], lightYellow);
    }
  }

  function drawExplosionCenter(stage) {
    var inner = stage == 0 ? orange : yellow;
    var outer = stage == 0 ? darkRed : orange;
    if(stage != 0) {
      path([ [8,40], [12,31], [9,20], [13,10], [8,0], [28,0], [31,10], [27,20], [32,29], [28,40] ], darkRed);    
      rotateBy(Math.PI/2);
      path([ [8,40], [12,31], [9,20], [13,10], [8,0], [28,0], [31,10], [27,20], [32,29], [28,40] ], darkRed);    
      rotateBy(-Math.PI/2);
    }
    path([ [11,40], [14,29], [11,20], [15,11], [11,0], [25,0], [27,11], [24,21], [28,30], [25,40] ], outer);
    rotateBy(Math.PI/2);
    path([ [11,40], [14,29], [11,20], [15,11], [11,0], [25,0], [27,11], [24,21], [28,30], [25,40] ], outer);
    rotateBy(-Math.PI/2);

    path([ [14,40], [18,30], [13,21], [17,10], [14,0], [22,0], [25,9], [21,21], [24,30], [22,40] ], inner);
    rotateBy(Math.PI/2);
    path([ [14,40], [18,30], [13,21], [17,10], [14,0], [22,0], [25,9], [21,21], [24,30], [22,40] ], inner);
    rotateBy(-Math.PI/2);

    if(stage == 2) {
      path([ [16,40], [19,30], [17,21], [19,10], [16,0], [20,0], [22,9], [20,21], [21,30], [20,40] ], lightYellow);
      rotateBy(Math.PI/2);
      path([ [16,40], [19,30], [17,21], [19,10], [16,0], [20,0], [22,9], [20,21], [21,30], [20,40] ], lightYellow);
    }
  }

  function drawExplosionEnd(stage) {
    var inner = stage == 0 ? orange : yellow;
    var outer = stage == 0 ? darkRed : orange;
    if(stage != 0) {
      path([ [8,40], [12,32], [9,18], [21,7], [27,19], [32,31], [28,40] ], darkRed);    
    }
    path([ [11,40], [14,29], [11,20], [21,10], [24,21], [28,30], [25,40] ], outer);
    path([ [14,40], [18,31], [13,22], [21,13], [21,22], [24,31], [22,40] ], inner);
    if(stage == 2) {
      path([ [16,40], [19,31], [17,23], [21,15], [20,23], [21,31], [20,40] ], lightYellow);
    }
  }

  function drawKey(x, y, label) {
    ctx.save();
    ctx.translate(x*40, y*40);

    // Create Linear Gradients
    var lingrad = ctx.createLinearGradient(0,0,38,0);
    lingrad.addColorStop(0, lightGray);
    lingrad.addColorStop(0.5, veryLightGray);
    lingrad.addColorStop(1, lightGray);

    //Background
    roundedRect(2,2,36,36,4,mediumGray);
    roundedRect(6,6,28,28,4,lingrad);

    //Draw text
    ctx.textAlign = "center";
    ctx.font = "bold 10pt Arial";
    ctx.fillStyle = darkGray;
    ctx.fillText(label, 19, 25);

    ctx.restore();
  }

  /************************/
  /*        Helper        */
  /************************/
  function getOffsetForDirection(direction) {
    var ret;
    switch(direction) {
      case Direction.NORTH: ret = [ 0, -1]; break;
      case Direction.EAST:  ret = [ 1,  0]; break;
      case Direction.SOUTH: ret = [ 0,  1]; break;
      case Direction.WEST:  ret = [-1,  0]; break;
    }
    return ret;
  }

  function rotateBy(angle) {
    ctx.translate(20,20);
    ctx.rotate(angle);
    ctx.translate(-20,-20);
  }

  function mirrorHorizontally() {
    ctx.translate(20,20);
    ctx.scale(-1,1);
    ctx.translate(-20,-20);
  }

  function mirrorVertically() {
    ctx.translate(20,20);
    ctx.scale(1,-1);
    ctx.translate(-20,-20);
  }

  /************************/
  /*      Game logic      */
  /************************/
  function triggerExplosion(bomb) {
    var x = bomb.x;
    var y = bomb.y;
    var explosionSize = bomb.player.explosionSize;
 
    //Active branches of the explosion
    var active = [ true, true, true, true ];

    //Other bombs to set off after all sprites of this explosion have been added
    var toExplode = new Array();


    for(var i=1; i<=explosionSize; i++) {
      for(var j=0; j<4; j++) {
        if(active[j]) {
          var move = getOffsetForDirection(j);
          var coordX = x+(move[0]*i);
          var coordY = y+(move[1]*i);
          //Check if coordinates are within bounds
          if(coordX >= 0 && coordX < width
               && coordY >= 0 && coordY < height) {
            //Check if we hit something
            if(field[coordX][coordY]!=null) {
              if(field[coordX][coordY].draw == drawTree) {
                //If we hit a tree burn it
                field[coordX][coordY] = null;
                sprites.push(new DisappearingSprite(coordX, coordY, drawBurnedTree));
                sprites.push(new Explosion(coordX, coordY, drawExplosionEnd, j));
                active[j] = false;
              } else if(field[coordX][coordY].draw == drawStone) {
                //If we hit a stone stop this branch of the explosion
                active[j] = false;
              } else if(field[coordX][coordY] instanceof SpriteField) {
                var sprite = field[coordX][coordY].sprite;
                if(sprite instanceof Bomb) {
                  //If we hit a bomb explode it
                  toExplode.push(sprite);
                }/* else if(sprite instanceof Enemy) { check if this is really necessary
                  //If we hit an enemy burn him
                  sprite.die();
                }*/
              }  
            }
            //Add explosion sprite if we are still active
            if(active[j]) {
              sprites.push(new Explosion(coordX, coordY, i == explosionSize ? drawExplosionEnd : drawExplosionArm, j));
            }
          }
        }
      }
    }

    for(var i=0; i<toExplode.length; i++) {
      toExplode[i].explode();
    }

    //Add explosion center
    sprites.push(new Explosion(x, y, drawExplosionCenter, Direction.NORTH));
  }

  function spawnUpgrades(x, y) {
    var r = Math.random();
    //TODO change to reasonable amount
//    if(r < 0.2) {
    if(r<1.0) {
      r = Math.random();
      var upgrade;
      if(r < 0.16) {
        upgrade = new Upgrade(x, y, drawBombUpgrade);
      } else if(r < 0.32) {
        upgrade = new Upgrade(x, y, drawSizeUpgrade);
      } else if(r < 0.49) {
        upgrade = new Upgrade(x, y, drawSkatesUpgrade);
      } else if(r < 0.66) {
        upgrade = new Upgrade(x, y, drawNoCollisionUpgrade);
      } else if(r < 0.82) {
        upgrade = new Upgrade(x, y, drawTimerUpgrade);
      } else {
        upgrade = new Upgrade(x, y, drawKickUpgrade);
      }
      sprites.push(upgrade);
    }
  }

  function handleUpgrade(sprite, player) {
    upgradeSound.play();
    if(sprite.draw == drawBombUpgrade) {
      //Increase bomb capacity
      player.bombs++;
    } else if(sprite.draw == drawSizeUpgrade) {
      //Increase size of explosion up to 5
      if(player.explosionSize<5) {
        player.explosionSize++;
      }
    } else if(sprite.draw == drawSkatesUpgrade) {
      //Speed up player
      player.moveTime = 250;
    } else if(sprite.draw == drawNoCollisionUpgrade) {
      //Player can walk through bombs and trees
      player.noCollision = true;
    } else if(sprite.draw == drawTimerUpgrade) {
      //Player can detonate bombs
      player.timer = true;
    } else if(sprite.draw == drawKickUpgrade) {
      //Player can kick bombs
      player.kick = true;
    }
  }

  function plantBomb(player) {
    //If there is nothing at the field and we still have bombs left plant a bomb
    if((field[player.x][player.y] == null || field[player.x][player.y] instanceof PlayerField) && player.plantedBombs < player.bombs) {
      plantSound.play();
      var bombSprite = new Bomb(player.x, player.y, player);
      sprites.push(bombSprite);
      var bombField = new SpriteField(player.x, player.y, bombSprite) ;
      bombSprite.field = bombField;
      field[player.x][player.y] = bombField;
      player.plantedBombs++;
    }
  }

  function triggerBombs(player) {
    if(player.timer) {
      //If we have the timer upgrade explode all bombs
      for(var i=0; i<sprites.length; i++) {
        if(sprites[i] instanceof Bomb && sprites[i].player == player) {
          sprites[i].explode();
        }
      }
    }
  }

  function moveSprite(sprite) {
    //Schedule a new move if we are not moving already
    var move = getOffsetForDirection(sprite.direction);
    var coordX = sprite.x+move[0];
    var coordY = sprite.y+move[1];

    if(coordX >= 0 && coordX<width
         && coordY >= 0 && coordY<height
         && !sprite.moving) {
      if(field[coordX][coordY] == null) {
        //Nothing there 
        sprite.move();
        if(!(sprite instanceof Ghost)) {
          field[coordX][coordY] = new SpriteField(coordX,coordY);
        }
      } else if(!(sprite instanceof Bomb) && field[coordX][coordY] instanceof PlayerField) { //or player and we are not a bomb
        sprite.move();
        return true;
      } else if (sprite instanceof Ghost //or ghost
                   && field[coordX][coordY].draw != drawStone //and no stone
                   && !(field[coordX][coordY] instanceof SpriteField)) { //no other enemy or bomb
        sprite.move();
      }
    }
    return false;
  }

  //Check if it's a legal move
  function movePlayer(player) {
    var move = getOffsetForDirection(player.direction);
    var coordX = player.x+move[0];
    var coordY = player.y+move[1];
    var shouldMove = false;
    if(coordX >= 0 && coordX<width
         && coordY >= 0 && coordY<height) {
      if(field[coordX][coordY]==null) { //Check if there is nothing in the way
        shouldMove = true;
      } else if(player.noCollision && field[coordX][coordY].draw != drawStone) { // or noCollision mode and no stone
        shouldMove = true;
        //Kicked a bomb
        if(player.kick && field[coordX][coordY].sprite instanceof Bomb && field[coordX][coordY].sprite.player == player) {
          var bomb = field[coordX][coordY].sprite;
          bomb.direction = player.direction;
          moveSprite(bomb);
        }
      } else if(field[coordX][coordY] instanceof SpriteField) {
        if(field[coordX][coordY].sprite instanceof Bomb && player.kick && field[coordX][coordY].sprite.player == player) { // or kick a bomb
          var bomb = field[coordX][coordY].sprite;
          bomb.direction = player.direction;
          if(moveSprite(bomb)) {
            //Only move if we successfully moved the bomb
            shouldMove = true;       
          }
        } else if(field[coordX][coordY].sprite instanceof Enemy) { // or enemy
          shouldMove = true;
        }
      }
    }

    if(shouldMove) {
      //If the old one was blocked unblock it
      if(field[player.x][player.y] instanceof PlayerField) {
        field[player.x][player.y] = null;
      }
      player.move();
      //If there is nothing there block the field we are moving to
      if(field[coordX][coordY] == null) {
        field[coordX][coordY] = new PlayerField(coordX, coordY);
      }
    }  
  }

  /************************/
  /*    Initialization    */
  /************************/
  function initBombJs() {
    //Initialize globals
    sprites = new Array();
    enemies = new Array();
    dead = null;

    //Get context
    ctx = document.getElementById('c').getContext('2d');

    //Clear canvas
    rect(20, 40, 760, 440, background);

    //Set up field
    for(var i=0; i<width; i++) {
      field[i] = new Array(height);
      for(var j=0; j<height; j++) {
        if(i%2==1 && j%2==1) {
          field[i][j] = new Sprite(i, j, drawStone);
        } else if(!(
                  (i==0 && j==0) || (i==0 && j==1) || (i==1 && j==0) //top left
                  || (i==0 && j==height-1) || (i==0 && j==height-2) || (i==1 && j==height-1) //bottom left
                  || (i==width-1 && j==0) || (i==width-1 && j==1) || (i==width-2 && j==0) //top right
                  || (i==width-1 && j==height-1) || (i==width-1 && j==height-2) || (i==width-2 && j==height-1) //bottom right
                  )) {
          //Non corner
          var rand = Math.random();

          //40% + protect player with 2 trees
          if(rand < 0.4
            || (i==2 && j==0)
            || (i==0 && j==2)
            || (i==width-3 && j==height-1)
            || (i==width-1 && j==height-3)) {
            field[i][j] = new Sprite(i, j, drawTree);
          } else {
            field[i][j] = null;
          }
        } else {
          field[i][j] = null;
        }


        //Draw the field if it's not null
        if(field[i][j]!=null) {
          ctx.save();
          ctx.translate(20 + i*40, 40 + j*40);
          field[i][j].update();
          ctx.restore();
        }
      }
    }

    if(gameMode != Mode.MULTI_VERSUS) {
      //Spawn 13 enemies
      while(enemies.length < 13) {
        var i = parseInt(Math.random() * width);
        var j = parseInt(Math.random() * height);
        if(field[i][j] != null) {
          continue;
        }
        if(Math.random() < 0.7) {
          var golem = new Golem(i, j);
          enemies.push(golem);
          var golemField = new SpriteField(golem.x, golem.y, golem);
          field[i][j] = golemField;
          golem.field = golemField;
        } else {
          var ghost = new Ghost(i, j);
          enemies.push(ghost);
        }
      }
    }

    //Draw HUD
    ctx.save();
    ctx.translate(20, 0);
    ctx.scale(0.7, 0.7);
    drawBomb(true);
    ctx.restore();

    ctx.save();
    ctx.translate(120, 5);
    ctx.scale(0.5, 0.5);
    drawExplosionCenter(2);
    ctx.restore();

    //Set up player
    players = new Array();
    var player = new Ninja(0, 0);
    player.bombs = 1;
    player.plantedBombs = 0;
    player.explosionSize = 1;   
    players.push(player);

    //Set up second player if necessary
    if(gameMode != Mode.SINGLE_PLAYER) {
      player = new Ninja(width - 1, height - 1);
      player.bombs = 1;
      player.plantedBombs = 0;
      player.explosionSize = 1;   
      players.push(player);
    }

    //Set up key listener
    keyListener = function(e) {
      var pressed = e.type == 'keydown';
      switch(e.keyCode) {
        case 38: //up arrow
          keys2[Direction.NORTH] = pressed ? e.timeStamp : 0;
          break;
        case 87: //w
          keys[Direction.NORTH] = pressed ? e.timeStamp : 0;
          break;
        case 39: //right arrow
          keys2[Direction.EAST] = pressed ? e.timeStamp : 0;
          break;
        case 68: //d
          keys[Direction.EAST] = pressed ? e.timeStamp : 0;
          break;
        case 40: //down arrow
          keys2[Direction.SOUTH] = pressed ? e.timeStamp : 0;
          break;
        case 83: //s
          keys[Direction.SOUTH] = pressed ? e.timeStamp : 0;
          break;
        case 37: //left arrow
          keys2[Direction.WEST] = pressed ? e.timeStamp : 0;
          break;
        case 65: //a
          keys[Direction.WEST] = pressed ? e.timeStamp : 0;
          break;
        case 32: //space
          if(players[0]) {
            plantBomb(players[0]);
          }
          break;
        case 86: //v
          if(players[0]) {
            triggerBombs(players[0]);
          }
          break;
        case 18: //alt
          if(players[1]) {
            plantBomb(players[1]);
          }
          break;
        case 17: //ctrl
          if(players[1]) {
            triggerBombs(players[1]);
          }
          break;
      }
    };
    window.onkeyup = keyListener;
    window.onkeydown = keyListener;

    //Set up game loop
    requestAnimationFrame(step);
  }

  function initMenu() {
    if(controlsDisplayed) {
      return;
    }

    //Get context
    ctx = document.getElementById('c').getContext('2d');

    ctx.save();

    //Clear canvas
    if(selectorBomb != null) {
      rect(20, 40, 760, 440, background);
    }

    //Draw rounded corners
    drawCorner(20, 40, 0);
    drawCorner(740, 40, Math.PI*0.5);
    drawCorner(740, 440, Math.PI);
    drawCorner(20, 440, Math.PI*1.5);

    //Draw text
    ctx.textAlign = "left";
    ctx.font = "bold 12pt Arial Black";
    ctx.fillStyle = pageBackground;

    ctx.fillText("Single Player", 8*40, 5*40-13);
    ctx.fillText("2-Player Coop", 8*40, 6*40-13);
    ctx.fillText("2-Player Versus", 8*40, 7*40-13);
    ctx.fillText("Controls/Tutorial", 8*40, 8*40-13);

    //Draw selector bomb
    if(selectorBomb != null) {
      ctx.translate(selectorBomb.x*40, selectorBomb.y*40);
      drawBomb();
      ctx.restore();
      requestAnimationFrame(initMenu);
    }
  }

  function initControls() {
    //Get context
    ctx = document.getElementById('c').getContext('2d');
    ctx.save();

    //Clear canvas
    rect(20, 40, 760, 440, background);

    //Draw rounded corners
    drawCorner(20, 40, 0);
    drawCorner(740, 40, Math.PI*0.5);
    drawCorner(740, 440, Math.PI);
    drawCorner(20, 440, Math.PI*1.5);

    //Draw text
    ctx.textAlign = "left";
    ctx.font = "bold 12pt Arial Black";
    ctx.fillStyle = pageBackground;

    ctx.fillText("Player 1 Controls", 1*40, 2*40-13);
    ctx.fillText("Player 2 Controls", 1*40, 7*40-13);
    ctx.fillText("Upgrades", 13*40, 2*40-13);

    //Draw labels
    ctx.textAlign = "center";
    ctx.font = "10pt Arial";

    ctx.fillText("Movement", 2*40 + 20, 5*40-20);
    ctx.fillText("Movement", 2*40 + 20, 10*40-20);

    ctx.textAlign = "left";
    ctx.fillText("Trigger Bomb (only with Trigger upgrade)", 6*40 + 5, 3*40-16);
    ctx.fillText("Trigger Bomb (only with Trigger upgrade)", 6*40 + 5, 8*40-16);
    ctx.fillText("Plant Bomb", 7*40 + 30, 4*40-16);
    ctx.fillText("Plant Bomb", 6*40 + 5, 9*40-16);

    //Draw keys
    drawKey(2,2,"W");
    drawKey(1,3,"A");
    drawKey(2,3,"S");
    drawKey(3,3,"D");

    drawKey(5,2,"V");

    drawKey(2,7,"↑");
    drawKey(1,8,"←");
    drawKey(2,8,"↓");
    drawKey(3,8,"→");

    drawKey(5,7,"Ctrl");
    drawKey(5,8,"Alt");

    //Draw space
    ctx.save();
    ctx.translate(5*40, 3*40);
    var lingrad = ctx.createLinearGradient(0,0,80,0);
    lingrad.addColorStop(0, lightGray);
    lingrad.addColorStop(0.5, veryLightGray);
    lingrad.addColorStop(1, lightGray);
    roundedRect(2,2,100,36,4,mediumGray);
    roundedRect(6,6,92,28,4,lingrad);
    ctx.restore();

    //Draw upgrades
    var upgrades = [ drawBombUpgrade, drawSizeUpgrade, drawSkatesUpgrade, 
                     drawNoCollisionUpgrade, drawTimerUpgrade, drawKickUpgrade];
    for(var i=0; i<upgrades.length; i++) {
      ctx.save();
      ctx.translate(13*40, (2+i)*40);
      upgrades[i]();
      ctx.restore();
    }

    //Draw upgrade descriptions
    ctx.fillText("Extra Bomb", 14*40 + 5, 3*40-16);
    ctx.fillText("Increase explosion size", 14*40 + 5, 4*40-16);
    ctx.fillText("Faster movement", 14*40 + 5, 5*40-16);
    ctx.fillText("Walk through trees", 14*40 + 5, 6*40-16);
    ctx.fillText("Trigger bombs", 14*40 + 5, 7*40-16);
    ctx.fillText("Kick bombs", 14*40 + 5, 8*40-16);

    //Draw separator
    path([ [500,50], [500,400] ], pageBackground, true, 2);

    //Draw labels
    ctx.textAlign = "center";
    ctx.font = "bold 14pt Arial Black";
    ctx.fillText("Return by pressing space", 400, 450);
  }

  function selectEntry() {
    if(controlsDisplayed) {
      controlsDisplayed = false;
      initMenu();
      return;
    }

    for(var i=1; i<=2; i++) {
      for(var j=0; j<4; j++) {
        var move = getOffsetForDirection(j);
        var coordX = selectorBomb.x+(move[0]*i);
        var coordY = selectorBomb.y+(move[1]*i);

        ctx.save();
        ctx.translate(coordX*40, coordY*40);
        rotateBy(Math.PI * 0.5 * j);
        if(j == 2 || j == 3) {
          mirrorHorizontally();
        }
        i == 2 ? drawExplosionEnd(2) : drawExplosionArm(2);
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(selectorBomb.x*40, selectorBomb.y*40);
    drawExplosionCenter(2);
    ctx.restore();

    if(selectorBomb.y == 7) {
      controlsDisplayed = true;
      window.setTimeout(function() {
        initControls();
      }, 500);
    } else {
      if(selectorBomb.y == 4) {
        gameMode = Mode.SINGLE_PLAYER;
      } else if(selectorBomb.y == 5) {
        gameMode = Mode.MULTI_COOP;
      } else if(selectorBomb.y == 6) {
        gameMode = Mode.MULTI_VERSUS;       
      }
      window.removeEventListener('keyup', keyListener);
      selectorBomb = null;
      window.setTimeout(initBombJs, 500);
    }
    explosionSound.play();
  }

  function initializeSound(synth, params) {
    var soundURL = synth['getWave'](params);
    var audio = new Audio();
    audio.src = soundURL;
    return audio;
  }

  window.onload = function() {
    //Initialize sounds
    var synth = new window['SfxrSynth']();
    movingSound = initializeSound(synth, "0,0.09,0.18,0.2,0.2907,0.0996,,-0.82,-0.8945,-0.466,0.04,0.02,0.22,0.84,-0.0038,0.5484,-0.0768,0.4759,0.9999,0.7727,0.2592,0.0002,-0.986,0.4");
    movingSound.loop = true;
    explosionSound = initializeSound(synth, "3,,0.1572,0.3281,0.422,0.0723,,0.0993,,,,,,,,0.4485,,,1,,,,,0.5");
    plantSound = initializeSound(synth, "0,,0.0589,,0.2623,0.269,,-0.3668,,,,,,0.5726,,,,,1,,,,,0.5");
    upgradeSound = initializeSound(synth, "0,,0.2524,,0.442,0.18,,0.4331,,,,,,0.2551,,0.5655,,,1,,,,,0.5");

    //Set up key listener
    keyListener = function(e) {
      switch(e.keyCode) {
        case 38: //up arrow
        case 87: //w
          selectorBomb.y--;
          if(selectorBomb.y < 4) { selectorBomb.y = 7; }
          break;
        case 40: //down arrow
        case 83: //s
          selectorBomb.y++;
          if(selectorBomb.y > 7) { selectorBomb.y = 4; }
          break;
        case 32: //space
          selectEntry();
          break;
      }
    };
    window.onkeyup = keyListener;

    selectorBomb = new Sprite(7, 4);
    initMenu();
  };
})();
