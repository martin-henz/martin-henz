---
tags: SICP-JS
---

# Making the Operand Stack Local

## Motivation

In the post
[An Explicit-control Evaluator in Stages](https://martin-henz.github.io/martin-henz/2022/04/20/vm-in-stages.html),
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
In this blog post, I show the (few) changes needed, to migrate from a global operand stack
to a local operand stack.

## Baseline: A global operand stack

Recall that the `run` function keeps four registers:
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
from the global operand stack `operands`. 
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
depth of function arguments. In this design, the caller saves the machine
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
frame that was most recently saved on the runtime stack.
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
In this post, it is safe to ignore block frames, which are beside call frames
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

## Making the operand stack global

Making the operand stack local to each evaluation of a function body requires that the
function call instruction needs to save the current operand stack (after popping
the arguments and the callee) in the call frame,
along with `pc` and `environment. After that, it it can just set `operand` to `null`.
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

The final change concerns return instructions. In version with a global
operand stack, the result of evaluating the return expression was already
in the right place, namely on top of the global operand stack. When the
operand stack is local to each evaluation of a function body, the return
value needs to be transferred from the callee's operand stack to the caller's
operand stack:
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

## The road ahead

With a local operand stack in place, I can make the virtual machine more
realistic. Instead of relying on JavaScript's data structures (here pairs
constructed with the `pair` function of the SICP package), I can allocate
environment frames, runtime stack frames, and function values in an
explicit *heap* data structure, which can be an array that only holds primitive
values. If the machine runs out of memory, garbage collection can free
unused memory in the heap. Stay tuned.
