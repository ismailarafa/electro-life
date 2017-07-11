var plan = ['############################', '#      #    #      o      ##', '#                          #', '#          #####           #', '##         #   #    ##     #', '###           ##  ~  #     #', '#         ~ ###      #     #', '#   ####                   #', '#   ##       o             #', '# o  #         o       ### #', '#    #                     #', '############################'];
var directions;
var i;
var actionTypes;
var game;
var valley;
var jungle;
var directionNames = 'n ne e se s sw w nw'.split(' ');

function Vector(x, y) {
  this.x = x;
  this.y = y;
}

Vector.prototype.plus = function (other) {
  return new Vector(this.x + other.x, this.y + other.y);
};

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function Wall() {}

function BouncingCritter() {
  this.direction = randomElement(directionNames);
}

BouncingCritter.prototype.act = function (view) {
  if (view.look(this.direction) !== ' ') {
    this.direction = view.find(' ') || 's';
  }
  return {
    type: 'move',
    direction: this.direction
  };
};

directions = {
  n: new Vector(0, -1),
  ne: new Vector(1, -1),
  e: new Vector(1, 0),
  se: new Vector(1, 1),
  s: new Vector(0, 1),
  sw: new Vector(-1, 1),
  w: new Vector(-1, 0),
  nw: new Vector(-1, -1)
};

function Grid(width, height) {
  this.space = new Array(width * height);
  this.width = width;
  this.height = height;
}

Grid.prototype.isInside = function (vector) {
  return vector.x >= 0 && vector.x < this.width && vector.y >= 0 && vector.y < this.height;
};

Grid.prototype.forEach = function (f, context) {
  var y;
  var x;
  var value;
  for (y = 0; y < this.height; y += 1) {
    for (x = 0; x < this.width; x += 1) {
      value = this.space[x + (y * this.width)];
      if (value !== null) {
        f.call(context, value, new Vector(x, y));
      }
    }
  }
};

Grid.prototype.get = function (vector) {
  return this.space[vector.x + (this.width * vector.y)];
};

Grid.prototype.set = function (vector, value) {
  this.space[vector.x + (this.width * vector.y)] = value;
};

function elementFromChar(legend, ch) {
  var element;
  if (ch === ' ') {
    return null;
  }
  element = new legend[ch]();
  element.originChar = ch;
  return element;
}

function charFromElement(element) {
  if (element === null) {
    return ' ';
  }
  return element.originChar;
}

function View(world, vector) {
  this.world = world;
  this.vector = vector;
}

View.prototype.look = function (dir) {
  var target = this.vector.plus(directions[dir]);
  if (this.world.grid.isInside(target)) {
    return charFromElement(this.world.grid.get(target));
  }
  return '#';
};

View.prototype.findAll = function (ch) {
  var found = [];
  var dir;
  for (dir in directions) {
    if (this.look(dir) === ch) {
      found.push(dir);
    }
  }
  return found;
};

View.prototype.find = function (ch) {
  var found = this.findAll(ch);
  if (found.length === 0) {
    return null;
  }
  return randomElement(found);
};

function World(map, legend) {
  var grid = new Grid(map[0].length, map.length);
  this.grid = grid;
  this.legend = legend;

  map.forEach(function (line, y) {
    var x;
    for (x = 0; x < line.length; x += 1) {
      grid.set(new Vector(x, y), elementFromChar(legend, line[x]));
    }
  });
}

World.prototype.toString = function () {
  var output = '';
  var x;
  var y;
  var element;
  for (y = 0; y < this.grid.height; y += 1) {
    for (x = 0; x < this.grid.width; x += 1) {
      element = this.grid.get(new Vector(x, y));
      output += charFromElement(element);
    }
    output += '\n';
  }
  return output;
};

World.prototype.turn = function () {
  var acted = [];
  this.grid.forEach(function (critter, vector) {
    if (critter.act && acted.indexOf(critter) === -1) {
      acted.push(critter);
      this.letAct(critter, vector);
    }
  }, this);
};

World.prototype.checkDestination = function (action, vector) {
  var dest;
  if (directions.hasOwnProperty(action.direction)) {
    dest = vector.plus(directions[action.direction]);
    if (this.grid.isInside(dest)) {
      return dest;
    }
  }
};

World.prototype.letAct = function (critter, vector) {
  var action = critter.act(new View(this, vector));
  var dest;
  if (action && action.type === 'move') {
    dest = this.checkDestination(action, vector);
    if (dest && this.grid.get(dest) === null) {
      this.grid.set(vector, null);
      this.grid.set(dest, critter);
    }
  }
};

function dirPlus(dir, n) {
  var index = directionNames.indexOf(dir);
  return directionNames[(index + n + 8) % 8];
}

function WallFollower() {
  this.dir = 's';
}

WallFollower.prototype.act = function (view) {
  var start = this.dir;
  if (view.look(dirPlus(this.dir, -3)) !== ' ') {
    start = this.dir;
    this.dir = dirPlus(this.dir, -2);
  }
  while (view.look(this.dir) !== ' ') {
    this.dir = dirPlus(this.dir, 1);
    if (this.dir === start) {
      break;
    }
  }
  return {
    type: 'move',
    direction: this.dir
  };
};

