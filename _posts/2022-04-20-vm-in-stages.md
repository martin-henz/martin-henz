---
tags: SICP-JS
---

# A Virtual-machine-based Implementation in Stages

## Motivation

In
[the previous post](https://martin-henz.github.io/martin-henz/2022/04/17/ece-in-stages.html),
I described how to construct an *explicit-control evaluator* for a sublanguage
of JavaScript in a step-by-step fashion.
The result mixes compilation steps that manage control using a list of instructions
that I called *continuation* with execution steps where previously compiled instructions
are executed with the help of an environment, an operand stack, and a runtime stack.
Compilation was done on-the-fly, and function bodies needed to be recompiled, each time
they were executed. This post fixes this by cleanly separating a compiler from a
machine. The compiler compiles the given program by writing instructions into an array
without executing them, and the machine executes these instructions without ever referring
to the original program. As in the previous post, I proceed in stages
to gently introduce this approach for increasingly powerful sublanguages of
JavaScript.

## A virtual-machine implementation of a calculator language

As in the previous post,
we start with a calculator sublanguage of JavaScript. A program in such a language is a single expression
statement, and the expression consists of numbers and the binary operators `+`, `-`, `*`, and `/`.
A typical "program" looks like this:
``` js
1 + 2 * 3 - 4;
```
Recall that the function `parse` translates such a program into a syntax tree:
``` js
parse("1 + 2 * 3 - 4;");
```
which results in
``` js
list("binary_operator_combination",
     "-",
     list("binary_operator_combination",
          "+",
          list("literal", 1),
          list("binary_operator_combination",
	       "*",
	       list("literal", 2), list("literal", 3))),
     list("literal", 4))
```
using the [list notation](https://sourceacademy.org/sicpjs/2.2.1#p4) of SICP JS. The 
explicit-control evaluator described in
[the previous post](https://martin-henz.github.io/martin-henz/2022/04/17/ece-in-stages.html) 
consisted in a function `evaluate` that mixed compilation with execution. The values
of literals were pushed on an *operand stack*.
Binary operator
combinations were compiled on-the-fly to instructions, and instructions were executed
by applying the correct operations to the operands, taken from the operand stack.
``` js
function evaluate(program) {
    let components = list(program);
    let operands = null;
    while (! is_null(components)) {
        const component = head(components);
        const continuation = tail(components);
        if (is_literal(component)) {
            components = continuation;
            operands = pair(literal_value(component), operands);
        } else if (is_operator_comb(component)) {
            components = 
                pair(operator_comb_first_operand(component),
                     pair(operator_comb_second_operand(component),
                          pair(make_binary_operator_instruction(
                                   operator_comb_operator_symbol(
                                       component)),
                               continuation)));
        } else if (is_binary_operator_instruction(component)) {
            components = continuation;
            operands = pair(apply(binary_operator_instruction_operator(
                                      component), 
                                  list(head(operands), 
                                       head(tail(operands)))),
                            tail(tail(operands)));
        } else {
            error(component, "Unknown expression: ");
        }
    }
    return head(operands);
}
```
The
[virtual-machine-based implementation of the calculator language](https://share.sourceacademy.org/u20x4)
of this post separates compilation from execution. It compiles the given program into
an array of instructions, without executing them.
``` js
function compile(expr) {
    let wc = 0;
    const instrs = [];
    function compile_component(expr) {
        if (is_literal(expr)) {
            instrs[wc] = make_load_constant_instruction(
                             literal_value(expr));
            wc = wc + 1;
        } else if (is_operator_combination(expr)) {
            compile_component(operator_combination_first_operand(expr));
            compile_component(operator_combination_second_operand(expr));
            instrs[wc] = make_binary_instruction(
                             operator_combination_operator_symbol(expr));
            wc = wc + 1;
        } else {
            error(expr, "Unknown expression: ");
        }
    }
    compile_component(expr);
    instrs[wc] = make_done_instruction();
    return instrs;
} 
```
A literal is compiled by generating a `load_constant` instruction.
``` js
function load_constant(value) {
    return list("load_constant", value);
}
function is_load_constant_instruction(x) {
    return is_tagged_list(x, "load_constant");
}
function load_constant_value(x) {
    return head(tail(x));
}
```
The recursive compilation process rearranges the given calculator program into
a kind of postfix notation. The example program
``` js
1 + 2 * 3 - 4;
```
from above is compiled into the array
``` js
[
0: load_constant(1),
1: load_constant(2),
2: load_constant(3),
3: binary_operation("*"),
4: binary_operation("+"),
5: load_constant(4),
6: binary_operation("-"),
7: done()
]
```
where the array indices of the instructions are added for clarity.

As in the explicit-control evaluator, an *operand stack* keeps track of
the operands of operation instructions.
The machine runs the instructions by executing them one after the other,
using a *program counter* `pc` to keep track of the next instruction to execute, until
the `done` instruction is reached, at which point the final result is on
top of the operand stack. The variables `operand_stack` and `pc` keep track
of the state of the machine. They are called *registers*.
``` js
function run(instrs) {
    let operands = null;
    let pc = 0;
    while (! is_done_instruction(instrs[pc])) {
        const instr = instrs[pc];
        if (is_load_constant_instruction(instr)) {
            operands = pair(load_constant_value(instr), operands);
        } else if (is_binary_instruction(instr)) {
            operands = pair(apply(binary_instruction_operator(instr), 
                                  list(head(tail(operands)), 
                                       head(operands))),
                            tail(tail(operands)));
        } else {
            error(instr, "Unknown instruction: ");
        }
        pc = pc + 1;
    }
    return head(operands);
} 
```
We declare a `parse_compile_run` that parses the given program string, compiles
the resulting syntax tree into machine code (an array of machine instructions) and then runs
the machine code.
``` js
function parse_compile_run(program_string) {
    return run(compile(parse(program_string));
}
```
With this machinery in place,
``` js
parse_compile_run("1 + 2 * 3 - 4;");
```
returns the expected result 3.

## Adding booleans, conditionals, and sequences

The [next virtual-machine-based implementation](https://share.sourceacademy.org/6sesc) 
extends the calculator language by
adding the boolean values `true` and
`false`, conditional expressions and sequences of statements. As noted in the previous post, 
the component
statements of a sequence are evaluated in the order in which they appear, and the result
in the case of this JavaScript sublanguage is the result of evaluating the last statement
of the sequence. The result of evaluating the program
``` js
8 + 34; true ? 1 + 2 : 17;
```
is therefore 3.

The explicit-control evaluator handled a conditional by moving its predicate into the
continuation, before a new *branch instruction*, which stored the consequent and alternative
expressions.
``` js
      // clause for conditionals in explicit-control evaluator
      } else if (is_conditional(component)) {
          components =
              pair(conditional_predicate(component),
                   pair(make_branch(conditional_consequent(component),
                                    conditional_alternative(component)),
                        continuation));
      } else ...			
```
To cleanly separate compilation from execution, the compiler generates *jump* instructions
that contain the addresses of the compiled branches, rather than the explicit-control evaluator's
*branch* instructions that contained uncompiled components.
``` js
        // clause for conditionals in compile function
        } else if (is_conditional(comp)) {
            compile_component(conditional_predicate(comp));
            const jump_on_false_instruction = make_jump_on_false_instruction();
            instrs[wc] = jump_on_false_instruction;
            wc = wc + 1;
            compile_component(conditional_consequent(comp));
            const goto_instruction = make_goto_instruction();
            instrs[wc] = goto_instruction;
            wc = wc + 1;
            const alternative_address = wc;
            set_jump_address(jump_on_false_instruction, alternative_address);
            compile_component(conditional_alternative(comp));
            const after_conditional_address = wc;
            set_jump_address(goto_instruction, after_conditional_address);
        } else ...
```
For example, the conditional `true ? 1 + 2 : 3 * 4;` is compiled to the following machine
code.
``` js
[
0: load_constant(true),
1: jump_on_false(6),
2: load_constant(1),
3: load_constant(2),
4: binary_operation("+"),
5: goto(9),
6: load_constant(3),
7: load_constant(4),
8: binary_operation("*"),
9: done()
]
```
The `jump_on_false` instruction carries the address to jump to, in case the
value on top of the operand stack is not truthy. If it is truthy, the code
generated from the consequent expression is executed, followed by a `goto`
instruction that jumps to the code after the code for the alternative
expression. The implementation of the two instructions `jump_on_false` and
`goto` manipulate the program counter to achieve the desired effect.
``` js
        // clauses in machine for jump_on_false and goto
        } else if (is_jump_on_false_instruction(instr)) {
            pc = is_truthy(head(operands)) ? pc + 1 : jump_address(instr);
            operands = tail(operands);
        } 
        else if (is_goto_instruction(instr)) {
            pc = jump_address(instr);
        } else ...
```
The compilation of sequences concatenates the results of compiling the
components of the sequence, and separating them by pop instructions.
``` js
function compile(program) {
    let wc = 0;
    const instrs = [];
    function compile_component(comp) {
        if ... {
	    ...
        } else if (is_sequence(comp)) {
            compile_list(sequence_statements(comp));
        } else ...
    }
    function compile_list(comps) {
        if (is_null(comps)) {
            // do nothing
        } else {
            compile_component(head(comps));
            const rest_comps = tail(comps);
            if (!is_null(rest_comps)) {
                instrs[wc] = make_pop_instruction();
                wc = wc + 1;
                compile_list(rest_comps);
            }
        }
    }
    compile_component(program);
    instrs[wc] = done();
    return instrs;
} 
```
The result of evaluating every sequence component except the last one
is popped from the operand stack by the pop instruction which is implemented
in the execution loop of the machine as follows.
``` js
        // clause for pop instruction in machine
        } else if (is_pop_instruction(instr)) {
            pc = pc + 1;
            operands = tail(operands);
	} else ...
```
For example, the result of
``` js
parse_compile_run("8 + 34; true ? 1 + 2 : 17;");
```
is 3 because the result of `8 + 34` is popped from the operand stack by a pop instruction
generated by `prepare_statements`.

## Adding blocks, declarations, and names

The [next implementation](https://share.sourceacademy.org/jcs26)
adds blocks, block-scoped `const` declarations,
and names. A typical example is
``` js
const y = 4; 
{
    const x = y + 7; 
    x * 2;
}
```
which evaluates to 22 because in the program, the name `y` is declared to be 4, and in the
block (delimited by braces `{...}`) the name `x` is declared to refer to `y + 7`, i.e. 11.

Similar to the recursive evaluator for blocks, declarations, and names, 
the machine uses
an environment that keeps track of the names that are declared in any
given scope and the values that these names refer to at any given time.
To achieve this, the compiler generates `enter_scope` and `exit_scope`
instructions to mark the beginning and end of each block. 
``` js
        // clause for blocks in compiler
        } else if (is_block(comp)) {
            const local_symbols = scan_out_declarations(block_body(comp));
            instrs[wc] = enter_scope(local_symbols);
            wc = wc + 1;
            compile_component(block_body(comp));
            instrs[wc] = exit_scope();
            wc = wc + 1;
        } else ...
```
Whereas the explicit-control evaluator used the continuation to keep track
of the environment with thunks, I decided to use *block frames* on a
*runtime stack* for this purpose. Thus the machine has two new registers,
`environment` and `runtime_stack`.
``` js
function run(instrs) {
    let operands = null;
    let pc = 0;
    let environment = the_empty_environment;
    let runtime_stack = null;
    while (! is_done_instruction(instrs[pc])) {
        const instr = instrs[pc];
        if (...(instr)) ...
    }
    return head(operands);
} 
```
When entering a block, the current environment
is saved in a block frame before it is replaced by the extended environment for
execution of the block's code. When exiting a block, the saved environment is
retrieved from the block frame and reestablished.
``` js
        // clauses for enter_scope and exit_scope in machine
        } else if (is_enter_scope_instruction(instr)) {
            pc = pc + 1;
            runtime_stack = pair(make_runtime_stack_block_frame(
                                     environment),
                                 runtime_stack);
            environment = extend_environment(
                              enter_scope_symbols(instr),
                              list_of_unassigned(
                                  enter_scope_symbols(instr)),
                              environment);
        } else if (is_exit_scope_instruction(instr)) {
            pc = pc + 1;
            environment = runtime_stack_block_frame_environment(
                              head(runtime_stack));
            runtime_stack = tail(runtime_stack);
        } else ...
```
Names are compiled into `load` instructions
``` js
        // clause for names in compiler
        } else if (is_name(comp)) {
            instrs[wc] = load(symbol_of_name(comp));
            wc = wc + 1;
        } else ...
    }
```
which are executed by pushing onto the operand stack
the result of looking up the name in the environment.
``` js
        // clause for load instruction in machine
        } else if (is_load_instruction(instr)) {
            pc = pc + 1;
            operands = pair(lookup_symbol_value(load_symbol(instr),
                                                 environment),
                            operands);
        } else ...
```
Constant declarations are compiled by compiling the value expression 
followed by an assign instruction.
``` js
        // clause for declaration in compiler
        } else if (is_declaration(comp)) {
            compile_component(declaration_value_expression(comp));
            instrs[wc] = assign(declaration_symbol(comp));
            wc = wc + 1;
        } else ...
```
and the machine executes an assign instruction by changing
the environment using `assign_symbol_value`.
``` js
        // clause for assign instruction in machine
        else if (is_assign_instruction(instr)) {
            pc = pc + 1;
            // assign_symbol_value destructively updates env
            // and returns env
            environment = assign_symbol_value(assign_symbol(instr),
                                              head(operands),
                                              environment);
        } else ...
```
As in the previous evaluators, 
declarations outside of any block are handled by wrapping the
given program in an implicit block.
``` js
function parse_compile_run(program) {
    return run(compile(make_block(parse(program))));
}
```
The example program above
``` js
const y = 4; 
{
    const x = y + 7; 
    x * 2;
}
```
is compiled into the instruction array
``` js
[
0: enter_scope(list("y")),
1: load_constant(4),
2: assign("y"),
3: pop(),
4: enter_scope(list("x")),
5: load("y"),
6: load_constant(7),
7: binary_operation("+"),
8: assign("x"),
9: pop(),
10: load("x"),
11: load_constant(2),
12: binary_operation("*"),
13: exit_scope(),
14: exit_scope(),
15: done()
]
```
and its execution via
``` js
parse_compile_run(`
const y = 4; 
{
    const x = y + 7; 
    x * 2;
}`);
```
yields the expected value 3.

### Adding functions (with implicit return)

The
[next implementation](https://share.sourceacademy.org/qcpjq)
introduces functions without the need for for
return statements. For example, the function `fact` in this language
``` js
function fact(n) {
    n === 1 ? 1 : n * fact(n - 1);
}
```
computes the factorial function for positive integers.

To make this happen in a virtual machine, the compiler
needs to include cases for function declarations, lambda expressions, and
function applications. Function declarations are translated to constant declarations
as you have seen in the previous two implementations.
``` js
        // clause for function declaration in compiler
        } else if (is_function_declaration(comp)) {
           compile_component(function_decl_to_constant_decl(comp));
        } else ...
```
Lambda expressions are compiled into a `load_function` instruction
that contains the address of the first instruction of the compiled
function body. Care must be taken to jump over the compiled code.
pushes a function object on the operand stack to avoid executing
it before the function is being called.
``` js
        // clause for lambda expressions in compiler
        } else if (is_lambda_expression(comp)) {
            instrs[wc] = load_function(
                             reverse(lambda_parameter_symbols(comp)),
                             wc + 2);
            wc = wc + 1;
            // jump over the body of the lambda expression
            const goto_instruction = goto();
            instrs[wc] = goto_instruction;
            wc = wc + 1;
            compile_component(lambda_body(comp));
            instrs[wc] = return_instr();
            wc = wc + 1;
            set_jump_address(goto_instruction, wc);
        } else ...
```
The compiler generates a `return` instruction at the end of the body
code so that the callee function can return control to the caller.
The `load_function` instruction pushes a function value onto the
operand stack.
``` js
        // clause for load_function instruction in machine
        } else if (is_load_function_instruction(instr)) {
            pc = pc + 1;
            operands = pair(make_function(
                                load_function_instruction_parameters(instr),
                                load_function_instruction_address(instr),
                                environment),
                            operands);
        } else ...
```
The machine executes a `return` instruction by reestablishing the
program counter and environment that was saved on the runtime
stack before the function call.
``` js
        // clause for return instruction in machine
        } else if (is_return_instruction(instr)) {
            pc = runtime_stack_call_frame_pc(head(runtime_stack));
            environment = runtime_stack_call_frame_environment(
                              head(runtime_stack));
            runtime_stack = tail(runtime_stack);
        } else ...
```
Operator combinations are treated by the compiler as
function applications, using the function
`operator_comb_to_application`.
``` js
        // clause for operator combinations in compiler
        } else if (is_operator_combination(comp)) {
            compile_component(operator_combination_to_application(comp));
        } else ...
```
The final task for this implementation is to handle function application. 
The compiler needs to compile the components of the application so that
they are evaluated in the given order. It then generates a 
*call instruction* that will perform the function application when it
it is executed. The instruction remembers the number of arguments.
``` js
        // clause for applications in compiler
        } else if (is_application(comp)) {
            compile_component(function_expression(comp));
            const argument_expressions = arg_expressions(comp);
            for_each(compile_component, argument_expressions);
            instrs[wc] = call(length(argument_expressions));
            wc = wc + 1;
	} else ...
```
The execution of the call instruction pops as many arguments
from the operand stack as indicated by the instruction, and
then finds the callee function
as the next value on the operand stack.
``` js
        // clause for call instruction in machine
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
        } else ...
```
If the function is primitive, the function `apply_in_underlying_javascript` carries
out the application and the result is pushed onto the operand stack.
If the function is compound, the current environment and the address of the
next instruction are saved in a *call frame* on the runtime stack.
The new environment with respect to which the body is evaluated is the result
of extending the function's environment with a binding of the parameters (taken from
the function value) to the arguments (taken from the operand stack).
The function body is compiled such that the result of executing it will be
on top of the operand stack, so when the return instruction jumps back to the
caller, the operand stack holds the return value of the callee compound function,
similar all other instructions that produce a value.

In order to provide bindings for predeclared names, the function `parse_and_evaluate`
uses `the_global_environment` as its initial environment.
``` js
function parse_and_evaluate(program) {
    return evaluate(make_block(parse(program)), 
                    the_global_environment);
}
```
`the_global_environment` contains bindings of all predeclared
functions to their respective `primitive` functions.
The factorial function above with its application to the number 4
``` js
function fact(n) {
    n === 1 ? 1 : n * fact(n - 1);
}
fact(4);
```
is compiled into the following machine code.
``` js
[
0: enter_scope(list("fact")),
1: load_function(list("n"), 3),
2: goto(20),
3: load("==="),
4: load("n"),
5: load_constant(1),
6: call(2),
7: jump_on_false(10),
8: load_constant(1),
9: goto(19),
10: load("*"),
11: load("n"),
12: load("fact"),
13: load("-"),
14: load("n"),
15: load_constant(1),
16: call(2),
17: call(1),
18: call(2),
19: return_instr(),
20: assign("fact"),
21: pop(),
22: load("fact"),
23: load_constant(4),
24: call(1),
25: exit_scope(),
26: done()
]
```
Running the program by evaluating
``` js
parse_compile_run(`
function fact(n) {
    n === 1 ? 1 : n * fact(n - 1);
}
fact(4);
`);
```
gives the expected result of 24.

## Adding return statements

The [final implementation](https://share.sourceacademy.org/o40jf)
handles return statements, a prominent feature in languages like C, Java, Python, and
JavaScript. Returns statements allow the programmer to return from a function from anywhere in its
body. Whatever statements in the body that remain to be evaluated are ignored.
For example, in JavaScript, the program
``` js
function f(x) {
    if (true) {
        const y = 2;
	return x + y;
	44;
    } else {
        55;
    }
    66;
}
f(1);
```
results in 3 because the evaluation of the body of `f` returns the result of evaluating `x + y` to the
caller, ignoring the subsequent expression statements `44;` and `66;` that would otherwise
remain to be evaluated in the body.

The difficulty with evaluating explicit return statements is that evaluation needs to abandon the
remaining statements of the function, regardless how deeply nested the return statement is in
surrounding block statements. For this purpose, the compiler generates a `return` instruction
for each return statement.
``` js
        // clause for return statements in compiler
        } else if (is_return_statement(comp)) {
            compile_component(return_expression(comp));
            instrs[wc] = return_instr();
            wc = wc + 1;
        } else ...
```
The machine cannot rely on the top frame on the runtime stack to find the place
where evaluation should resume. Instead, it needs to pop all block frames from
the runtime stack, until it finds a call frame.
``` js
        // clause for return instructions in machine
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
The machine as presented so far will exhibit non-constant space consumption
when the interpreted function should give rise to an iterative process because the evaluation
of every call instruction pushes a new frame onto the runtime stack. Functions that call
themselves recursively, or mutually recursive functions will make the runtime stack grow
as high as the recursion is deep.

It is not necessary to push a runtime stack frame and
come back to the caller function, if the caller returns the
result of a function call to the place where the caller was called.
Instead, the callee can return its result directly to the place where
the caller was called. The compiler can recognize this situation and
generate a variant of the `call` instruction that we call `tail_call`.
``` js
        // clause for tail calls in compiler
        } else if (is_return_statement(comp) && 
                   is_application(return_expression(comp))) {
            // generate tail call
            const application = return_expression(comp);
            compile_component(function_expression(application));
            const argument_expressions = arg_expressions(application);
            for_each(compile_component, argument_expressions);
            instrs[wc] = tail_call(length(argument_expressions));
            wc = wc + 1;
            // generate return instruction in case callee is primitive
            instrs[wc] = return_instr();
            wc = wc + 1;            
        } else ...
```
The `return` instruction after the `tail_call` takes care of the case
where the callee of the tail call is a primitive function.

The `tail_call` instruction does exactly the same as the `call` instruction
except that it doesn't push any call frame on the runtime stack.
``` js
        // clause for tail_call instructions in machine
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
        } else ...
```
The factorial function above needs to have a `return` added, because otherwise
it would always return `undefined`. The example program
``` js
parse_compile_run(`               
function factorial(n) {
    return n === 1
           ? 1
           : n * factorial(n - 1);
}
factorial(4);`);
```
results in the expected value 24. Since the multiplication with `n` is a
*deferred operation*, the explicit-control evaluator has a non-constant
space consumption when evaluating applications of this `factorial` function. The
space consumption comes from runtime stack frames that are pushed on the runtime
stack for every function call.

The following evaluation has constant space consumption because a tail call instruction
is used instead of a call instruction.
``` js
parse_and_evaluate(`
function fact(n) {
    return fact_iter(n, 1, 1);
}
function fact_iter(n, i, acc) {
    if (i > n) {
        return acc;
    } else {
        return fact_iter(n, i + 1, acc * i);
    }
}
fact(5);
`);
```
However, if you choose to use conditional expressions rather than conditional statements,
the clause above does not get used and a call instruction is used instead of a
tail call instruction, which results in non-constant space consumption.
``` js
parse_and_evaluate(`
function fact(n) {
    return fact_iter(n, 1, 1);
}
function fact_iter(n, i, acc) {
    if (i > n) {
        return acc;
    } else {
        return fact_iter(n, i + 1, acc * i);
    }
}
fact(5);
`);
```
The compiler can take care of this, if the following clause is
inserted in front of the handling of return statements.
``` js
        // clause for conditional expr in return stmt in compiler
        } else if (is_return_statement(comp) &&
                   is_conditional(return_expression(comp))) {
            // for tail recursion, transform 
            //   return .?.:. into 
            //   if (.) { return .; } else { return .; }
            return compile_component(
                     return_cond_expr_to_cond_stmt(comp));
```
It translates conditional expressions in return statements into conditional
statements using the function `return_cond_expr_to_cond_stmt`.
``` js
function return_cond_expr_to_cond_stmt(stmt) {
    const cond_expr = return_expression(stmt);
    return make_conditional_statement(
               conditional_predicate(cond_expr),
               make_return_statement(conditional_consequent(cond_expr)),
               make_return_statement(conditional_alternative(cond_expr)));
}
```
With this machinery in place, the `fact` function whose `fact_iter`
function uses a conditional expression
and its application to 5 above compiles to the following code.
``` js
[
0: load_function(list("n"), 2),
1: goto(10),
2: load("fact_iter"),
3: load("n"),
4: load_constant(1),
5: load_constant(1),
6: tail_call(3),
7: return(),
8: load_constant(undefined),
9: return(),
10: assign("fact"),
11: pop(),
12: load_function(list("acc", "i", "n"), 14),
13: goto(36),
14: load(">"),
15: load("i"),
16: load("n"),
17: call(2),
18: jump_on_false(22),
19: load("acc"),
20: return(),
21: goto(34),
22: load("fact_iter"),
23: load("n"),
24: load("+"),
25: load("i"),
26: load_constant(1),
27: call(2),
28: load("*"),
29: load("acc"),
30: load("i"),
31: call(2),
32: tail_call(3),
33: return(),
34: load_constant(undefined),
35: return(),
36: assign("fact_iter"),
37: pop(),
38: load("fact"),
39: load_constant(4),
40: call(1),
41: done()
]
```
Due to the `tail_call` instruction in line 32, this program gives rise to
an iterative process.

In general, this implementation makes sure that iterative processes consume constant
runtime stack space. Such an implementation is said to have *proper tail calls*.
The ECMAScript standard of JavaScript requires proper tail calls since
ECMAScript 2015. However, the most popular web browsers, Google Chrome and
Firefox, do not adhere to the ECMAScript standard in this respect. Our
virtual machine exhibits no additional memory consumption for iterative processes,
even when the JavaScript implementation does not enjoy proper tail calls.
However, the compiler we describe above gives rise to a recursive process, which
is not an issue for programs written by humans, because the recursion depth
is limited by the nesting depth of statements and expressions in the program
being compiled.

