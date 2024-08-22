import { SmartInterval } from "./smartInterval.js";

const $ = document.querySelector.bind(document);
const templates = document.querySelector("#templates").content;

let highlights = new Set();

function buildPlane(radius = 0, name = "") {
  const plane = templates.querySelector(".planes").cloneNode(true);
  plane.dataset.radius = radius;
  plane.querySelector(".name").textContent = name;
  plane.querySelector(".fuel").textContent = `${sim.fuel} / ${sim.fuel} (100%)`;
  $("#plane-container").append(plane);
  
  plane.addEventListener("click", () => {
    plane.querySelector(".info").classList.toggle("show-info");

    if (plane.querySelector(".info").classList.contains("show-info"))
      highlights.add(name);
    else highlights.delete(name);
  });

  if (highlights.has(name))
    plane.click();

  return plane;
}

function destroyPlane(plane) {
  plane.remove();
}

function movePlaneTo(plane, rotation) {
  const x = Math.sin(rotation) / 2;
  const y = Math.cos(rotation) / 2;

  plane.style.left = `calc(${x} * (min(25vw, 50vh) + ${plane.dataset.radius}px))`
  plane.style.top = `calc(${y} * (min(25vw, 50vh) + ${plane.dataset.radius}px))`
}

function updatePlaneFuel(plane, fuel) {
  plane.querySelector(".fuel").textContent = `${fuel.toFixed(1)} / ${sim.fuel} (${Math.round(100 * fuel / sim.fuel)})%`

  plane.classList.toggle("low-fuel", (fuel / sim.fuel) <= 0.1);
}

function getRotation(time) {
  return 2 * Math.PI * time / sim.time;
}

function interpolate(from, to, step, time, callback) {
  let steps = Math.ceil(Math.abs(to - from) / step);
  
  for (let i = 0; i < steps; i++) {
    const progress = i / (steps - 1);
    setTimeout(callback, progress * time, from + (to - from) * progress);
  }

  return new Promise((resolve) => setTimeout(resolve, time));
}

let queues = {};
let planes = {};
let sim = {};

function compile() {
  const lines = $("#program").value.split("\n").map(val => val.trim()).filter(val => val);
  queues = {};

  for (const line of lines) {
    const [arg1, operator, arg2, modifier, ...modifications] = line.toLowerCase().split(" ");
    
    // Comment
    if (arg1.startsWith("@")) continue;

    switch (operator) {
      case "init":
        switch (arg2) {
          case "plane": // Doesn't really do anything special...
            if (!queues[arg1]) queues[arg1] = [];
            break;
          case "time":
            if (isNaN(+arg1) || Math.round(+arg1) != +arg1 || +arg1 <= 0) throw `'init time' arg "${arg1}" is not a valid integer`;
            sim.time = +arg1;
            break;
          case "fuel":
            if (isNaN(+arg1) || Math.round(+arg1) != +arg1 || +arg1 <= 0) throw `'init fuel' arg "${arg1}" is not a valid integer`;
            sim.fuel = +arg1;
            break;
          case "anim":
            if (isNaN(+arg1) || Math.round(+arg1) != +arg1 || +arg1 <= 0) throw `'init anim' arg "${arg1}" is not a valid integer`;
            sim.anim = +arg1;
            break;

          default:
            throw `Invalid 'init' arg "${arg2}`;
        }
        break;
      case "goto":
        if (!queues[arg1]) queues[arg1] = [];
        if (isNaN(+arg2)) throw `'goto' arg "${arg2}" is not a number`;
        queues[arg1].push({
          type: "goto",
          dest: +arg2
        });
        break;
      case "give":
        if (!queues[arg1]) queues[arg1] = [];
        if (modifier == "to") {
          if (isNaN(+arg2)) throw `'give' arg "${arg2} is not a number`;
          if (modifications.join("").trim().length == 0) throw "'give' modification is empty";
          
          queues[arg1].push({
            type: "give",
            amount: +arg2,
            recv: modifications.join(" ").split(",")
          });

          // Init queue for planes within this arg
          modifications.join(" ").split(",").forEach(id => queues[id] ? null : queues[id] = []);
          break;
        }
        throw `Invalid modifier "${modifier}" for operator 'give'`
        
      case "wait":
        if (!queues[arg1]) queues[arg1] = [];
        if (isNaN(+arg2) || Math.round(+arg2) != +arg2 || +arg2 <= 0) throw `'wait' arg "${arg2}" is not a valid integer`;
        queues[arg1].push({
          type: "wait",
          time: +arg2
        });
        break;
      case "view":
        if (!queues[arg1]) queues[arg1] = [];
        if (arg2.trim().length == 0) throw `Empty arg for operator 'view'`;
        queues[arg1].push({
          type: "view",
          color: arg2
        });
        break;
      default:
        throw `Invalid operator ${operator}`;
    }
  }

  if (!sim.time) sim.time = 24;
  if (!sim.fuel) sim.fuel = 12;
  if (!sim.anim) sim.anim = 500;
}

