"use strict";

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
  var darkRed = "rgb(160,16,0)";
  var face = "rgb(255,204,153)";
  var shade = "rgba(0,0,0,0.2)";
  var background = "rgb(50,81,40)";
  var lightBlue = "rgb(122,148,201)";
  var darkBlue = "rgb(17,42,94)";

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

  var fps = 0, fpsFilter = 50;

  //Globals
  var ctx;    
  var sprites = new Array();
  var field = new Array(width);
  var player;
  var bombs = 1;
  var plantedBombs = 0;
  var explosionSize = 1;
  
  //Timing
  var lastUpdate = 0;
  var cleared;
  var quarter;

  //Pressed keys
  var keys = new Array(4);

  //Main game loop
  function step() {
    var now = Date.now();

    //Calculate FPS
    var thisFrameFPS = 1000 / (now - lastUpdate);
    fps += (thisFrameFPS - fps) / fpsFilter;

    //Update timing
    lastUpdate = now;
    cleared = new Array();
    quarter = Math.floor((lastUpdate%1000)/250);
 
    //Draw sprites and player
    for(var i=0; i<=sprites.length; i++) {
      var sprite = i != sprites.length ? sprites[i] : player;
      
      clearField(sprite.x, sprite.y);

      if(sprite.moving) {
        var move = getOffsetForDirection(sprite.direction);
        var diff = lastUpdate - sprite.lastMove;
        //Once we are over halfway done move to the next field
        if(diff>sprite.moveTime/2 && !sprite.moved) {
          //In case of a moving bomb we move the field
          if(sprite instanceof Bomb) {
            field[sprite.x][sprite.y] = null;
          }

          sprite.x += move[0];
          sprite.y += move[1];
          sprite.moved = true;

          //In case of a moving bomb we move the field
          if(sprite instanceof Bomb) {
            field[sprite.x][sprite.y] = sprite.field;
          }
        }

        //Clear second tile if we are moving
        var moveX = move[0] * (sprite.moved ? -1 : 1);
        var moveY = move[1] * (sprite.moved ? -1 : 1);
        clearField(sprite.x + moveX, sprite.y + moveY);
      }

      //Check for collision with player
      if(i!=sprites.length
           && player.x == sprite.x 
           && player.y == sprite.y) {
        //If it is an explosion die
        if(sprite instanceof Explosion) {
          //TODO implement
          console.log('die');
        } else if(sprite instanceof Upgrade) {
          handleUpgrade(sprite);
          sprites.splice(i--, 1);
        }
      }

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
    rect(50,0,50,40, background);
    rect(150,0,50,40, background);

    ctx.font = "bold 12pt sans-serif";
    ctx.fillStyle = darkGreen;
    ctx.fillText("x" + bombs, 50, 22);
    ctx.fillText("x" + explosionSize, 150, 22);

    //Draw border
    path([ [20,40], [20+width*40, 40], [20+width*40, 39+height*40], [20, 39+height*40], [20,40] ], darkGreen, true, 2);

    requestAnimationFrame(step);
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

  /************************/
  /*       Sprites        */
  /************************/
  function Sprite(x, y, draw) {
    this.x = x;
    this.y = y;
    this.initialized = lastUpdate;
    this.draw = draw;
  }
  Sprite.prototype.update = function() {
    return this.draw();
  }

  function MovingSprite(x, y, draw) {
    this.moveTime = 400;
    this.lastMove = 0;
    this.moving = false;
    this.moved = false;
    Sprite.call(this, x, y, draw);
  }
  MovingSprite.prototype = new Sprite();


  function Upgrade(x, y, draw) {
    Sprite.call(this, x, y, draw);
  }
  Upgrade.prototype = new Sprite();

  function Bomb(x, y) {
    Sprite.call(this, x, y);
    this.scale = 0;
    this.draw = function() {
      ctx.translate(2,2);

      if(this.moving) {
        //Update position of the field
        movingOffset(this);
        //If the move finished see if we can schedule a new move
        var move = getOffsetForDirection(this.direction);
        if(!this.moving
            && field[this.x+move[0]][this.y+move[1]] == null) {
          this.lastMove = lastUpdate;   
          this.moving = true;
          this.moved = false;
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
      if(!player.timer) {
        var diff = lastUpdate - this.initialized;
        if(diff > 3000) {
          this.explode();
        }
      }
    }
    this.explode = function() {
      clear();
      plantedBombs--;
      field[this.x][this.y] = null;
      triggerExplosion(this.x, this.y);
      sprites.splice(sprites.indexOf(this), 1);
      return true;
    }
  }
  Bomb.prototype = new MovingSprite();

  function BombField(x, y, bomb) {
    Sprite.call(this, x, y, function() {});
    this.bomb = bomb;
  }
  BombField.prototype = new Sprite();

  function BurnedTree(x, y) {
    Sprite.call(this, x, y);
    this.draw = function() {
      if(lastUpdate - this.initialized > 750) { 
        //Remove tree once countdown reaches 0
        clear();
        //Spawn upgrades
        var r = Math.random();
        if(r < 0.1) {
          r = Math.random();
          if(r < 0.16) {
            sprites.push(new Upgrade(x, y, drawBombUpgrade));
          } else if(r < 0.32) {
            sprites.push(new Upgrade(x, y, drawSizeUpgrade));
          } else if(r < 0.49) {
            sprites.push(new Upgrade(x, y, drawSkatesUpgrade));
          } else if(r < 0.66) {
            sprites.push(new Upgrade(x, y, drawNoCollisionUpgrade));
          } else if(r < 0.82) {
            sprites.push(new Upgrade(x, y, drawTimerUpgrade));
          } else {
            sprites.push(new Upgrade(x, y, drawKickUpgrade));
          }
        }
        return true;
      } else {
        drawBurnedTree();
      }
    }    
  }
  BurnedTree.prototype = new Sprite();

  function Explosion(x, y, explosion, direction) {
    Sprite.call(this, x, y);
    this.direction = direction;
    this.angles = new Array();
    this.angles[Direction.NORTH] = 0;
    this.angles[Direction.EAST]  = Math.PI/2;
    this.angles[Direction.SOUTH] = Math.PI;
    this.angles[Direction.WEST]  = Math.PI*1.5;
    this.draw = function() {
      rotateBy(this.angles[this.direction]);

      //Mirror horizontally for SOUTH and EAST pieces
      if(this.direction == Direction.SOUTH || this.direction == Direction.WEST) {
        ctx.translate(20,20);
        ctx.scale(-1, 1);
        ctx.translate(-20,-20);
      }

      var diff = lastUpdate - this.initialized;
      if(diff < 450) {
        explosion(diff < 150 ? 0 : (diff < 300 ? 1 : 2));
      } else {
        //Remove explosion once countdown reaches 0
        clear();
        return true;
      }
    }    
  }
  Explosion.prototype = new Sprite();

  function Ninja(x, y) {
    Sprite.call(this, x, y);
    this.direction = Direction.SOUTH;
    this.drawings = new Array();
    this.drawings[Direction.NORTH] = drawBackwardNinja;
    this.drawings[Direction.EAST]  = drawRightNinja;
    this.drawings[Direction.SOUTH] = drawForwardNinja;
    this.drawings[Direction.WEST]  = drawLeftNinja;

    this.draw = function() {
      //Check if and which direction key was pressed last
      var maximum = 0;
      var maxIndex = -1;
      for(var i=0; i<4; i++) {
        if(keys[i]>maximum) {
          maximum = keys[i];
          maxIndex = i;
        }
      }

      //If we are not moving and a key is pressed trigger a move
      if(maximum > 0 && !this.moving) {
        this.direction = maxIndex;

        //Check if it's a legal move
        var move = getOffsetForDirection(this.direction);
        var coordX = this.x+move[0];
        var coordY = this.y+move[1];
        if(coordX >= 0 && coordX<width
             && coordY >= 0 && coordY<height) {
          if(field[coordX][coordY]==null //Check if there is nothing in the way
               || (player.noCollision && field[coordX][coordY].draw != drawStone) // or noCollision mode and no stone
               || (player.kick && field[coordX][coordY] instanceof BombField) // or kick and bomb
            ) {
            this.lastMove = lastUpdate;         
            this.moving = true;
            this.moved = false;
            //Kicked a bomb
            if(player.kick && field[coordX][coordY] instanceof BombField) {
              var bomb = field[coordX][coordY].bomb;
              bomb.direction = player.direction;
              bomb.lastMove = lastUpdate;   
              bomb.moving = true;
              bomb.moved = false;
            }
          }
        }
      }

      if(this.moving) {
        movingOffset(this);

        //Animate character with 250ms between keyframes
        var anim = (quarter==0 || quarter==2);
        this.drawings[this.direction](anim, !anim);

      } else {
        this.drawings[this.direction](true, true);
      }
    }    
  }
  Ninja.prototype = new MovingSprite();

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
    //drawSkatesUpgrade(); return;
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
    drawRightNinja(true, true);
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
    drawRightNinja(true, true);
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
    //Clock background
    circle(20, 20, 11, darkGray);
    circle(20, 20, 10, white);
    //Clock face
    ctx.save();
    for(var i=0; i<6; i++) {
      rotateBy(Math.PI/6);
      path([ [20,10], [20,30] ], darkGray, true, 1);
    }
    circle(20, 20, 8, white);
    ctx.restore();
    //Clock hands
    path([ [20,10], [20,20], [25,25] ], black, true, 2);
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
    var leftArmEnd = [13, leftArm ? 24 : 23];
    path([ [16,18], leftArmEnd ], ninja, true);
    circle(leftArmEnd[0], leftArmEnd[1], 2, ninja);
    //Right arm
    var rightArmEnd = [28, rightArm ? 24 : 23];
    path([ [24,18], [28,23] ], ninja, true);
    circle(rightArmEnd[0], rightArmEnd[1], 2, ninja);
    //Left leg
    var leftLegEnd = [17, leftLeg ? 36 : 35];
    path([ [18,27], leftLegEnd ], ninja, true);
    circle(leftLegEnd[0], leftLegEnd[1], 2, ninja);
    //Right leg
    var rightLegEnd = [23, rightLeg ? 36 : 35];
    path([ [22,27], rightLegEnd ], ninja, true);
    circle(rightLegEnd[0], rightLegEnd[1], 2, ninja);
  }

  function drawHorizontalNinja(leftLeg, rightLeg) {
    drawNinjaBase();
    //Left leg
    var leftLegEnd = [18, leftLeg ? 36 : 35];
    path([ [18,27], leftLegEnd ], ninja, true);
    circle(leftLegEnd[0], leftLegEnd[1], 2, ninja);
    //Right leg
    var rightLegEnd = [22, rightLeg ? 36 : 35];
    path([ [22,27], rightLegEnd ], black, true);
    circle(rightLegEnd[0], rightLegEnd[1], 2, ninja);
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

  function drawRightNinja(left, right) {
    drawHorizontalNinja(left, right);	
    //Arm
    var armEnd = [left ? 26 : 25, 25];
    path([ [20,20], armEnd ], ninja, true);
    circle(armEnd[0], armEnd[1], 2, ninja);
    //Face
    path([ [20,13], [20,9], [25,9], [27,13] ], face);
    //Eyes
    arc(23, 10, 2, Math.PI * 1.9, Math.PI * 0.9, black);
  }

  function drawLeftNinja(left, right) {
    drawHorizontalNinja(left, right);	
    //Arm
    var armEnd = [left ? 14 : 15, 25];
    path([ [20,20], armEnd ], ninja, true);
    circle(armEnd[0], armEnd[1], 2, ninja);
    //Face
    path([ [13,13], [15,9], [20,9], [20,13] ], face);
    //Eyes
    arc(17, 10, 2, Math.PI * 0.1, Math.PI * 1.1, black);
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

  /************************/
  /*      Game logic      */
  /************************/
  function triggerExplosion(x, y) {
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
                sprites.push(new BurnedTree(coordX, coordY));
              } else if(field[coordX][coordY].draw == drawStone) {
                //If we hit a stone stop this branch of the explosion
                active[j] = false;
              } else if(field[coordX][coordY] instanceof BombField) {
                //If we hit a bomb explode it
                toExplode.push(field[coordX][coordY].bomb);
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

  function handleUpgrade(sprite) {
    if(sprite.draw == drawBombUpgrade) {
      //Increase bomb capacity
      bombs++;
    } else if(sprite.draw == drawSizeUpgrade) {
      //Increase size of explosion up to 5
      if(explosionSize<5) {
        explosionSize++;
      }
    } else if(sprite.draw == drawSkatesUpgrade) {
      //Speed up player
      player.moveTime = 250;
    }
    else if(sprite.draw == drawNoCollisionUpgrade) {
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

  /************************/
  /*    Initialization    */
  /************************/
  window.initBombJs = function() {
    //Get context
    ctx = document.getElementById('c').getContext('2d');

    //Clear canvas
    rect(0, 0, 800, 480, background);

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
          field[i][j] = Math.random() > 0.5 ? new Sprite(i, j, drawTree) : null;
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
    player = new Ninja(0, 0);

    //Set up key listener
    var keyListener = function(e) {
      var pressed = e.type == 'keydown';
      switch(e.keyCode) {
        case 38: //up arrow
        case 87: //w
          keys[Direction.NORTH] = pressed ? e.timeStamp : 0;
          break;
        case 39: //right arrow
        case 68: //d
          keys[Direction.EAST] = pressed ? e.timeStamp : 0;
          break;
        case 40: //down arrow
        case 83: //s
          keys[Direction.SOUTH] = pressed ? e.timeStamp : 0;
          break;
        case 37: //left arrow
        case 65: //a
          keys[Direction.WEST] = pressed ? e.timeStamp : 0;
          break;
        case 32: //space
          if(field[player.x][player.y] == null && plantedBombs < bombs) {
            var bombSprite = new Bomb(player.x, player.y);
            sprites.push(bombSprite);
            var bombField = new BombField(player.x, player.y, bombSprite) ;
            bombSprite.field = bombField;
            field[player.x][player.y] = bombField;
            plantedBombs++;
          }
          break;
        case 86: //v
          if(player.timer) {
            //If we have the timer upgrade explode all bombs
            for(var i=0; i<sprites.length; i++) {
              if(sprites[i] instanceof Bomb) {
                sprites[i].explode();
              }
            }
          }
          break;
      }
    };
    window.onkeyup = keyListener;
    window.onkeydown = keyListener;

    //Set up game loop
    requestAnimationFrame(step);

    //Set up FPS counter
    setInterval(function(){
      var fpsOut = document.getElementById('fps');
      fpsOut.innerHTML = fps.toFixed(1) + "fps";
    }, 1000);
  };
})();

window.onload = initBombJs;
