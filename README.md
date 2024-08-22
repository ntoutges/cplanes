## Commands
All commands follow the following format:\
[arg1] [command] [arg2?] [modifier?] [...modifications?]\
(? indicates that the argument is optional)\

Commands List:
* init
  * Used to initialize the environment.
  * Environment initialization values are specified in the `arg1` slot.
  * Environment initializations are specified in the `arg2` slot.
  * Valid initializations:
    * plane
      * Tells the program a plane exists
      * Only necessary if a plane exists that does nothing (and at that point, why?)
      * Plane names can be any combination of non-space characters.
    * time
      * The amount of time steps per circumnavigation of the planet. (Default: 24)
      * For the original problem, this should be 2x as much as the fuel.
    * fuel
      * The amount of fuel units each plane gets. (Default: 12)
      * For the original problem, this should be 1/2x as much as the time.
    * anim
      * The real-world animation time (in ms) per time step.
* goto
  * Tells a plane (`arg1`) to move to some location (`arg2`) in the range [0, time).
  * Ex: With the default fuel/time:
    * 0 goto 6
    * Will use 6 fuel to go 1/4 of the way around the globe.
* give
  * Transfers some amount of fuel (`arg2`) from one plane (`arg1`) to others (`modifications`, separated by `","`)
  * Note that `modifier` *must* be `to`.
  * Ex: To transfer 4 fuel from plane 0 to planes 1 and 2:
    * 0 give 4 to 1,2
* wait
  * Make plane (`arg1`) wait for (`arg2`) timesteps.
  * While planes can wait over the ocean, it is not recommended, as this wastes fuel as if the plan were flying. Return the plane to the island (0) before waiting.
* view
  * Change the color of plane (`arg1`) to (`arg2`).
  * Note that, if not put underneath a `goto` command, this will take up 1 timestep of time.

## Command Interpreter
Commands are executed in a queue, with the following order.

1. `goto`
  * If a `goto` command is not first in the queue: this step is ignored.
  * If a plane reaches its `goto` destination, that `goto` command is removed, and the next step is executed.
2. `give`
  * If a `give` command is not first in the queue, this step is ignored.
  * This command is immediately removed from the queue.
3. `wait`
  * If a `wait` command is not first in the queue, this step is ignored.
  * This command is removed from the queue once the specified number of timesteps have passed.
4. `view`
  * If a `view` command is not first in the queue, this step is ignored.
  * This command is immediately removed from the queue.