function restart() {
  
  // Remove all planes
  for (const { el } of Object.values(planes)) {
    destroyPlane(el);
  }
  planes = {};

  try { compile(); }
  catch(err) { // Inform user of compilation error
    $("#error").textContent = err;
    return false; // Bad start
  }

  // Clear error
  $("#error").textContent = "";

  // Init info
  let r = 25;
  for (let id in queues) {
    
    // Tell all planes to return to home
    queues[id].push({
      type: "goto",
      dest: 0
    });

    // Init object for plane
    planes[id] = {
      lastPos: 0,
      pos: 0,
      lastFuel: sim.fuel,
      fuel: sim.fuel,
      el: buildPlane(r, id)
    };
    movePlaneTo(planes[id].el, 0);

    r += 25;
  }

  return true; // Success!
}

async function runStep() {
  let didAct;
  let didFail = null;
  try { didAct = runSubstep("goto") | runSubstep("give") | runSubstep("wait") | runSubstep("view"); } // Or without short-circuit
  catch(err) {
    didFail = err;
    didAct = true; // Something probably happened...
  }
  if (!didAct) {
    doEnd();
    return;
  }

  let promises = [];
  for (const plane of Object.values(planes)) {
    let start = getRotation(plane.lastPos);
    let end = getRotation(plane.pos);

    const delta = start - end;
    const dist = Math.abs(delta);
    if (dist > Math.PI) { // Shorter going the other direction
      end += Math.sign(delta) * 2 * Math.PI;
    }

    promises.push(
      interpolate(start, end, 0.01, sim.anim, movePlaneTo.bind(null, plane.el)),
      interpolate(plane.lastFuel, plane.lastFuel - 1, 0.01, sim.anim, updatePlaneFuel.bind(null, plane.el))
    );
    plane.lastPos = plane.pos;
    plane.lastFuel = plane.fuel;
  }
  
  // Run step
  await Promise.all(promises);

  // Update plane data
  for (const plane of Object.values(planes)) {
    plane.el.style.background = plane.color ?? "";
    updatePlaneFuel(plane.el, plane.fuel);
  }

  if (didFail) {
    $("#error").textContent = didFail;
    for (const { el } of Object.values(planes)) {
      el.classList.add("dead");
    }
    doEnd();
    return;
  }

  if (!Object.values(queues).some(queue => queue.length)) {
    doEnd();
  }
}

