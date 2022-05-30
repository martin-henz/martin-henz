---
tags: SICP-JS
---

# A Virtual Machine with Lexical Addressing

## Motivation

The
[last post](https://martin-henz.github.io/martin-henz/2022/05/05/local-operand-stack.html)
evolved the machine given in the post
[A Virtual-machine-based Implementation in Stages](https://martin-henz.github.io/martin-henz/2022/04/20/vm-in-stages.html)
by making the operand stack explicit to get operand stacks ready for a realistic
memory management in the virtual machine. In this post, I similarly
prepare *environments* for
realistic memory management. For this, I simplify the representation of environment frames
such that they become just list of values accessed with position numbers
instead of lookup tables accessed with the symbols of names. This removes the need for
linearly searching environment frames to find the value of a name using a
technique that is explained in detail in
[Section 5.5.6 of SICP JS](https://sourceacademy.org/sicpjs/5.5.6).
In this post I apply this technique to the virtual machine of the previous
post. I first show how the machine makes use of this information for efficient
environment lookup and assignment.
Then, I show how the compiler can keep track of the
environment position in which the values of names will be found at runtime.
Then, 
But first let me review the way environments
are represented in the previous machines.

## Baseline: Symbolic addressing

Environments in the previous machines were lists of frames.
``` js
function enclosing_environment(env) { return tail(env); }

function first_frame(env) { return head(env); }

const the_empty_environment = null;
```
A frame was a pair of lists. The head list contained symbols (strings) and
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
Therefore, environment lookup proceeded as follows.
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
The compiler passed the symbol of a name to the constructor of
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
The constructor of the load instruction represented the symbol
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
The machine used the instruction's symbol to perform environment lookup.
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
were implemented by storing the local names and parameters
in machine instructions so that the machine could perform
environment extension when executing enter scope instructions
and function call instructions.

## Lexical addressing

The `lookup_symbol_value` function above scans the frames of the given
environment successively to find the given name and its corresponding value.
[SICP Section 5.5.6](https://sourceacademy.org/sicpjs/5.5.6) describes
a technique to optimize name lookup such that the compiler predicts the
position where the value can be found. This is possible because in
lexical scoping, the structure of the environment exactly matches the
structure of nested scopes. The following example, taken from SICP 5.5.6,
illustrates the idea.
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
function load_lexical(frame, position) {
    return list("load_lexical", frame, position);
}
function is_load_lexical_instruction(instr) {
    return is_tagged_list(instr, "load_lexical");
}
function load_lexical_frame(instr) {
    return head(tail(instr));
}
function load_lexical_position(instr) {
    return head(tail(tail(instr)));
}
```
Similarly, the `assign` instruction is replaced by an
`assign_lexical` instruction.
``` js
function assign_lexical(frame, position) {
    return list("assign_lexical", frame, position);
}
function is_assign_lexical_instruction(instr) {
    return is_tagged_list(instr, "assign_lexical");
}
function assign_lexical_frame(instr) {
    return head(tail(instr));
}
function assign_lexical_position(instr) {
    return head(tail(tail(instr)));
}
```

## New machine instructions for lexical addressing

The `enter_scope` instruction
is replaced by an `enter_scope_lexical` instruction that only carries
the number of values to be allocated in the extended environment.
``` js
function enter_scope_lexical(number_of_declarations) {
    return list("enter_scope_lexical", number_of_declarations);
}
function is_enter_scope_lexical_instruction(instr) {
    return is_tagged_list(instr, "enter_scope_lexical");
}
function enter_scope_lexical_declarations(instr) {
    return head(tail(instr));
}
```
The `load_function` instruction is replaced by a
`load_function_lexical` instruction that carries
the number of parameters instead of their symbols.
``` js
function load_function_lexical(arity, address, stack_limit) {
    return list("load_function_lexical", arity, address, stack_limit);
}
function is_load_function_lexical_instruction(instr) {
    return is_tagged_list(instr, "load_function_lexical");
}
function load_function_lexical_instruction_arity(instr) {
    return list_ref(instr, 1);
}
function load_function_lexical_instruction_address(instr) {
    return list_ref(instr, 2);
}
function load_function_lexical_instruction_max_stack_size(instr) {
    return list_ref(instr, 3);
}
```

## Some cleanup

A consequence of the resolution of names at compile time is that names are
no longer needed in environments. Each frame consists of just the list
of values that are associated with their corresponding names in the program.
``` js
function extend_environment(vals, base_env) {
    return pair(vals, base_env);
}
```

## Adapting the machine to lexical addressing

Here is the implementation of the `enter_scope_lexical` instruction.
``` js
        // machine clause for enter_scope_lexical instruction
        } else if (is_enter_scope_lexical_instruction(instr)) {
            pc = pc + 1;
            runtime_stack = pair(make_runtime_stack_block_frame(
                                     environment),
                                 runtime_stack);
            environment = extend_environment(
                              list_of_unassigned(
                                  enter_scope_lexical_declarations(instr)),
                              environment);
        } else ...
```
The `extend_environment` function no longer gets the list
of declared symbols as argument; the initial values (here the special value
`"*unassigned*"`) suffice. Similarly, the instructions `call` and
`tail_call` no longer pass the list
of parameter symbols to the `extend_environment` function.

The instruction `load_function_lexical` works like this.
``` js
        // machine clause for load_function_lexical instruction
        } else if (is_load_function_lexical_instruction(instr)) {
            pc = pc + 1;
            push_on_operand_stack(
                make_function(
                    load_function_lexical_instruction_arity(instr),
                    load_function_lexical_instruction_address(instr),
                    environment,
                    load_function_lexical_instruction_max_stack_size(instr)),
                operands);	
```
Function values now just carry the arity of the function and no longer
the list of parameter symbols.

Finally, the `lookup_lexical` instruction makes use of the frame number
and position computed at compile time and stored in the instruction.
``` js
        // machine clause for load_lexical instruction
        } else if (is_load_lexical_instruction(instr)) {
            pc = pc + 1;
            push_on_operand_stack(lexical_address_lookup(
                                      load_lexical_frame(instr),
                                      load_lexical_position(instr),
                                      environment),
                                  operands);
        } else ...
```
It uses the function `lexical_address_lookup`, which operates on the
simplified environment data structures.
``` js
function lexical_address_lookup(frame, position, env) {
    function find_position(vals, position) {
        return position === 0
               ? head(vals)
               : find_position(tail(vals), position - 1);
    }
    return find_position(find_frame(env, frame), position);
}
function find_frame(env, frame) {
    return frame === 0 
           ? first_frame(env)
           : find_frame(enclosing_environment(env), frame - 1);
}
```
Similarly, the `assign_lexical` instruction uses a `lexical_address_assign`
function, which operates on the simplified environments.

## Generating lexical addresses in the compiler

As described in [SICP JS Section 5.5.6](https://sourceacademy.org/sicpjs/5.5.6),
the compiler generates lexical addresses by adding a *compile-time environment*
to the recursive compilation process.
``` js
function compile(program) {
    // wc: write counter
    let wc = 0;
    // instrs: instruction array
    const instrs = [];
    function compile_component(comp, env) {
        if (is_literal(comp)) {
            instrs[wc] = load_constant(literal_value(comp));
            wc = wc + 1;
        } else  ...
    }
    ...
    const the_compile_time_environment =
        setup_compile_time_environment();
    compile_component(program, the_compile_time_environment);
    instrs[wc] = done();
    return instrs;
}     
```
The frames in compile-time environments
only contain symbols, not values. The initial environment is the list of
predeclared symbols.
``` js
function setup_compile_time_environment() {
    return extend_compile_time_environment(
               append(primitive_function_symbols, 
                      primitive_constant_symbols),
               the_empty_compile_time_environment);
}
```
Like runtime environments, compile-time environments can be extended to
accommodate new names in a local scope.
``` js
function enclosing_compile_time_environment(env) { return tail(env); }

function first_compile_time_frame(env) { return head(env); }

const the_empty_compile_time_environment = null;

function extend_compile_time_environment(symbols, base_env) {
    return pair(symbols, base_env);
}
```
The compiler makes use of the compile-time environment when it
compiles occurrences of names.
``` js
        // compiler clause for names
        } else if (is_name(comp)) {
            const address = find_symbol(symbol_of_name(comp), env);
            instrs[wc] = load_lexical(head(address), tail(address));
            wc = wc + 1;
        } else ...
```
Similarly, the compiler uses the compile-time environment for
turning declarations into assignments.
``` js
        } else if (is_declaration(comp)) {
            compile_component(declaration_value_expression(comp), env);
            const address = find_symbol(declaration_symbol(comp), env);
            instrs[wc] = assign_lexical(head(address), tail(address));
            wc = wc + 1;
```
The function `find_symbol` computes the address of a given symbol
in the compile-time environment. An address is a pair whose head
is the frame number and whose tail is the position.
``` js
function find_symbol(symbol, env) {
    function find(symbol, env, frame) {
        if (is_null(env)) {
            return error("not found");
        } else {
            const current_frame = first_compile_time_frame(env);
            const symbols = member(symbol, current_frame);
            if (is_null(symbols)) {
                return find(symbol, 
                            enclosing_compile_time_environment(env),
                            frame + 1);
            } else {
                const position = length(current_frame) - length(symbols);
                return pair(frame, position);
            }
        }
    }
    return find(symbol, env, 0);
}
```
This works because the compile-time environment exactly matches the
runtime environment. To achieve this, the compiler
extends the compile-time environment to include the symbols of the
new names each time the compiler enters a local scope.
``` js
        // compiler clause for blocks
        } else if (is_block(comp)) {
            const local_symbols = scan_out_declarations(block_body(comp));
            instrs[wc] = enter_scope_lexical(length(local_symbols));
            wc = wc + 1;
            compile_component(block_body(comp),
                              extend_compile_time_environment(
                                  local_symbols,
                                  env));
            instrs[wc] = exit_scope();
            wc = wc + 1;
        } else ...
	// compiler clause for lambda expressions
        } else if (is_lambda_expression(comp)) {
            const body = lambda_body(comp);
            const parameters = lambda_parameter_symbols(comp);
            instrs[wc] = load_function_lexical(
                             length(parameters),
                             wc + 2,
                             max_stack_size(body));
            wc = wc + 1;
            // jump over the body of the lambda expression
            const goto_instruction = goto();
            instrs[wc] = goto_instruction;
            wc = wc + 1;
            compile_component(body,
                              extend_compile_time_environment(
                                  parameters,
                                  env));            
            instrs[wc] = load_constant(undefined);
            wc = wc + 1;
            instrs[wc] = return_instr();
            wc = wc + 1;
            set_jump_address(goto_instruction, wc);
        } else ...	
```

## The road ahead

With local operand stacks and lexical addressing in place, I can allocate
environment frames, runtime stack frames, and function values in an
explicit *heap* data structure, which can be a single array that only holds
primitive values. If the machine runs out of memory, garbage collection can free
unused memory in this heap. Stay tuned.
