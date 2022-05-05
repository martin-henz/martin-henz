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
the second kind of frames introduced in the machine.

## Making the operand stack global