function runSubstep(type) {
  let action = false;

  for (const planeId in queues) {
    const queue = queues[planeId];
    const plane = planes[planeId];

    let stop = false;
    while (!stop) {
      stop = true;

      // Do nothing
      if (queue.length == 0) {
        break;
      }
  
      // Refuel plane if on island
      if (plane.pos == 0) plane.fuel = sim.fuel;
  
      const cmd = queue[0];
      if (cmd.type != type) continue; // Only run specific command
      
      action = true;
      switch (cmd.type) {
        case "goto": {
          let dest = cmd.dest % sim.time;
          if (dest < 0) dest += sim.time;
  
          let delta = dest - plane.pos;
          let dist = Math.abs(delta);
          if (dist == 0) {
            stop = false;
            queue.shift(); // Remove command
            break;
          }
          
          if (plane.fuel <= 0) throw `Plane "${planeId}" is out of fuel!`;
          plane.fuel--;
  
          // Determine optimal direction to get to destination
          if (dist <= sim.time / 2)
            plane.pos += Math.sign(delta);
          else plane.pos -= Math.sign(delta);
  
          plane.pos = plane.pos % sim.time;
          if (plane.pos < 0) plane.pos += sim.time;

          if (plane.pos == dest) {
            queue.shift();
          }
          break;
        }
        case "give": {
          let total = cmd.amount * cmd.recv.length;
          if (plane.fuel < total) throw `Plane "${planeId}" cannot give ${cmd.amount} fuel to ${cmd.recv.length} others. Only ${plane.fuel} available!`
  
          plane.fuel -= total;
          for (const id of cmd.recv) {
            if (plane.pos != planes[id].pos) throw `Plane "${planeId}" cannot give fuel to plane "${id}"--too far apart!`;
            planes[id].fuel += cmd.amount;
          }
  
          queue.shift(); // Remove command
          stop = false;
          break;
        }
        case "wait": {
          
          // Waiting for timer to tick down
          if (cmd.time >= 0) {
            cmd.time--;
  
            if (plane.pos != 0) {
              if (plane.fuel <= 0) throw `Plane "${planeId}" cannot wait--it is out of fuel!`;
              plane.fuel--; // It takes fuel to wait off the island
            }
            break;
          }
  
          // Timer has finished
          queue.shift(); // Remove wait command
          stop = false;
          break;
        }

        case "view":
          plane.color = cmd.color;
          queue.shift();
          break;
      }
    }
  }

  return action;
}

function doEnd() {
  runInterval.pause();
  $("#play").classList.remove("hidden");
  $("#play").classList.add("disabled");
  $("#pause").classList.add("hidden", "disabled");
  $("#step").classList.add("disabled");
  running = false;

  for (const { el } of Object.values(planes)) {
    updatePlaneFuel(el, sim.fuel);
  }
}

let runInterval = new SmartInterval(runStep, 0, false);
let running = false;
runInterval.pause();

$("#controls").addEventListener("click", e => {
  const target = e.target;

  if (target.classList.contains("disabled")) return; // Ignore disabled buttons
  switch (target.id) {
    case "restart":
      runInterval.pause();
      running = true;
      
      // Update buttons
      $("#play").classList.remove("hidden");
      $("#pause").classList.add("hidden");

      if (restart()) {
        runInterval.setInterval(sim.anim, false);
        $("#play").classList.remove("disabled");
        $("#pause").classList.remove("disabled");
        $("#step").classList.remove("disabled");
      }
      else {
        $("#play").classList.add("disabled");
        $("#pause").classList.add("disabled");
        $("#step").classList.add("disabled");
      }
      break;
    case "play":
      // Toggle button from play to pause
      $("#play").classList.add("hidden");
      $("#pause").classList.remove("hidden");
      
      runInterval.play();
      break;
    case "pause":
      // Toggle button from pause to play
      $("#play").classList.remove("hidden");
      $("#pause").classList.add("hidden");

      runInterval.pause();
      break;
    case "step":
      $("#play").classList.remove("hidden");
      $("#pause").classList.add("hidden");

      if (!runInterval.isPaused) {
        runInterval.pause();
        break;
      }

      $("#play").classList.add("disabled");
      $("#step").classList.add("disabled");
      runStep().then(() => {
        if (!running) return;
        $("#play").classList.remove("disabled");
        $("#step").classList.remove("disabled");
      });
      break;
  }
});

const query = "prog-" + location.search.substring(1);

// Save program
$("#program").addEventListener("input", () => {
  localStorage.setItem(query, $("#program").value);

  // Show errors while user is typing
  try {
    compile();
    $("#error").textContent = "";
  }
  catch(err) { // Inform user of compilation error
    $("#error").textContent = err;
  }
});

fetch(`./programs/${query}.txt`).then(res => res.text()).then(program => {
  if (!program.startsWith("<DOCTYPE program>")) throw ""; // Go into error area
  $("#program").value = program.substring(program.indexOf("\n") + 1);
  $("#restart").click();
}).catch(() => {
  if (localStorage.getItem(query)) {
    $("#program").value = localStorage.getItem(query);
    $("#restart").click();
  }
});

fetch("./programs/index.txt").then(res => res.text()).then(programs => {
  for (const program of programs.split("\n")) {
    const link = document.createElement("a");
    link.href = `./?${program}`;
    link.textContent = `Solution ${program}`;
    $("#solutions").append(link);
  }
});
