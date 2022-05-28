---
tags: SICP-JS
---

# A Virtual Machine with Lexical Addressing

## Motivation

The
[last post](https://martin-henz.github.io/martin-henz/2022/05/05/local-operand-stack.html)
evolved the machine given in the post
[A Virtual-machine-based Implementation in Stages](https://martin-henz.github.io/martin-henz/2022/04/20/vm-in-stages.html)
by making the operand stack explicit, to get operand stacks ready for a realistic
memory management in the virtual machine. In this post, I similarly
prepare *environments* for
realistic memory management. It simplifies the representation of environment frames
such that they become just arrays of values indexed with numbers
instead of lookup tables indexed with program names. It removes the need for
linearly searching environment frames to find the value of a name using a
technique that is explained in detail in
[Section 5.5.6 of SICP JS](https://sourceacademy.org/sicpjs/5.5.6).
In this post explains this technique in the
context of the virtual machine. I first show how the
compiler can keep track of the
environment position in which the values of names will be found at runtime.
Then, I show how the machine makes use of this information for efficient
environment lookup and assignment. But first let me review the way environments
are represented in the previous machines.

## Baseline: Symbolic addressing

Environments in the previous machines are lists of frames.
``` js
function enclosing_environment(env) { return tail(env); }

function first_frame(env) { return head(env); }

const the_empty_environment = null;
```
A frame is a pair of lists. The head list contains symbols (strings) and
the tail list contains the values of those symbols.
``` js
function make_frame(symbols, values) { return pair(symbols, values); }

function frame_symbols(frame) { return head(frame); }

function frame_values(frame) { return tail(frame); }

function extend_environment(symbols, vals, base_env) {
    return length(symbols) === length(vals)
           ? pair(make_frame(symbols, vals), base_env)
           : length(symbols) < length(vals)
           ? error("too many arguments supplied: " + 
                   stringify(symbols) + ", " + 
                   stringify(vals))
           : error("too few arguments supplied: " + 
                   stringify(symbols) + ", " + 
                   stringify(vals));
}
```

Therefore, environment lookup proceeds as follows.
``` js
function lookup_symbol_value(symbol, env) {
    function env_loop(env) {
        function scan(symbols, vals) {
            return is_null(symbols)
                   ? env_loop(enclosing_environment(env))
                   : symbol === head(symbols)
                   ? head(vals)
                   : scan(tail(symbols), tail(vals));
        }
        if (env === the_empty_environment) {
            error(symbol, "unbound name");
        } else {
            const frame = first_frame(env);
            return scan(frame_symbols(frame), frame_values(frame));
        }
    }
    return env_loop(env);
}
```
The compiler passes the symbol of a name to the constructor of
the load instruction.
``` js
    function compile_component(comp) {
        if (is_literal(comp)) {
            instrs[wc] = load_constant(literal_value(comp));
            wc = wc + 1;
        } ... { ...
        } else if (is_name(comp)) {
            instrs[wc] = load(symbol_of_name(comp));
            wc = wc + 1;
        } else ...
    }
```
The constructor of the load instruction represents the symbol
explicitly in the machine instruction.
``` js
function load(symbol) {
    return list("load", symbol);
}
function is_load_instruction(instr) {
    return is_tagged_list(instr, "load");
}
function load_symbol(instr) {
    return head(tail(instr));
}
```
The machine uses the instruction's symbol to perform environment lookup.
``` js
        // clause in virtual machine for load instruction
        } else if (is_load_instruction(instr)) {
            pc = pc + 1;
            push_on_operand_stack(lookup_symbol_value(load_symbol(instr),
                                                      environment),
                                  operands);
        } ...
```
Similarly, the entering of a block and lambda expressions
are implemented by storing the local names and parameters
in machine instructions so that the machine can perform
environment extension when executing enter scope instructions
and function call instructions.

## Lexical addressing

The `lookup_symbol_value` function above scans the frames of the given
environment successively to find the given name and its corresponding value.
[SICP Section 5.5.6](https://sourceacademy.org/sicpjs/5.5.6) describes
a technique to optimize name lookup such that the compiler predicts the
position where the value can be found. This is possible because in
lexical scoping, the structure of the environment always matches the
structure of nested scopes. The following example, taken from SICP 5.5.6,
illustrates the technique.
``` js
((x, y) =>
   (a, b, c, d, e) =>
     ((y, z) => x * y * z)(a * b * x, c + d + x))(3, 4)
```
Consider the problem of looking up the value of `x` while evaluating
the expression `x * y * z` in an application of the function that is
returned by the expression above. The structure of the environment
at that point is as follows.
``` js
list(pair(list("y", "z"), list(v_1, v_2)),
     pair(list("a", "b", "c", "d", "e"), list(v_3, v_4, v_5, v_6, v_7)),
     pair(list("x", "y"), list(v_8, v_9)),
     ...)
```
To find the value for the symbol `"x"`, `lookup_symbol_value` examines
the symbol list `list("y", "z")` of the first frame in search for `"x"`.
It doesn't find `"x"` there, and therefore continues with the symbol
list `list("a", "b", "c", "d", "e")` of the second frame. This search
is also unsuccessful, and thus it proceeds to the the third symbol
list `list("x", "y")` where it finds `"x"` in position 0, and thus
returns the corresponding value, here denoted by `v_8`. This behavior
can be predicted by examining the expression in which `x` occurs.
When looking for dedeclaration of `x` starting from `x * y * z`, you
need to skip two surrounding lambda expression, before you find the
declaration at position 0 in the parameters of `(x, y) => ...`.

## Using lexical addresses in the machine

For each name, the new compiler predicts in which frame of the environment
at runtime and in what position of that frame
the corresponding value is located.
Instead of a `load` instruction that contains the name, the compiler
generates a `load_lexical` instruction that contains the frame index
and the position index.
``` js

```
Similarly, the `assign` instruction is replaced by an
`assign_lexical` instruction.
``` js

```

## Generating lexical addresses in the compiler

That means that the `enter_scope` instruction
can be replaced by an `enter_scope_lexical` instruction that only carries
the number of values to be allocated in the environment.
``` js

```
The `load_function` instruction is replaced by a
`load_function_lexical` instruction that carries
the number of parameters instead of their names.
``` js

## Some cleanup

A consequence of the resolution of names at compile time is that names are
no longer needed in environments

## Adapting the machine to lexical addressing

```
With these changes in place, environments become much simpler.
``` js

```
Here is the implementation of the `enter_scope_lexical` instruction.
``` js

```
The instruction `load_function_lexical` works like this.
``` js

```
Finally, the `lookup_lexical` instruction makes use of the work invested
at compile time.
``` js

```
It uses the function `lexical_address_lookup`, which is implemented as follows.
``` js

```

## The road ahead

With local operand stacks and lexical addressing in place, I can allocate
environment frames, runtime stack frames, and function values in an
explicit *heap* data structure, which can be a single array that only holds
primitive values. If the machine runs out of memory, garbage collection can free
unused memory in this heap. Stay tuned.
