"use strict";

window.DOMContentLoaded = (function() {
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

  //Constants
  var width = 19;
  var height = 11;
  var Direction = {
    NORTH: 0,
    EAST:  1,
    SOUTH: 2,
    WEST:  3
  };

  //Globals
  var ctx;    
  var sprites = new Array();
  var field = new Array(width);
  var player;

  //Main game loop
  function step() {
    ctx = document.getElementById('c').getContext('2d');

    //Clear canvas
    ctx.fillStyle = "rgb(50,81,40)";  
    ctx.fillRect(0, 0, 800, 480);

    //Draw field
    for(var i=0; i<width; i++) {
      for(var j=0; j<height; j++) {
        if(field[i][j]!=null) {
          ctx.save();
          ctx.translate(20 + i*40, 40 + j*40);
          field[i][j].update();
          ctx.restore();
        }
      }
    }

    //Draw sprites
    for(var i=0; i<sprites.length; i++) {
      ctx.save();
      ctx.translate(20 + sprites[i].x*40, 40 + sprites[i].y*40);
      sprites[i].update();
      ctx.restore();
    }

    //Draw player
    ctx.save();
    ctx.translate(20 + player.x*40, 40 + player.y*40);
    player.update();
    ctx.restore();
        
    requestAnimationFrame(step);
  }

  /************************/
  /*       Sprites        */
  /************************/
  function Sprite(x, y, draw) {
    this.frames = 0;
    this.x = x;
    this.y = y;
    this.draw = draw;
  }
  Sprite.prototype.update = function() {
    this.frames++;
    this.draw();
    if(this.frames > 60) {
      this.frames = 0;
    }
  }

  function Bomb(x, y) {
    Sprite.call(this, x, y);
    this.countdown = 120;
    this.draw = function() {
      this.countdown--;
      ctx.translate(2,2);
      var scaleFactor = this.frames > 30 ? this.frames - 30 : this.frames;
      var scale = 1.0 + 0.1 * (scaleFactor > 15 ? (30-scaleFactor)/30 : scaleFactor/30);
      ctx.scale(scale, scale);
      if(this.frames<15 || (this.frames>30 && this.frames<45)) {
        drawBomb(true);
      } else {
        drawBomb(false);
      }    
      if(this.countdown == 0) { 
        sprites.splice(sprites.indexOf(this), 1);
        triggerExplosion(this.x, this.y);
      }
    }    
  }
  Bomb.prototype = new Sprite();

  function BurnedTree(x, y) {
    Sprite.call(this, x, y);
    this.countdown = 70;
    this.draw = function() {
      this.countdown--;
      drawBurnedTree();
      if(this.countdown == 0) { 
        sprites.splice(sprites.indexOf(this), 1);
      }
    }    
  }
  BurnedTree.prototype = new Sprite();


  function Explosion(x, y, explosion, direction) {
    Sprite.call(this, x, y);
    this.direction = direction;
    this.start = 0;
    this.angles = new Array();
    this.angles[Direction.NORTH] = 0;
    this.angles[Direction.EAST]  = Math.PI/2;
    this.angles[Direction.SOUTH] = Math.PI;
    this.angles[Direction.WEST]  = Math.PI*1.5;
    this.draw = function() {
      this.start++;
      rotateBy(this.angles[this.direction]);
      if(this.direction == Direction.SOUTH || this.direction == Direction.WEST) {
        ctx.translate(20,20);
        ctx.scale(-1, 1);
        ctx.translate(-20,-20);
      }
      explosion(this.start < 10 ? 0 : (this.start < 20 ? 1 : 2));
      if(this.start == 30) {
        sprites.splice(sprites.indexOf(this), 1);
      }
    }    
  }
  Explosion.prototype = new Sprite();

  function Ninja(x, y) {
    Sprite.call(this, x, y);
    this.direction = Direction.SOUTH;
    this.moving = false;
    this.drawings = new Array();
    this.drawings[Direction.NORTH] = drawBackwardNinja;
    this.drawings[Direction.EAST]  = drawRightNinja;
    this.drawings[Direction.SOUTH] = drawForwardNinja;
    this.drawings[Direction.WEST]  = drawLeftNinja;
    this.draw = function() {
      if(!this.moving) {
        this.drawings[this.direction](true, true);
      } else {
        if(this.frames<15 || (this.frames>30 && this.frames<45)) {
          this.drawings[this.direction](true, false);
        } else {
          this.drawings[this.direction](false, true);
        }
      }
    }    
  }
  Ninja.prototype = new Sprite();

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

  function drawBomb(sparkSize) {
    //Circle shade at the bottom	
    ellipse(12, 26, 20, 8, shade);
    //Bomb body
    circle(18, 25, 9, black);
    //Highlight outline
    arc(18, 25, 7, Math.PI, Math.PI * 1.5, darkGray, true);
    //Fuse
    path([ [18,25], [27,16] ], black, true);
    //Spark
    circle(27, 16, sparkSize, orange);
    circle(27, 16, 1, yellow);
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

  function drawNinjaBase() {
    //Circle shade at the bottom
    ellipse(12, 32, 16, 8, shade);
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

  function rotateBy(angle) {
    ctx.translate(20,20);
    ctx.rotate(angle);
    ctx.translate(-20,-20);
  }

  /************************/
  /*      Game logic      */
  /************************/
  function triggerExplosion(x, y, size) {
    size = size || 2;
    for(var i=-size; i<=size; i++) {
      if(x+i>=0 && field[x+i][y]!=null) {
        sprites.push(new BurnedTree(x+i, y));
        field[x+i][y]=null;
      }
      if(y+i>=0 && field[x][y+i]!=null) {
        sprites.push(new BurnedTree(x, y+i));
        field[x][y+i]=null;
      }

      if(i<0) {
        if(x+i>=0) {
          sprites.push(new Explosion(x+i, y, i == -size ? drawExplosionEnd : drawExplosionArm, Direction.WEST));
        }
        if(y+i>=0) {
          sprites.push(new Explosion(x, y+i, i == -size ? drawExplosionEnd : drawExplosionArm, Direction.NORTH));
        }
      } else if(i>0) {
        if(x+i>=0) {
          sprites.push(new Explosion(x+i, y, i == size ? drawExplosionEnd : drawExplosionArm, Direction.EAST));
        }
        if(y+i>=0) {
          sprites.push(new Explosion(x, y+i, i == size ? drawExplosionEnd : drawExplosionArm, Direction.SOUTH));
        }
      }
    }
    sprites.push(new Explosion(x, y, drawExplosionCenter, Direction.NORTH));
  }

  /************************/
  /*    Initialization    */
  /************************/

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
    }
  }

  //Set up player
  player = new Ninja(0, 0);

  //Set up key listener
  window.onkeydown = function(e) {
    switch(e.keyCode) {
      case 38: //up arrow
      case 87: //w
        player.direction = Direction.NORTH;
        player.moving = true;
        break;
      case 39: //right arrow
      case 68: //d
        player.direction = Direction.EAST;
        player.moving = true;
        break;
      case 40: //down arrow
      case 83: //s
        player.direction = Direction.SOUTH;
        player.moving = true;
        break;
      case 37: //left arrow
      case 65: //a
        player.direction = Direction.WEST;
        player.moving = true;
        break;
      case 32: //space
        field[player.x][player.y] = new Bomb(player.x, player.y);
        break;
    }
  };
  window.onkeyup = function(e) {
    switch(e.keyCode) {
      case 38: //up arrow
      case 87: //w
      case 39: //right arrow
      case 68: //d
      case 40: //down arrow
      case 83: //s
      case 37: //left arrow
      case 65: //a
        player.moving = false;
        break;
    }
    player.moving = false;
  };

  //Set up game loop
  var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
  requestAnimationFrame(step);

})();
