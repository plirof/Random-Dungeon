/*
 * Random Dungeon Generator: http://donjon.bin.sh/
 *
 * Adapt by Christophe Matthieu
 * https://github.com/Gorash
 *
 * Creative Commons Attribution-NonCommercial 3.0 Unported License
 * http://creativecommons.org/licenses/by-nc/3.0/
 */
(function (module){ "use strict";

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// example : options

  var dungeon = new RandomDungeon({
    'seed'             : 4,           // int for randomize dungeon
    'n_rows'           : 28,          // must be an odd number
    'n_cols'           : 28,          // must be an odd number
    'dungeon_layout'   : 'Normal',    // "U", "Box", "Cross" or Array of Array
    'room_min'         : 4,           // minimum room size
    'room_max'         : 8,           // maximum room size
    'room_layout'      : 'Scattered', // Packed, Scattered or int (number of try to add a room)
    'corridor_layout'  : 0,           // Labyrinth: 0, Straight: 100
    'remove_deadends'  : 50,          // percentage
    'add_stairs'       : 2,           // number of stairs
    'map_style'        : {            // "Standard", "Black" or object
        'background': '#dddddd',
        'wall':       '#999999',
        'fill':       '#000000',
        'open':       '#FFFFFF',
        'open_grid':  '#CCCCCC',
        'door':       '#aaaaaa',
      },
    'cell_size'        : 18,          // pixels
  });
  console.log(dungeon);
  dungeon.render(canvas, {
      'hightlight': {
        'room': 1,
        'corridor': 2,
        'grid': 'Hex',
      },
      'label': true                   // "Hex", "Square", false
    });

*/


var gdLargeFont = "14px Arial";
var gdSmallFont = "12px Arial";
var gdTinyFont = "10px Arial";


var dungeon_layout = {
  'U':      [[1,0,1],[1,0,1],[1,1,1]],
  'Box':    [[1,1,1],[1,0,1],[1,1,1]],
  'Cross':  [[0,1,0],[1,1,1],[0,1,0]]
};
var map_style = {
  'Standard': {
    'background': '#dddddd',
    'wall':       '#999999',
    'fill':       '#000000',
    'open':       '#FFFFFF',
    'open_grid':  '#CCCCCC'
  },
  'Black': {
    'background': '#000000',
    'wall':       '#000000',
    'fill':       '#000000',
    'open':       '#FFFFFF',
    'open_grid':  '#CCCCCC'
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// cell bits

var NOTHING     = 0;

var BLOCKED     = 1;
var ROOM        = 1<<1;
var CORRIDOR    = 1<<2;

var PERIMETER   = 1<<3;
var ENTRANCE    = 1<<4;

var DOOR        = 1<<5;

var STAIR_DN    = 1<<11;
var STAIR_UP    = 1<<12;

var BETWEEN     = 1<<13;

var _ROOM_ID     = 15;

var OPENSPACE   = ROOM | CORRIDOR | ENTRANCE;
var ESPACE      = ENTRANCE | DOOR;
var STAIRS      = STAIR_DN | STAIR_UP;

var BLOCK_ROOM  = BLOCKED | ROOM;
var BLOCK_CORR  = BLOCKED | PERIMETER | CORRIDOR | ROOM;
var BLOCK_DOOR  = BLOCKED | DOOR;

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// directions

var di = { 'north': -1, 'south':  1, 'west':  0, 'east':  0 };
var dj = { 'north':  0, 'south':  0, 'west': -1, 'east':  1 };
var Dirs = ['north', 'south', 'west', 'east'];

var opposite = {
  'north' : 'south',
  'south' : 'north',
  'west'  : 'east',
  'east'  : 'west'
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// stairs

var stair_end = {
  'north': {
    'walled'   : [[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[1,1]],
    'corridor' : [[0,0],[1,0],[2,0]],
    'stair'    : [0,0],
    'next'     : [1,0]
  },
  'south': {
    'walled'   : [[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1]],
    'corridor' : [[0,0],[-1,0],[-2,0]],
    'stair'    : [0,0],
    'next'     : [-1,0]
  },
  'west': {
    'walled'   : [[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0],[1,1]],
    'corridor' : [[0,0],[0,1],[0,2]],
    'stair'    : [0,0],
    'next'     : [0,1]
  },
  'east': {
    'walled'   : [[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1]],
    'corridor' : [[0,0],[0,-1],[0,-2]],
    'stair'    : [0,0],
    'next'     : [0,-1]
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// cleaning

var close_end = {
  'north': {
    'walled'   : [[0,-1],[1,-1],[1,0],[1,1],[0,1]],
    'close'    : [[0,0]],
    'recurse'  : [-1,0]
  },
  'south': {
    'walled'   : [[0,-1],[-1,-1],[-1,0],[-1,1],[0,1]],
    'close'    : [[0,0]],
    'recurse'  : [1,0]
  },
  'west': {
    'walled'   : [[-1,0],[-1,1],[0,1],[1,1],[1,0]],
    'close'    : [[0,0]],
    'recurse'  : [0,-1]
  },
  'east': {
    'walled'   : [[-1,0],[-1,-1],[0,-1],[1,-1],[1,0]],
    'close'    : [[0,0]],
    'recurse'  : [0,1]
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// imaging

var color_chain = {
  'open_grid'  : 'wall',
  'door'       : 'fill',
  'label'      : 'fill',
  'stair'      : 'wall',
  'wall'       : 'fill',
  'fill'       : 'black'
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// create dungeon

var RandomDungeon = function RandomDungeon (opts) {
  for (var k in opts) {
    this.data[k] = opts[k];
  }
  this.data.maxDoor = this.data.maxDoor || 0;
  this.data.seed = this.data.seed || 0;
  this.data.n_i = this.data.n_rows >> 1;
  this.data.n_j = this.data.n_cols >> 1;
  this.data.n_rows = this.data.n_i << 1;
  this.data.n_cols = this.data.n_j << 1;
  this.data.max_row = this.data.n_rows - 1;
  this.data.max_col = this.data.n_cols - 1;
  this.data.n_rooms = 0;

  var max = this.data.room_max;
  var min = this.data.room_min;
  this.data.room_base = (min + 1) >> 1;
  this.data.room_radix = (max - min) >> 1;

  this.init_cells();
  this.emplace_rooms();
  this.open_rooms();
  this.corridors();
  this.connect_corridors();
  if (this.data.add_stairs) {
    this.emplace_stairs();
  }
  this.clean_dungeon();
  this.data_map();
};
RandomDungeon.prototype.data = {};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// generate random number

RandomDungeon.prototype.RNG = function () {
  return (this.data.seed = (this.data.seed+1) * 16871 % 2147483647) / 2147483647;
};
RandomDungeon.prototype.RNGDouble = function(min,max) {
  return min + (max - min) * this.RNG();
};
RandomDungeon.prototype.RNGInt = function(min,max) {
  min -= 0.4999;
  max += 0.4999;
  return Math.round(min + (max - min) * this.RNG());
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// initialize cells

RandomDungeon.prototype.init_cells = function () {
  this.cells = [];
  for (var r = 0; r <= this.data.n_rows; r++) {
    this.cells[r] = [];
    for (var c = 0; c <= this.data.n_cols; c++) {
      this.cells[r][c] = NOTHING;
    }
  }

  var mask = this.data.dungeon_layout instanceof Array ?
        this.data.dungeon_layout : dungeon_layout[this.data.dungeon_layout];

  if (mask) {
    this.mask_cells(mask);
  } else if (this.data.dungeon_layout === 'Round') {
    this.round_mask();
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// mask cells

RandomDungeon.prototype.mask_cells = function (mask) {
  var r_x = (mask.length / this.data.n_rows);
  var c_x = (mask[0].length / this.data.n_cols);

  for (var r = 0; r < this.data.n_rows; r++) {
    for (var c = 0; c < this.data.n_cols; c++) {
      this.cells[r][c] = mask[Math.floor(r * r_x)][Math.floor(c * c_x)] ? NOTHING : BLOCKED;
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// round mask

RandomDungeon.prototype.round_mask = function () {
  var center_r = Math.floor(this.data.n_rows / 2);
  var center_c = Math.floor(this.data.n_cols / 2);

  for (var r = 0; r <= this.data.n_rows; r++) {
    for (var c = 0; c <= this.data.n_cols; c++) {
      var d = Math.sqrt(Math.pow(r - center_r, 2) + Math.pow(c - center_c, 2));
      if(d > center_c) {
        this.cells[r][c] = BLOCKED;
      }
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// emplace rooms

RandomDungeon.prototype.emplace_rooms = function () {
  this.rooms = [];
  this.doors = [];
  if (this.data.room_layout == 'Packed') {
    this.pack_rooms();
  } else {
    this.scatter_rooms();
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// pack rooms

RandomDungeon.prototype.pack_rooms = function () {
  for (var i = 0; i < this.data.n_i; i++) {
    var r = (i * 2) + 1;
    for (var j = 0; j < this.data.n_j; j++) {
      var c = (j * 2) + 1;

      if ((this.cells[r][c] & ROOM) ||
         ((i == 0 || j == 0) && !this.RNGInt(0,3)))
        continue;

      var proto = { 'i': i, 'j': j };
      this.emplace_room(proto);
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// scatter rooms

RandomDungeon.prototype.scatter_rooms = function () {
  // allocate number of rooms
  var n_rooms;
  if (typeof this.data.room_layout === "number") {
    n_rooms = this.data.room_layout;
  } else {
    var dungeon_area = this.data.n_cols * this.data.n_rows;
    var room_area = this.data.room_max * this.data.room_max;
    n_rooms = Math.floor(dungeon_area / room_area);
  }

  for (var i = 0; i < n_rooms; i++) {
    this.emplace_room({});
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// emplace room

RandomDungeon.prototype.emplace_room = function (proto) {
  if (this.data.n_rooms == 999) return;

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // room position and size

  proto = this.set_room(proto);

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // room boundaries

  var r1 = ( proto.i                       * 2) + 1;
  var c1 = ( proto.j                       * 2) + 1;
  var r2 = ((proto.i + proto.height) * 2) - 1;
  var c2 = ((proto.j + proto.width ) * 2) - 1;

  if (r1 < 1 || r2 > this.data.max_row) return;
  if (c1 < 1 || c2 > this.data.max_col) return;

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // check for collisions with existing rooms

  var hit_list = this.sound_room(r1,c1,r2,c2);
  if (hit_list == null) return;
  if (hit_list.length != 0) return;

  var room_id = this.data.n_rooms || 0;
  this.data.n_rooms++;
  this.data.last_room_id = room_id;

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // emplace room

  for (var r = r1; r <= r2; r++) {
    for (var c = c1; c <= c2; c++) {
      if (this.cells[r][c] & ENTRANCE) {
        this.cells[r][c] &= ~ ESPACE;
      } else if (this.cells[r][c] & PERIMETER) {
        this.cells[r][c] &= ~ PERIMETER;
      }
      this.cells[r][c] |= ROOM | (room_id << _ROOM_ID);
    }
  }
  var height = ((r2 - r1) + 1);
  var width = ((c2 - c1) + 1);

  var room_data = {
    'id': room_id,
    'row': r1,
    'col': c1,
    'north': r1,
    'south': r2,
    'west': c1,
    'east': c2,
    'height': height,
    'width': width,
    'area': (height * width),
    'connect': [],
    'door': {}
  };
  this.rooms[room_id] = room_data;

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // block corridors from room boundary
  // check for door openings from adjacent rooms

  for (var r = r1 - 1; r <= r2 + 1; r++) {
    if (!(this.cells[r][c1 - 1] & (ROOM | ENTRANCE))) {
      this.cells[r][c1 - 1] |= PERIMETER;
    }
    if (!(this.cells[r][c2 + 1] & (ROOM | ENTRANCE))) {
      this.cells[r][c2 + 1] |= PERIMETER;
    }
  }
  for (var c = c1 - 1; c <= c2 + 1; c++) {
    if (!(this.cells[r1 - 1][c] & (ROOM | ENTRANCE))) {
      this.cells[r1 - 1][c] |= PERIMETER;
    }
    if (!(this.cells[r2 + 1][c] & (ROOM | ENTRANCE))) {
      this.cells[r2 + 1][c] |= PERIMETER;
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// room position and size

RandomDungeon.prototype.set_room = function (proto) {
  var base = this.data.room_base;
  var radix = this.data.room_radix;

  if (proto.height == null) {
    if (proto.i != null) {
      var a = this.data.n_i - base - proto.i;
      var r = (a < radix) ? a : radix;
      proto.height = this.RNGInt(0,r) + base;
    } else {
      proto.height = this.RNGInt(0,radix) + base;
    }
  }
  if (proto.width == null) {
    if (proto.j != null) {
      var a = this.data.n_j - base - proto.j;
      if (a < 0) a = 0;
      var r = (a < radix) ? a : radix;
      proto.width = this.RNGInt(0,r) + base;
    } else {
      proto.width = this.RNGInt(0,radix) + base;
    }
  }
  if (proto.i == null) {
    proto.i = this.RNGInt(0,this.data.n_i - proto.height);
  }
  if (proto.j == null) {
    proto.j = this.RNGInt(0,this.data.n_j - proto.width);
  }
  return proto;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// sound room

RandomDungeon.prototype.sound_room = function (r1,c1,r2,c2) {
  var hit = [];
  for (var r = r1; r <= r2; r++) {
    for (var c = c1; c <= c2; c++) {
      if (this.cells[r][c] & BLOCKED) {
        return null;
      }
      if (this.cells[r][c] & ROOM) {
        var id = this.cells[r][c] >> _ROOM_ID;
        if (hit.indexOf(id) === -1) {
          hit.push(id);
        }
      }
    }
  }
  return hit;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// emplace openings for doors and corridors

RandomDungeon.prototype.open_rooms = function () {
  for (var id = 0; id < this.data.n_rooms; id++) {
    this.open_room(this.rooms[id]);
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// emplace openings for doors and corridors

RandomDungeon.prototype.open_room = function (room) {
  var list = this.door_sills(room);
  if (!list || !list.length) return;

  var n_opens = this.alloc_opens(room);

  for (var i = 0; i < n_opens; i++) {
    var sill = list.splice(this.RNGInt(0,list.length-1),1)[0];
    if (!sill) break;
    var door_r = sill.door_r;
    var door_c = sill.door_c;
    var door_cell = this.cells[door_r][door_c];
    if (door_cell & DOOR) continue;

    var out_id = sill.out_id;

    if (out_id != null) {
      if (room.connect.indexOf(this.rooms[out_id].id) !== -1) continue;
      room.connect.push(this.rooms[out_id].id);
      if (this.rooms[out_id].connect.indexOf(room.id) !== -1) continue;
      this.rooms[out_id].connect.push(room.id);
      this.cells[door_r][door_c] |= BETWEEN;
    }

    var open_dir = sill.dir;

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // open door

    var door = this.open_door(door_r, door_c, out_id, room.id);

    for (var x = 0; x < 3; x++) {
      var r = sill.sill_r + (di[open_dir] * x);
      var c = sill.sill_c + (dj[open_dir] * x);
      this.cells[r][c] &= ~ PERIMETER;
      this.cells[r][c] |= ENTRANCE;
    }
    this.cells[door_r][door_c] |= DOOR;

    if (out_id != null) {
      if (this.rooms[out_id].door[opposite[open_dir]] == null)
        this.rooms[out_id].door[opposite[open_dir]] = [];
      this.rooms[out_id].door[opposite[open_dir]].push(door);
    } else {
      this.cells[door_r][door_c] |= CORRIDOR;
    }

    if (room.door[open_dir] == null)
      room.door[open_dir] = [];
    room.door[open_dir].push(door);

    door.id = this.doors.length;
    this.doors.push(door);
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// create door

RandomDungeon.prototype.open_door = function (row, col, out_id, in_id) {
  return {
    'row': row,
    'col': col,
    'out_id': out_id,
    'in_id': in_id
  };
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// allocate number of opens

RandomDungeon.prototype.alloc_opens = function (room) {
  var room_h = ((room.south - room.north) / 2) + 1;
  var room_w = ((room.east - room.west) / 2) + 1;
  var flumph = Math.floor(Math.sqrt(room_w * room_h));
  return flumph + this.RNGInt(0,flumph);
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// list available sills

RandomDungeon.prototype.door_sills = function (room) {
  var list = [];

  if (room.north >= 3) {
    for (var c = room.west; c <= room.east; c += 2) {
      var proto = this.check_sill(room,room.north,c,'north');
      if (proto) list.push(proto);
    }
  }
  if (room.south <= (this.data.n_rows - 3)) {
    for (var c = room.west; c <= room.east; c += 2) {
      var proto = this.check_sill(room,room.south,c,'south');
      if (proto) list.push(proto);
    }
  }
  if (room.west >= 3) {
    for (var r = room.north; r <= room.south; r += 2) {
      var proto = this.check_sill(room,r,room.west,'west');
      if (proto) list.push(proto);
    }
  }
  if (room.east <= (this.data.n_cols - 3)) {
    for (var r = room.north; r <= room.south; r += 2) {
      var proto = this.check_sill(room,r,room.east,'east');
      if (proto) list.push(proto);
    }
  }
  return this.shuffle(list);
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// check sill

RandomDungeon.prototype.check_sill = function (room, sill_r, sill_c, dir) {
  var door_r = sill_r + di[dir];
  var door_c = sill_c + dj[dir];
  var door_cell = this.cells[door_r][door_c];
  if (!(door_cell & PERIMETER)) return;
  if (door_cell & BLOCK_DOOR) return;

  var out_r  = door_r + di[dir];
  var out_c  = door_c + dj[dir];
  var out_cell = this.cells[out_r][out_c];
  if (out_cell & BLOCKED) return;

  var out_id;
  if (out_cell & ROOM) {
    out_id = out_cell >> _ROOM_ID;
    if (out_id == room.id) return;
  }

  return {
    'sill_r'   : sill_r,
    'sill_c'   : sill_c,
    'dir'      : dir,
    'door_r'   : door_r,
    'door_c'   : door_c,
    'out_id'   : out_id,
  };
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// shuffle list

RandomDungeon.prototype.shuffle = function (list) {
  var nlist = [], item;
  while (item = list.splice(this.RNGInt(0,list.length-1),1)[0]) {
    nlist.push(item);
  }
  return nlist;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// generate corridors

RandomDungeon.prototype.corridors = function () {
  for (var i = 1; i < this.data.n_i; i++) {
    var r = (i * 2) + 1;
    for (var j = 1; j < this.data.n_j; j++) {
      var c = (j * 2) + 1;
      if (this.cells[r][c] & CORRIDOR) continue;
      this.tunnel(i,j);
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// recursively tunnel

RandomDungeon.prototype.tunnel = function (i,j,last_dir) {
  var dirs = this.tunnel_dirs(last_dir);
  for (var k=0,len=dirs.length; k<len; k++) {
    var dir = dirs[k];
    if (this.open_tunnel(i,j,dir)) {
      var next_i = i + di[dir];
      var next_j = j + dj[dir];
      this.tunnel(next_i,next_j,dir);
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// tunnel directions

RandomDungeon.prototype.tunnel_dirs = function (last_dir) {
  var p = this.data.corridor_layout;
  var dirs = this.shuffle(Dirs.slice(0,Dirs.length));
  if (last_dir && p) {
    if (this.RNGInt(0,100) < p) {
      dirs.unshift(last_dir);
    }
  }
  return dirs;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// open tunnel

RandomDungeon.prototype.open_tunnel = function (i,j,dir) {
  var this_r = (i * 2) + 1;
  var this_c = (j * 2) + 1;
  var next_r = ((i + di[dir]) * 2) + 1;
  var next_c = ((j + dj[dir]) * 2) + 1;
  var mid_r = (this_r + next_r) / 2;
  var mid_c = (this_c + next_c) / 2;

  var sound = this.sound_tunnel(mid_r,mid_c,next_r,next_c);
  if (sound === 1) {
    return this.delve_tunnel(this_r,this_c,next_r,next_c);
  }
  return 0;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// sound tunnel
// don't open blocked cells, room perimeters, or other corridors

RandomDungeon.prototype.sound_tunnel = function (mid_r,mid_c,next_r,next_c) {
  if (next_r < 0 || next_r > this.data.n_rows) return 0;
  if (next_c < 0 || next_c > this.data.n_cols) return 0;

  var r1 = Math.min(mid_r,next_r);
  var r2 = Math.max(mid_r,next_r);
  var c1 = Math.min(mid_c,next_c);
  var c2 = Math.max(mid_c,next_c);

  for (var r = r1; r <= r2; r++) {
    for (var c = c1; c <= c2; c++) {
      if (this.cells[r][c] & BLOCK_CORR) {
        return 0;
      }
    }
  }
  return 1;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// delve tunnel

RandomDungeon.prototype.delve_tunnel = function (this_r,this_c,next_r,next_c) {
  var r1 = Math.min(this_r,next_r);
  var r2 = Math.max(this_r,next_r);
  var c1 = Math.min(this_c,next_c);
  var c2 = Math.max(this_c,next_c);

  for (var r = r1; r <= r2; r++) {
    for (var c = c1; c <= c2; c++) {
      this.cells[r][c] &= ~ ROOM;
      this.cells[r][c] &= ~ ENTRANCE;
      this.cells[r][c] |= CORRIDOR;
      this.cells[r][c] &= ~ (this.cells[r][c] >> _ROOM_ID << _ROOM_ID);
    }
  }
  return 1;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// emplace stairs

RandomDungeon.prototype.emplace_stairs = function () {
  this.stairs = [];

  var n = this.data.add_stairs;
  if (n <= 0) return;
  var list = this.stair_ends();
  if (!list.length) return;

  for (var i = 0; i < n; i++) {
    var stair = list.splice(this.RNGInt(0,list.length-1),1)[0];
    if (stair == null) return;
    var r = stair.row;
    var c = stair.col;
    var type = (i < 2) ? i : this.RNGInt(0,2);

    if (type === 0) {
      this.cells[r][c] |= STAIR_DN;
      stair.key = 'down';
    } else {
      this.cells[r][c] |= STAIR_UP;
      stair.key = 'up';
    }
    stair.id = this.stairs.length;
    this.stairs.push(stair);
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// list available ends

RandomDungeon.prototype.stair_ends = function () {
  var list = [];
  for (var i = 0; i < this.data.n_i; i++) {
    var r = (i * 2) + 1;
    for (var j = 0; j < this.data.n_j; j++) {
      var c = (j * 2) + 1;
      if (!(this.cells[r][c] & CORRIDOR)) continue;
      if (this.cells[r][c] & STAIRS) continue;

      for (var k in stair_end) {
        var stair = stair_end[k];
        if (this.check_tunnel(r,c,stair)) {
          var end = { 'row': r, 'col': c };
          var n = stair.next;
          end.next_row = end.row + n[0];
          end.next_col = end.col + n[1];
          list.push(end);
        }
      }
    }
  }
  return list;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// entrance corridors (entrance to corridor)

RandomDungeon.prototype.entrance_corridors = function (p,xc) {
  for (var r = 0; r <= this.data.n_rows; r++) {
    for (var c = 0; c <= this.data.n_cols; c++) {
      if ((this.cells[r][c] & ENTRANCE) && !(this.cells[r][c] & (ROOM | DOOR))) {
        this.cells[r][c] &= CORRIDOR;
      }
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// collapse tunnels

RandomDungeon.prototype.collapse_tunnels = function (p,xc) {
  if (p == null) return;
  var all = (p == 100);
  for (var i = 0; i < this.data.n_i; i++) {
    var r = (i * 2) + 1;
    for (var j = 0; j < this.data.n_j; j++) {
      var c = (j * 2) + 1;

      if (!(this.cells[r][c] & OPENSPACE)) continue;
      if (this.cells[r][c] & STAIRS) continue;
      if (!all && (this.RNGInt(0,100) >= p)) continue;

      this.collapse(r,c,xc);
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// connect tunnels

RandomDungeon.prototype.connect_corridors = function () {
  var id = 1;
  this.corridors = [null];
  for (var r = 0; r <= this.data.n_rows; r++) {
    for (var c = 0; c <= this.data.n_cols; c++) {
      if (this.cells[r][c] & CORRIDOR) {
        var corridor = {'id': id};
        corridor.cells = this.connect_corridor(r,c,id);
        if (corridor.cells.length) {
          var door = 0;
          for (var i=0; i<corridor.cells.length; i++) {
            var cell = this.cells[corridor.cells[i].row][corridor.cells[i].col];
            if (cell & DOOR) {
              door += (cell & BETWEEN) ? 2 : 1;
            }
          }
          if (door !== 0) {
            this.corridors.push(corridor);
            id++;
          } else {
            for (var i=0; i<corridor.cells.length; i++) {
              this.cells[corridor.cells[i].row][corridor.cells[i].col] = NOTHING;
            }
          }
        }
      }
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// connect tunnels

RandomDungeon.prototype.data_map = function () {
  this.data_corridors();
  this.map = [];
  var data;
  for (var r = 0; r < this.data.n_rows; r++) {
    this.map[r] = [];
    for (var c = 0; c < this.data.n_cols; c++) {
      if (this.cells[r][c] && this.cells[r][c] != PERIMETER) {
        this.map[r][c] = {'row': r, 'col': c};
        if (this.cells[r][c] & ROOM) {
          this.map[r][c].room = this.cells[r][c] >> _ROOM_ID;
        }
        if (this.cells[r][c] & CORRIDOR) {
          this.map[r][c].corridor = this.cells[r][c] >> _ROOM_ID;
        }
        if (this.cells[r][c] & STAIRS) {
          for (var i=0; i<this.stairs.length; i++) {
            data = this.stairs[i];
            if (data.row == r && data.col == c) this.map[r][c].stair = data.id;
          }
        }
        if (this.cells[r][c] & DOOR) {
          for (var i=0; i<this.doors.length; i++) {
            data = this.doors[i];
            if (data.row == r && data.col == c) this.map[r][c].door = data.id;
          }
        }
      } else {
        this.map[r][c] = null;
      }
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// data corridors

RandomDungeon.prototype.data_corridors = function () {
  var id = 1;
  for (var k = 1; k < this.corridors.length; k++) {
    var corridor = this.corridors[k];
    for (var i=0; i<corridor.cells.length; i++) {
      var tcell = corridor.cells[i];
      var cell = this.cells[tcell.row][tcell.col];

      if (cell & DOOR) {
        if (corridor.doors == null) {
          corridor.doors = [];
          corridor.rooms = [];
        }
        for (var u=0; u<this.doors.length; u++) {
          var door = this.doors[u];
          if (door.row == tcell.row && door.col == tcell.col) {
            corridor.doors.push(door.id);
            if (corridor.rooms.indexOf(door.in_id) === -1) {
              corridor.rooms.push(door.in_id);
            }
            if (door.out_id && corridor.rooms.indexOf(door.out_id) === -1) {
              corridor.rooms.push(door.out_id);
            }
            break;
          }
        }
      }

      if (cell & STAIRS) {
        if (corridor.stairs == null) corridor.stairs = [];
        for (var u=0; u<this.stairs.length; u++) {
          var stair = this.stairs[u];
          if (stair.row == tcell.row && stair.col == tcell.col) {
            corridor.stairs.push(stair.id);
            break;
          }
        }
      }
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// connect tunnel and add id to tunnels

RandomDungeon.prototype.connect_corridor = function (r,c,id) {
  var cells = [];
  var blacklist = [];
  var list = [];
  var dir;
  var n_cols = this.data.n_cols + 1;

  function add(r,c) {
    var hash = r * n_cols + c;
    if (blacklist[hash] == null) {
      list.push([r,c]);
      blacklist[hash] = true;
    }
  }
  add(r,c);

  while (dir = list.pop()) {
    r = dir[0];
    c = dir[1];
    var cell = this.cells[r] && this.cells[r][c];

    if (!cell) continue;
    if (!((cell & CORRIDOR) || ((cell & ENTRANCE) && !(cell & ROOM)))) continue;
    if (cell >> _ROOM_ID) continue;

    this.cells[r][c] |= (id << _ROOM_ID) | CORRIDOR;
    cells.push({'row': r, 'col': c});

    add(r+1,c);
    add(r-1,c);
    add(r,c+1);
    add(r,c-1);
  }
  return cells;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// collapse

RandomDungeon.prototype.collapse = function (r,c,xc) {
  if (!this.cells[r] || !this.cells[r][c] || (this.cells[r][c] & OPENSPACE)) {
    return;
  }
  var p;
  for (var k in xc) {
    var dir = xc[k];
    if (this.check_corridor(r,c,dir)) {
      for (var i in dir.close) {
        p = dir.close[i];
        this.cells[r+p[0]][c+p[1]] = NOTHING;
      }
      if (p = dir.open) {
        this.cells[r+p[0]][c+p[1]] |= CORRIDOR;
      }
      if (p = dir.recurse) {
        this.collapse((r+p[0]),(c+p[1]),xc);
      }
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// check tunnel

RandomDungeon.prototype.check_tunnel = function (r,c,check) {
  var list = [];

  if (list = check.corridor) {
    for (var k in list) {
      var p = list[k];
      if (!(this.cells[r+p[0]][c+p[1]] & CORRIDOR)) return 0;
    }
  }
  if (list = check.walled) {
    for (var k in list) {
      var p = list[k];
      if (this.cells[r+p[0]][c+p[1]] & OPENSPACE) return 0;
    }
  }
  return 1;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// final clean-up

RandomDungeon.prototype.clean_dungeon = function () {
  if (this.data.remove_deadends) {
    // remove deadend corridors
    this.collapse_tunnels(this.data.remove_deadends,close_end);
  }
  this.fix_doors();
  this.fix_rooms();
  this.fix_stairs();
  this.empty_blocks();
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// fix door lists

RandomDungeon.prototype.fix_doors = function () {
  var fixed = [];

  for (var k in this.rooms) {
    var room = this.rooms[k];
    for (var dir in room.door) {
      var shiny = [];
      for (var g in room.door[dir]) {
        var door = room.door[dir][g];
        var door_r = door.row;
        var door_c = door.col;
        var door_cell = this.cells[door_r][door_c];

        if (door_cell & CORRIDOR) {
          door.corridor = door_cell >> _ROOM_ID;
        }
        
        if (!(door_cell & OPENSPACE)) continue;

        if (!fixed[door_r]) fixed[door_r] = [];
        if (fixed[door_r][door_c]) {
          if (fixed[door_r][door_c] === 1) {
            if (shiny.indexOf(door) === -1) shiny.push(door);
          }
        } else {
          // remove double door to same room or corridor
          var number = 0;
          for (var s in shiny) {
            if(shiny[s].out_id === door.out_id || shiny[s].corridor === door.corridor) {
              number++;
              if (number >= this.data.maxDoor) {
                fixed[door_r][door_c] = -1;
                this.cells[door_r][door_c] = PERIMETER;
                continue;
              }
            }
          }
          if (fixed[door_r][door_c]) continue;
          // add door to out room
          if (door.out_id) {
            var out_id = door.out_id;
            var out_dir = opposite[dir];
            if (!this.rooms[out_id].door[out_dir])
              this.rooms[out_id].door[out_dir] = [];
            if (this.rooms[out_id].door[out_dir].indexOf(door) === -1)
              this.rooms[out_id].door[out_dir].push(door);
          }
          if (shiny.indexOf(door) === -1) shiny.push(door);
          fixed[door_r][door_c] = 1;
        }
      }
      if (!shiny.length) {
        delete room.door[dir];
      } else {
        room.door[dir] = shiny;
      }
    }
  }

  this.doors = [];
  for (var k in this.rooms) {
    var room = this.rooms[k];
    for (var dir in room.door) {
      for (var g in room.door[dir]) {
        var door = room.door[dir][g];
        if (this.doors.indexOf(door) === -1) {
          door.id = this.doors.length;
          this.doors.push(door);
        }
      }
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// fix door lists

RandomDungeon.prototype.fix_rooms = function () {
  for (var k in this.rooms) {
    var doors = this.rooms[k].door;
    for (var i in doors) {
      var door = doors[i];
      var list = [];
      for (var u in door) {
        list.push(door[u].id);
      }
      doors[i] = list;
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// fix door lists

RandomDungeon.prototype.fix_stairs = function () {
  for (var k in this.stairs) {
    var stair = this.stairs[k];
    var stair_cell = this.cells[stair.row][stair.col];
    stair.corridor = stair_cell >> _ROOM_ID;
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// empty blocks

RandomDungeon.prototype.empty_blocks = function () {
  for (var r = 0; r <= this.data.n_rows; r++) {
    for (var c = 0; c <= this.data.n_cols; c++) {
      if (this.cells[r][c] & BLOCKED) this.cells[r][c] = NOTHING;
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// get cell content object

RandomDungeon.prototype.get_cell = function (row, col) {
  return this.map[row] && this.map[row][col] || null;
};



// // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// // image dungeon

RandomDungeon.prototype.render = function (canvas, opts) {
  var image = this.scale_dungeon();

  image.hightlight = opts && opts.hightlight || {};
  image.label = opts && opts.label;
  image.grid = opts && opts.grid;

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // new image
  var ctx = canvas.getContext("2d");
  ctx.font = "12px Arial";

  image.palette = this.get_palette(image,ctx);

  this.base_layer(image,ctx);
  this.open_cells(image,ctx);
  this.image_grid(image,ctx);
  this.block_cells(image,ctx);

  if (image.palette.wall) {
    this.image_walls(image,ctx);
  }
  this.image_doors(image,ctx);
  this.image_labels(image,ctx);
  this.image_stairs(image,ctx);
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// scale dungeon

RandomDungeon.prototype.scale_dungeon = function () {
  var image = {
    'cell_size': this.data.cell_size,
    'map_style': this.data.map_style,
  };
  image.width  = ((this.data.n_cols + 1) * this.data.cell_size) + 1;
  image.height = ((this.data.n_rows + 1) * this.data.cell_size) + 1;
  image.max_x  = image.width - 1;
  image.max_y  = image.height - 1;

  if (this.data.cell_size > 16) {
    image.font = gdLargeFont;
  } else if (this.data.cell_size > 12) {
    image.font = gdSmallFont;
  } else {
    image.font = gdTinyFont;
  }
  image.char_w = parseInt(image.font,10);
  image.char_h = parseInt(image.font,10);
  image.char_x = Math.floor((image.cell_size - image.char_w) / 2) + 1;
  image.char_y = Math.floor((image.cell_size - image.char_h) / 2) + 1;

  return image;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// get palette

RandomDungeon.prototype.get_palette = function (image,ctx) {
  var pal = typeof image.map_style === "object" ? image.map_style :
      (map_style[image.map_style] ? map_style[image.map_style] : map_style.Standard);
  if (pal.black == null) {
    pal.black = "#000000";
  }
  if (pal.white == null) {
    pal.white = "#FFFFFF";
  }
  if (pal.hightlight == null) {
    pal.hightlight = "#FFFF00";
  }
  return pal;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// get color

RandomDungeon.prototype.get_color = function (pal,key) {
  while (key) {
    if (pal[key] != null) {
      return pal[key];
    }
    key = color_chain[key];
  }
  return null;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// select tile

RandomDungeon.prototype.select_tile = function (tile,dim) {
  var src_x = this.RNGInt(0,Math.floor(tile.width / dim)) * dim;
  var src_y = this.RNGInt(0,Math.floor(tile.height / dim)) * dim;
  return [src_x,src_y,dim,dim];
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// base dungeon layer

RandomDungeon.prototype.base_layer = function (image,ctx) {
  var max_x = image.max_x;
  var max_y = image.max_y;
  var dim = image.cell_size;
  var pal = image.palette;
  var color;
  var tile;

  if ((tile = pal.background) != null) {
    ctx.strokeStyle = ctx.fillStyle = tile;
    ctx.fillRect(0,0,max_x,max_y);
  } else if ((color = pal.open) != null) {
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.fillRect(0,0,max_x,max_y);
  } else {
    ctx.strokeStyle = ctx.fillStyle = pal.white;
    ctx.fillRect(0,0,max_x,max_y);
  }

  if ((tile = pal.background) != null) {
    ctx.strokeStyle = ctx.fillStyle = tile;
    ctx.fillRect(0,0,max_x,max_y);
  } else {
    ctx.strokeStyle = ctx.fillStyle = pal.white;
    ctx.fillRect(0,0,max_x,max_y);
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// image grid

RandomDungeon.prototype.image_grid = function (image,ctx) {
  if (!image.grid) return;
  if (image.grid == 'Hex') {
    this.hex_grid(image,ctx);
  } else {
    this.square_grid(image,ctx);
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// square grid

RandomDungeon.prototype.square_grid = function (image,ctx) {
  var dim = image.cell_size;

  ctx.lineWidth = 1.0;
  ctx.strokeStyle = this.get_color(image.palette,"open_grid");
  ctx.beginPath();

  for (var x = 0; x <= image.max_x; x += dim) {
    ctx.moveTo(x,0);
    ctx.lineTo(x,image.max_y);
  }
  for (var y = 0; y <= image.max_y; y += dim) {
    ctx.moveTo(0,y);
    ctx.lineTo(image.max_x,y);
  }

  ctx.closePath();
  ctx.stroke();
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// hex grid

RandomDungeon.prototype.hex_grid = function (image,ctx) {
  var dim = image.cell_size;
  var dy = (dim / 2.0);
  var dx = (dim / 3);
  var n_col = (image.width  / (3 * dx))-1;
  var n_row = (image.height /      dy )-1;
  
  ctx.lineWidth = 1;
  ctx.strokeStyle = this.get_color(image.palette,"open_grid");
  ctx.beginPath();

  for (var i = 0; i < n_col; i++) {
    var x1 = (i-0.17) * (3 * dx);
    var x2 = x1 + dx;
    var x3 = x1 + (3 * dx);

    for (var j = 0; j < n_row; j++) {
      var y1 = j * dy;
      var y2 = y1 + dy;

      if ((i + j) % 2) {
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
        ctx.lineTo(x3,y2);
      } else {
        ctx.moveTo(x2,y1);
        ctx.lineTo(x1,y2);
      }
    }
  }

  ctx.closePath();
  ctx.stroke();
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// open cells

RandomDungeon.prototype.open_cells = function (image,ctx) {
  var dim = image.cell_size;
  var room_id = image.hightlight && image.hightlight.room;
  var corridor_id = image.hightlight && image.hightlight.corridor;
  var hightlight = image.hightlight.color || image.palette.hightlight;
  for (var r = 0; r <= this.data.n_rows; r++) {
    var y1 = r * dim;
    var y2 = y1 + dim;
    for (var c = 0; c <= this.data.n_cols; c++) {
      var color = false;
      if(!(this.cells[r][c] & (OPENSPACE | ESPACE))) continue;

      if (room_id != null &&
          (this.cells[r][c] & ROOM) &&
          (this.cells[r][c] >> _ROOM_ID) == room_id) {
        color = hightlight;
      } else if (corridor_id != null &&
          (this.cells[r][c] & CORRIDOR) &&
          !(this.cells[r][c] & DOOR) &&
          (this.cells[r][c] >> _ROOM_ID) == corridor_id) {
        color = hightlight;
      } else {
        color = image.palette.open;
      }

      if (color) {
        var x1 = c * dim;
        var x2 = x1 + dim;
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.fillRect(x1,y1,dim,dim);
      }
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// open cells

RandomDungeon.prototype.block_cells = function (image,ctx) {
  var dim = image.cell_size;
  for (var r = 0; r <= this.data.n_rows; r++) {
    var y1 = r * dim;
    var y2 = y1 + dim;
    for (var c = 0; c <= this.data.n_cols; c++) {
      if(this.cells[r][c] & (OPENSPACE | ESPACE)) continue;

      var color = this.get_color(image.palette, 'wall');

      if (color) {
        var x1 = c * dim;
        var x2 = x1 + dim;
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.fillRect(x1,y1,dim,dim);
      }
    }
  }
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// image walls

RandomDungeon.prototype.image_walls = function (image,ctx) {
  var dim = image.cell_size;
  var pal = image.palette;
  var color;

  ctx.lineWidth = 2;
  for (var r = 0; r <= this.data.n_rows; r++) {
    var y1 = r * dim;
    var y2 = y1 + dim;

    for (var c = 0; c <= this.data.n_cols; c++) {
      var c1 = this.cells[r][c];
      if(!(c1 & OPENSPACE)) continue;
      var x1 = c * dim;
      var x2 = x1 + dim;

      if ((color = pal.wall) != null) {
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.beginPath();
        if (!(this.cells[r-1][c-1] & OPENSPACE)) {
          ctx.fillRect(x1,y1,1,1);
        }
        if (!(this.cells[r-1][c] & OPENSPACE)) {
          ctx.moveTo(x1,y1);
          ctx.lineTo(x2,y1);
        }
        if (!(this.cells[r][c-1] & OPENSPACE)) {
          ctx.moveTo(x1,y1);
          ctx.lineTo(x1,y2);
        }
        if (!(this.cells[r][c+1] & OPENSPACE)) {
          ctx.moveTo(x2,y1);
          ctx.lineTo(x2,y2);
        }
        if (!(this.cells[r+1][c] & OPENSPACE)) {
          ctx.moveTo(x1,y2);
          ctx.lineTo(x2,y2);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
};

// // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// image doors

RandomDungeon.prototype.image_doors = function (image,ctx) {
  var doors = this.doors;
  if (!doors.length) return;

  var dim = image.cell_size;
  var a_px = Math.floor(dim / 6);
  var d_tx = Math.floor(dim / 4);
  var t_tx = Math.floor(dim / 3);
  var pal = image.palette;
  var arch_color = this.get_color(pal,'arch');
  var door_color = this.get_color(pal,'door');
  ctx.lineWidth = 1;

  for (var k=0,len=doors.length; k<len; k++) {
    var door = doors[k];
    var r = door.row;
    var y1 = r * dim;
    var y2 = y1 + dim;
    var c = door.col;
    var x1 = c * dim;
    var x2 = x1 + dim;
    var xc = 0;
    var yc = 0;
    if (this.cells[r][c-1] & OPENSPACE) {
      xc = Math.floor((x1 + x2) / 2);
    } else {
      yc = Math.floor(r * dim + dim/2);
    }

    ctx.beginPath();
    ctx.strokeStyle = ctx.fillStyle = door_color;
    
    if (xc) {
      if (y2-y1 <= 1) {
        ctx.fillRect(xc,y1,1,1);
      } else {
        ctx.lineWidth = Math.ceil(dim/4);
        ctx.moveTo(xc,y1);
        ctx.lineTo(xc,y2);
      }
    } else {
      if (x2-x1 <= 1) {
        ctx.fillRect(x1,yc,1,1);
      } else {
        ctx.lineWidth = Math.ceil(dim/4);
        ctx.moveTo(x1,yc);
        ctx.lineTo(x2,yc);
      }
    }

    ctx.closePath();
    ctx.stroke();
  }
};


// // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// // image labels

RandomDungeon.prototype.image_labels = function (image,ctx) {
    if (!image.label) return;
    var dim = image.cell_size;
    for (var k=0,len=this.rooms.length; k<len; k++) {
      var room = this.rooms[k];
      ctx.strokeStyle = ctx.fillStyle = "#aa0000";
      ctx.fillText(room.id, (room.col+room.width/2-0.2)*dim, (room.row+room.height/2)*dim);
    }
    for (var k=0,len=this.doors.length; k<len; k++) {
      var door = this.doors[k];
      ctx.strokeStyle = ctx.fillStyle = "#9999dd";
      ctx.fillText(k, (door.col+1)*dim, (door.row+1.2)*dim);
    }
};

// // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// // image stairs

RandomDungeon.prototype.image_stairs = function (image,ctx) {
  var list = this.stairs;
  if (!list.length) return;
  var dim = image.cell_size;
  var s_px = Math.floor(dim / 2);
  var t_px = Math.floor(dim / 20) + 2;
  var pal = image.palette;
  var color = this.get_color(pal,'stair');
  var xc, yc, y1, y2, x1, x2, dx, dy;
  ctx.beginPath();
  ctx.strokeStyle = ctx.fillStyle = color;

  for (var k in list) {
    var stair = list[k];
    if (stair.next_row > stair.row) {
      xc = Math.floor((stair.col + 0.5) * dim);
      y1 = stair.row * dim;
      y2 = (stair.next_row + 1) * dim;

      for (var y = y1; y < y2; y += t_px) {
        if (stair.key == 'down') {
          dx = Math.floor(((y - y1) / (y2 - y1)) * s_px);
        } else {
          dx = s_px;
        }
        ctx.moveTo(xc-dx,y);
        ctx.lineTo(xc+dx,y);
      }
    } else if (stair.next_row < stair.row) {
      xc = Math.floor((stair.col + 0.5) * dim);
      y1 = (stair.row + 1) * dim;
      y2 = stair.next_row * dim;

      for (var y = y1; y > y2; y -= t_px) {
        if (stair.key == 'down') {
          dx = Math.floor(((y - y1) / (y2 - y1)) * s_px);
        } else {
          dx = s_px;
        }
        ctx.moveTo(xc-dx,y);
        ctx.lineTo(xc+dx,y);
      }
    } else if (stair.next_col > stair.col) {
      x1 = stair.col * dim;
      x2 = (stair.next_col + 1) * dim;
      yc = Math.floor((stair.row + 0.5) * dim);

      for (var x = x1; x < x2; x += t_px) {
        if (stair.key == 'down') {
          dy = Math.floor(((x - x1) / (x2 - x1)) * s_px);
        } else {
          dy = s_px;
        }
        ctx.moveTo(x,yc-dy);
        ctx.lineTo(x,yc+dy);
      }
    } else if (stair.next_col < stair.col) {
      x1 = (stair.col + 1) * dim;
      x2 = stair.next_col * dim;
      yc = Math.floor((stair.row + 0.5) * dim);

      for (var x = x1; x > x2; x -= t_px) {
        if (stair.key == 'down') {
          dy = Math.floor(((x - x1) / (x2 - x1)) * s_px);
        } else {
          dy = s_px;
        }
        ctx.moveTo(x,yc-dy);
        ctx.lineTo(x,yc+dy);
      }
    }
  }
  ctx.closePath();
  ctx.stroke();
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

module.RandomDungeon = RandomDungeon;
if(typeof module.exports !== 'undefined') module.exports = RandomDungeon;
})(typeof module === 'undefined' ? this : module);