function LifelikeWorld(map, legend) {
  World.call(this, map, legend);
}

LifelikeWorld.prototype = Object.create(World.prototype);

LifelikeWorld.prototype.letAct = function (critter, vector) {
  var action = critter.act(new View(this, vector));
  var handled = action && action.type in actionTypes && actionTypes[action.type].call(this, critter, vector, action);
  if (!handled) {
    critter.energy -= 0.2;
    if (critter.energy <= 0) {
      this.grid.set(vector, null);
    }
  }
};

actionTypes = Object.create(null);

actionTypes.grow = function (critter) {
  critter.energy += 0.5;
  return true;
};

actionTypes.move = function (critter, vector, action) {
  var dest = this.checkDestination(action, vector);
  if (dest === null || critter.energy <= 1 || this.grid.get(dest) !== null) {
    return false;
  }
  critter.energy -= 1;
  this.grid.set(vector, null);
  this.grid.set(dest, critter);
  return true;
};

actionTypes.eat = function (critter, vector, action) {
  var dest = this.checkDestination(action, vector);
  var atDest = dest !== null && this.grid.get(dest);
  if (!atDest || atDest.energy === null) {
    return false;
  }
  critter.energy += atDest.energy;
  this.grid.set(dest, null);
  return true;
};

actionTypes.reproduce = function (critter, vector, action) {
  var baby = elementFromChar(this.legend, critter.originChar);
  var dest = this.checkDestination(action, vector);
  if (dest === null || critter.energy <= 2 * baby.energy || this.grid.get(dest) !== null) {
    return false;
  }
  critter.energy -= 2 * baby.energy;
  this.grid.set(dest, baby);
  return true;
};

function Plant() {
  this.energy = 3 + (Math.random() * 4);
}

Plant.prototype.act = function (view) {
  var space;
  if (this.energy > 20) {
    space = view.find(' ');
    if (space) {
      return {
        type: 'reproduce',
        direction: space
      };
    }
  }
  if (this.energy < 20) {
    return {
      type: 'grow'
    };
  }
};

function PlantEater() {
  this.energy = 20;
}

PlantEater.prototype.act = function (view) {
  var space = view.find(' ');
  var plant = view.find('*');
  var wall = view.find('#');
  if (this.energy > 80 && space) {
    return {
      type: 'reproduce',
      direction: space
    };
  }
  if (plant && this.energy < 80) {
    return {
      type: 'eat',
      direction: plant
    };
  }
  if (space) {
    return {
      type: 'move',
      direction: space
    };
  }
  if (wall) {
    return {
      type: 'move',
      direction: space
    };
  }
};

function Tiger() {
  this.energy = 100;
}

Tiger.prototype.act = function (view) {
  var space = view.find(' ');
  var plant = view.find('*');
  var wall = view.find('#');
  var herbCritter = view.find('O');
  if (this.energy > 120 && space) {
    return {
      type: 'reproduce',
      direction: space
    };
  }
  if (herbCritter && this.energy < 100) {
    return {
      type: 'eat',
      direction: herbCritter
    };
  }
  if (space) {
    return {
      type: 'move',
      direction: space
    };
  }
  if (wall) {
    return {
      type: 'move',
      direction: space
    };
  }
};

game = new World(['############', '#     #    #', '#   ~    ~ #', '#  ##      #', '#  ##  o####', '#          #', '############'], {
  '#': Wall,
  o: BouncingCritter,
  '~': WallFollower
});

valley = new LifelikeWorld(['############################', '#####                 ######', '##   ***                **##', '#   *##**         **  O  *##', '#    ***     O    ##**    *#', '#       O         ##***    #', '#                 ##**     #', '#   O       #*             #', '#*          #**       O    #', '#***        ##**    O    **#', '##****     ###***       *###', '############################'], {
  '#': Wall,
  O: PlantEater,
  '*': Plant,
  '@': Tiger
});

jungle = new LifelikeWorld(['####################################################', '#                 ####         ****              ###', '#   *  @  ##                 ########       OO    ##', '#   *    ##        O O                 ****       *#', '#       ##*                        ##########     *#', '#      ##***  *         ****                     **#', '#* **  #  *  ***      #########                  **#', '#* **  #      *               #   *              **#', '#     ##              #   O   #  ***          ######', '#*            @       #       #   *        O  #    #', '#*                    #  ######                 ** #', '###          ****          ***                  ** #', '#       O                        @         O       #', '#   *     ##  ##  ##  ##               ###      *  #', '#   **         #              *       #####  O     #', '##  **  O   O  #  #    ***  ***        ###      ** #', '###               #   *****                    ****#', '####################################################'], {
  '#': Wall,
  '@': Tiger,
  O: PlantEater,
  '*': Plant
});

for (i = 0; i < 5; i += 1) {
  jungle.turn();
  console.log(jungle.toString());
}
