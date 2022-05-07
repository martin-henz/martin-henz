---
tags: SICP-JS
---

# Making the Operand Stack Local

## Motivation

In the post
[A Virtual-machine-based Implementation in Stages](https://martin-henz.github.io/martin-henz/2022/04/20/vm-in-stages.html),
I gave a virtual machine for a sublanguage of JavaScript. It separated compilation from execution
using an array of virtual machine instructions. The virtual machine used as global registers a
program counter (index in the instruction array), environment, a runtime stack, and
an operand stack. The operand stack was a global data structure that all function bodies access
to save intermediate values. In the implementation of virtual machines, 
a global operand stack can become a performance bottleneck. An alternative design,
originally proposed in Landin's SECD machine and adopted by the Java Virtual Machine,
is to allocate a new operand stack for each function invocation. This design makes it
easy for the implementers of high-performance virtual machines to use real machine registers
and real machine instructions in place of an operand stack and stack-based instructions.
In this blog post, I start with a survey of the baseline, the virtual machine with a
global operand stack from the mentioned post. Then I show the (few) changes needed to migrate
from a global operand stack to local operand stacks. Local operands stacks pose a memory
allocation issue: The maximal size of an operand stack needs to be known at the time
it is created. I conclude with a solution to this issue.

## Baseline: A global operand stack

Recall that the `run` function keeps four registers: `operands`, `pc`, `environment`, and `runtime_stack`.
``` js
function run(instrs) {
    let operands = null;
    let pc = 0;
    let environment = the_global_environment;
    let runtime_stack = null;
    while (! is_done_instruction(instrs[pc])) {
        const instr = instrs[pc];
        if (is_load_constant_instruction(instr)) {
            pc = pc + 1;
            operands = pair(load_constant_value(instr), operands);
        } else if ...
    }
     return head(operands);
}   
```
Throughout the run, instructions either push values to or pop values
from the global operand stack `operands`, which is implemented as a list
of values. 
Call instructions (the most complex part of the machine) are implemented
by the following machine clause.
``` js
        } else if (is_call_instruction(instr)) {
            const arity = call_instruction_arity(instr);
            const args = take(operands, arity);
            const callee_and_remaining_operands = drop(operands, arity);
            const callee = head(callee_and_remaining_operands);
            const remaining_operands = tail(callee_and_remaining_operands);
            if (is_primitive_function(callee)) {
                pc = pc + 1;
                operands = pair(apply_in_underlying_javascript(
                                    primitive_implementation(callee),
                                    args),
                                remaining_operands);
            } else {
                runtime_stack = pair(make_runtime_stack_call_frame(
                                         pc + 1,
                                         environment),
                                     runtime_stack);
	   	        const new_environment = extend_environment(
                                            function_parameters(callee),
                                            args,
                                            function_environment(callee));
                operands = remaining_operands;
                environment = new_environment;
                pc = function_address(callee);
            }
        } else if ...
```
The purpose of the call instruction is to get the machine ready for executing
the body of the callee function. Note that the callee function uses the
current operand stack (after popping the arguments and the callee function
itself). The global operand stack will grow and shrink as a result of the nesting
depth of function arguments and their position.
The caller saves the machine
registers `pc` and `environment` on the runtime stack before getting these
registers ready for the callee.

If a function call computes the return value of the function in which it appears,
we have a *tail call*. In that case, there is no need for
saving anything on the runtime stack because neither `pc` nor `environment`
are needed any longer. The corresponding clause in the machine is as follows.
``` js
        } else if (is_tail_call_instruction(instr)) {
            const arity = call_instruction_arity(instr);
            const args = take(operands, arity);
            const callee_and_remaining_operands = drop(operands, arity);
            const callee = head(callee_and_remaining_operands);
            const remaining_operands = tail(callee_and_remaining_operands);
            if (is_primitive_function(callee)) {
                pc = pc + 1;
                operands = pair(apply_in_underlying_javascript(
                                    primitive_implementation(callee),
                                    args),
                                remaining_operands);
            } else {
                // don't push on runtime stack here
                const new_environment = extend_environment(
                                            function_parameters(callee),
                                            args,
                                            function_environment(callee));
                operands = remaining_operands;
                environment = new_environment;
                pc = function_address(callee);
            }
        } else if ...
```
Finally, the return instruction in a machine with a global operand stack
restores the registers `pc` and `environment` from the call
frame that was most recently saved on the runtime stack. The return
value is already in the right place, namely on top of the global operand
where the caller expects it.
``` js
        } else if (is_return_instruction(instr)) {
            if (is_runtime_stack_call_frame(head(runtime_stack))) {
                pc = runtime_stack_call_frame_pc(head(runtime_stack));
                environment = runtime_stack_call_frame_environment(
                                  head(runtime_stack));
            }
            // keep popping block frames from runtime stack until 
            // the top frame is a call frame
            runtime_stack = tail(runtime_stack);
        } else ...
```
In this post, it is safe to ignore block frames, which are (beside call frames)
the second kind of frames introduced in the machine. Call frames are
created and accessed with the following functions.
``` js
function make_runtime_stack_call_frame(pc, env) {
    return list("call_frame", pc, env);
}
function is_runtime_stack_call_frame(sf) {
    return is_tagged_list(sf, "call_frame");
}
function runtime_stack_call_frame_pc(sf) {
    return head(tail(sf));
}
function runtime_stack_call_frame_environment(sf) {
    return head(tail(tail(sf)));
}
```

## Making the operand stack local

I start with making the operand stack local to each evaluation of a function body.
Feel free to play with 
[the compiler and the SECD-style machine with local operand stacks](https://share.sourceacademy.org/53g2u).
When the operand stack is local to each evaluation of a function body,
the call instruction needs to save the current operand stack (after popping
the arguments and the callee) in the call frame,
along with `pc` and `environment`. After that, it it can just set `operand` to `null`.
``` js
        } else if (is_call_instruction(instr)) {
            const arity = call_instruction_arity(instr);
            const args = take(operands, arity);
            const callee_and_remaining_operands = drop(operands, arity);
            const callee = head(callee_and_remaining_operands);
            const remaining_operands = tail(callee_and_remaining_operands);
            if (is_primitive_function(callee)) {
                pc = pc + 1;
                operands = pair(apply_in_underlying_javascript(
                                    primitive_implementation(callee),
                                    args),
                                remaining_operands);
            } else {
                runtime_stack = pair(make_runtime_stack_call_frame(
                                         pc + 1,
                                         environment,
                                         remaining_operands
                                         ),
                                     runtime_stack);
	   	        const new_environment = extend_environment(
                                            function_parameters(callee),
                                            args,
                                            function_environment(callee));
                operands = null;
                environment = new_environment;
                pc = function_address(callee);
            }
        } else if ...
```
Of course, call frames now need to accommodate an `operands` value.
``` js
function make_runtime_stack_call_frame(pc, env, opnds) {
    return list("call_frame", pc, env, opnds);
}
function is_runtime_stack_call_frame(sf) {
    return is_tagged_list(sf, "call_frame");
}
function runtime_stack_call_frame_pc(sf) {
    return head(tail(sf));
}
function runtime_stack_call_frame_environment(sf) {
    return head(tail(tail(sf)));
}
function runtime_stack_call_frame_operands(sf) {
    return head(tail(tail(tail(sf))));
}
```
The only change in the tail call instruction is that `operands` is set to `null`.
The current operand stack is not needed any longer and therefore is not saved.
``` js
        } else if (is_tail_call_instruction(instr)) {
            const arity = call_instruction_arity(instr);
            const args = take(operands, arity);
            const callee_and_remaining_operands = drop(operands, arity);
            const callee = head(callee_and_remaining_operands);
            const remaining_operands = tail(callee_and_remaining_operands);
            if (is_primitive_function(callee)) {
                pc = pc + 1;
                operands = pair(apply_in_underlying_javascript(
                                    primitive_implementation(callee),
                                    args),
                                remaining_operands);
            } else {
                // don't push on runtime stack here
                const new_environment = extend_environment(
                                            function_parameters(callee),
                                            args,
                                            function_environment(callee));
                operands = null;
                environment = new_environment;
                pc = function_address(callee);
            }
        } else if ...
```
Return instructions need to change as follows. In the version with a global
operand stack, the result of evaluating the return expression was already
in the right place, namely on top of the global operand stack. When the
operand stack is local to each evaluation of a function body, the return
value needs to be transferred from the callee's operand stack to the caller's
operand stack.
``` js
        } else if (is_return_instruction(instr)) {
            if (is_runtime_stack_call_frame(head(runtime_stack))) {
                const top_frame = head(runtime_stack);
                const return_value = head(operands);
                operands = runtime_stack_call_frame_operands(top_frame);
                operands = pair(return_value, operands);
                pc = runtime_stack_call_frame_pc(top_frame);
                environment = runtime_stack_call_frame_environment(
                                  top_frame);
            }
            // keep popping block frames from runtime stack until 
            // the top frame is a call frame
            runtime_stack = tail(runtime_stack);
        } else ...
```

## A memory allocation issue

My ambition of this series of posts is to build a virtual machine for a JavaScript
sublanguage that lets me control all memory allocation. New memory will be allocated
from a *heap* data structure. The problem that arises
when operand stacks are local is that the machine needs to reserve an area on the heap when
it allocates a new operand stack. How many values does the new operand stack need to
accommodate during the evaluation of the body of the callee function?
In general, it is not possible to predict exactly how many values an operand
stack needs to hold. As often in computer science, I must be satisfied with a safe upper bound.

## The solution

The compiler of [the second and final implementation in this post](https://share.sourceacademy.org/sdv5m)
computes such a safe upper bound and its machine makes use of it at runtime.

For each load function instruction, the compiler calculates the upper bound and saves it in the
instruction. 
``` js
        // clause in compile for lambda expressions
        } else if (is_lambda_expression(comp)) {
            const body = lambda_body(comp);
            instrs[wc] = load_function(
                             reverse(lambda_parameter_symbols(comp)),
                             wc + 2,
                             max_stack_size(body));
            ...
```
The function `max_stack_size` recursively computes a good upper bound on the operand
stack size needed for evaluating an expression.
``` js
function max_stack_size(comp) {
    if (is_literal(comp) || is_name(comp) || is_lambda_expression(comp)) {
        return 1;
    } else if (is_operator_combination(comp)) {
        return max_stack_size(operator_combination_to_application(comp));
    } else if (is_sequence(comp)) {
        return max(map(max_stack_size, sequence_statements(comp)));
    } else if (is_conditional(comp)) {
        return max(list(max_stack_size(conditional_predicate(comp)),
                        max_stack_size(conditional_consequent(comp)),
                        max_stack_size(conditional_alternative(comp))));
    } else if (is_block(comp)) {
        return max_stack_size(block_body(comp));
    } else if (is_function_declaration(comp)) {
        return max_stack_size(function_decl_to_constant_decl(comp));
    } else if (is_declaration(comp)) {
        return max_stack_size(declaration_value_expression(comp));
    } else if (is_application(comp)) {
        let max_stack_size_so_far = max_stack_size(function_expression(comp));
        let i = 1; // number of items on stack so far
        let exprs = arg_expressions(comp);
        let s = length(exprs);
        while (i <= s) {
            // i increases as the items accumulate on stack
            max_stack_size_so_far = math_max(i + max_stack_size(head(exprs)), 
                                             max_stack_size_so_far);
            i = i + 1;
            exprs = tail(exprs);
        }
        return max_stack_size_so_far;
    } else if (is_return_statement(comp)) {
        return max_stack_size(return_expression(comp));
    } else {
        error(comp, "Unknown expression: ");
    }
}
```
The handling of applications needs to account for the fact that the
operand stack grows by 1 after an argument is handled.

The load function instruction now stores the maximal stack size, along
with the parameters and the address of the body in the instruction array.
``` js
function load_function(parameters, address, stack_limit) {
    return list("load_function", parameters, address, stack_limit);
}
function is_load_function_instruction(instr) {
    return is_tagged_list(instr, "load_function");
}
function load_function_instruction_parameters(instr) {
    return list_ref(instr, 1);
}
function load_function_instruction_address(instr) {
    return list_ref(instr, 2);
}
function load_function_instruction_max_stack_size(instr) {
    return list_ref(instr, 3);
}
```
The execution of a load function instruction saves the maximal stack size
in the function value it makes.
``` js
        // machine clause for load function instruction
        } else if (is_load_function_instruction(instr)) {
            pc = pc + 1;
            push_on_operand_stack(
                make_function(load_function_instruction_parameters(instr),
                              load_function_instruction_address(instr),
                              environment,
                              load_function_instruction_max_stack_size(instr)),
                operands);
        } else if ...
```
To have better control of the size of the operand stacks, I introduce explicit
operations on the operand stack, to push a value to an operand stack, pop
a value from an operand stack, and to inspect the current top item on an
operand stack.
``` js
function list_set(xs, n, x) {
    if (n === 0) {
        set_head(xs, x);
    } else {
        list_set(tail(xs), n - 1, x);
    }
}
function make_operand_stack(max_stack_size) {
    return list("operand_stack", [], -1, max_stack_size);
}
function push_on_operand_stack(v, operand_stack) {
    const old_top_address = list_ref(operand_stack, 2);
    const new_top_address = old_top_address + 1;
    list_set(operand_stack, 2, new_top_address);
    list_ref(operand_stack, 1)[new_top_address] = v;
}
function pop_from_operand_stack(operand_stack) {
    const old_top_address = list_ref(operand_stack, 2);
    const new_top_address = old_top_address - 1;
    list_set(operand_stack, 2, new_top_address);
    return list_ref(operand_stack, 1)[old_top_address];  
}
function top_of_operand_stack(operand_stack) {
    return list_ref(operand_stack, 1)[list_ref(operand_stack, 2)];  
}
```
Here an operand stack is represented as a tagged list whose element
at index 1 is an array. The machine guarantees that the size of this
array never exceeds the `max_stack_size` with which the operand stack
was created.

Of course function values now also need an additional component for the
maximal stack size.
``` js
function make_function(parameters, address, env, limit) {
    return list("compound_function",
                parameters, address, env, limit);
}
function is_compound_function(f) {
    return is_tagged_list(f, "compound_function");
}
function function_parameters(f) { 
    return list_ref(f, 1); 
}
function function_address(f) { 
    return list_ref(f, 2);
}
function function_environment(f) {
    return list_ref(f, 3);
}
function function_max_stack_size(f) {
    return list_ref(f, 4);
}
```
Along with the load function instruction above, all machine instructions
that use an operand stack need to employ the new operand stack functions
`push_on_operand_stack`, `pop_from_operand_stack`, and
`top_of_operand_stack`. Here are new versions of the first two machine
instructions, as examples.
``` js
function run(instrs) {
    let operands = make_operand_stack(0);
    let pc = 0;
    let environment = the_global_environment;
    let runtime_stack = null;
    while (! is_done_instruction(instrs[pc])) {
        const instr = instrs[pc];
        if (is_load_constant_instruction(instr)) {
            pc = pc + 1;
            push_on_operand_stack(load_constant_value(instr), operands);
        } else if (is_pop_instruction(instr)) {
            pc = pc + 1;
            pop_from_operand_stack(operands);
	}  ... 
        } else {
            error(instr, "Unknown instruction: ");
        }
    }
    return top_of_operand_stack(operands);
} 	
```
With this infrastructure in place, the call and tail call instructions can now
allocate an operand stack of a size that is sufficient for the
execution of the callee function. Here is the call instruction clause of
the new machine.
``` js
        } else if (is_call_instruction(instr)) {
            const arity = call_instruction_arity(instr);
            const args = pop_arguments_from_operand_stack(operands, arity);
            const callee = pop_from_operand_stack(operands);
            if (is_primitive_function(callee)) {
                pc = pc + 1;
                push_on_operand_stack(apply_in_underlying_javascript(
                                          primitive_implementation(callee),
                                          args),
                                      operands);
            } else {
                runtime_stack = pair(make_runtime_stack_call_frame(
                                         pc + 1,
                                         environment,
                                         operands),
                                     runtime_stack);
	   	        const new_environment = extend_environment(
                                            function_parameters(callee),
                                            args,
                                            function_environment(callee));
                operands = make_operand_stack(function_max_stack_size);
                environment = new_environment;
                pc = function_address(callee);
            }
        } else if ...
```

## The road ahead

With a local operand stack in place, I can make the virtual machine more
realistic. Instead of relying on JavaScript's data structures (here pairs
constructed with the `pair` function of the SICP package), I can allocate
environment frames, runtime stack frames, and function values in an
explicit *heap* data structure, which can be an array that only holds primitive
values. If the machine runs out of memory, garbage collection can free
unused memory in this heap. But before that, I need to simplify the
representation of environment frames. Stay tuned.
